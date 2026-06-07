import { mullInternal, type Order } from "@perp-v1-boilerplate/commons";
import { emitEngineEvent } from "@perp-v1-boilerplate/redis/engine-events";
import { randomUUIDv7 } from "bun";
import { MAX_LEVERAGE } from "@/constants/risk";
import { marketMatch } from "@/engines/market-matching";
import { getOrderBook } from "@/handlers/get-orderbook";
import type { HandleResult } from "@/handlers/processCommand";
import { restInOrderBook } from "@/handlers/rest-in-orderbook";
import { users } from "@/store/engine-store";

export async function createOrder(
  payload: {
    userId: string;
    marketType: "SOL" | "ETH" | "BTC";
    type: "long" | "short";
    side: "market" | "limit";
    price: number;
    qty: number;
    margin: number;
    slippage: number;
  },
  correlationId: string,
): Promise<HandleResult> {
  const { userId, marketType, type, price, qty, side, margin, slippage } =
    payload;

  const user = users.get(userId);
  if (!user) {
    return { ok: false, error: "User does not exist" };
  }

  const orderBook = getOrderBook(marketType);

  if (side === "limit" && (price == null || price <= 0)) {
    return {
      ok: false,
      error: "limit order requires a valid price",
    };
  }

  let estimatedPrice = price;

  if (side === "market") {
    if (type === "long") {
      const bestAsk = Object.keys(orderBook.asks)
        .map(Number)
        .sort((a, b) => a - b)[0];

      estimatedPrice = bestAsk ?? orderBook.indexPrice;
    } else {
      const bestBid = Object.keys(orderBook.bids)
        .map(Number)
        .sort((a, b) => b - a)[0];

      estimatedPrice = bestBid ?? orderBook.indexPrice;
    }
  }

  if (!estimatedPrice || estimatedPrice <= 0) {
    return {
      ok: false,
      error: "Cannot determine price for order",
    };
  }

  const notional = mullInternal(estimatedPrice, qty);
  const leverage = notional / margin;

  if (leverage > MAX_LEVERAGE) {
    return {
      ok: false,
      error: `Max leverage exceeded.
 allowed=${MAX_LEVERAGE}x got=${leverage.toFixed(2)}x`,
    };
  }

  const hasSlippageGuard = side === "market" && slippage > 0;
  const slippageFactor = slippage / 100;

  const maxAcceptablePrice =
    type === "long"
      ? Math.round(estimatedPrice * (1 + slippageFactor))
      : Math.round(estimatedPrice * (1 - slippageFactor));

  if (user.collateral.available < margin) {
    return {
      ok: false,
      error: "Insufficient wallet balance",
    };
  }

  user.collateral.available -= margin;
  user.collateral.locked += margin;
  user.reservedOrderMargin += margin;

  const orderId = randomUUIDv7();

  const order: Order = {
    orderId,
    market: marketType,
    type: type === "long" ? "LONG" : "SHORT",
    qty,
    margin,
    side,
    price: side === "limit" ? price : undefined,
    status: "open",
    fillQty: 0,
  };

  const { fills, usedMargin, remainingQty } = marketMatch({
    user,
    marketType,
    type,
    side,
    price,
    qty,
    margin,
    hasSlippageGuard,
    maxAcceptablePrice,
    orderBook,
  });

  const filledQty = qty - remainingQty;
  let releasedMargin = 0;
  let cancelledQty = 0;
  let restingMargin = 0;

  if (remainingQty === 0) {
    order.status = "filled";
    releasedMargin = margin - usedMargin;
    user.reservedOrderMargin -= margin;
    user.collateral.locked -= releasedMargin;
    user.collateral.available += releasedMargin;
  } else if (filledQty > 0) {
    order.status = "partially_filled";

    if (side === "market") {
      cancelledQty = remainingQty;
      releasedMargin = margin - usedMargin;
      user.reservedOrderMargin -= margin;
      user.collateral.locked -= releasedMargin;
      user.collateral.available += releasedMargin;
    } else {
      restingMargin = margin - usedMargin;
      user.reservedOrderMargin -= usedMargin;
      restInOrderBook(
        orderBook,
        orderId,
        userId,
        type,
        price,
        remainingQty,
        restingMargin,
      );
    }
  } else {
    if (side === "market") {
      order.status = "cancelled";
      cancelledQty = qty;
      releasedMargin = margin;
      user.reservedOrderMargin -= margin;
      user.collateral.locked -= margin;
      user.collateral.available += margin;
    } else {
      order.status = "open";
      restingMargin = margin;
      restInOrderBook(
        orderBook,
        orderId,
        userId,
        type,
        price,
        remainingQty,
        restingMargin,
      );
    }
  }

  if (user.reservedOrderMargin < 0) user.reservedOrderMargin = 0;

  order.fillQty = filledQty;
  user.orders.push(order);

  let reason: string | undefined;

  if (order.status === "cancelled") {
    reason = hasSlippageGuard
      ? "no fills within slippage tolerance"
      : "no matching orders";
  } else if (order.status === "partially_filled" && side === "market") {
    reason = hasSlippageGuard
      ? "partial fill, remaining exceeded slippage tolerance"
      : "partial fill, remaining cancelled";
  }

  await emitEngineEvent(
    "order_created",
    {
      userId,
      orderId,
      marketType,
      side,
      type,
      qty,
      price: order.price ?? null,
      margin,
      status: order.status,
      fillQty: order.fillQty,
    },
    correlationId,
  );

  for (const fill of fills) {
    const makerUser = users.get(fill.maker);
    const makerOrder = makerUser?.orders.find(
      (o) =>
        o.market === fill.market &&
        (o.status === "open" ||
          o.status === "partially_filled" ||
          o.status === "filled"),
    );

    await emitEngineEvent("fill_created", {
      ...fill,
      takerOrderId: orderId,
      makerOrderId: makerOrder?.orderId ?? "",
    });
  }

  return {
    ok: true,
    payload: {
      orderId,
      status: order.status,
      reason,
      fills,
      filledQty,
      remainingQty,
      cancelledQty,
      collateral: user.collateral,
      reservedOrderMargin: user.reservedOrderMargin,
    },
  };
}
