import type { Order } from "@perp-v1-boilerplate/commons";
import { randomUUIDv7 } from "bun";
import { getOrderBook } from "@/handlers/get-orderbook";
import { users } from "@/store/engine-store";
import { marketMatch } from "@/engines/market-matching";
import { restInOrderBook } from "@/handlers/rest-in-orderbook";
import type { HandleResult } from "@/handlers/processCommand";

export function createOrder(payload: {
  userId: string;
  marketType: "SOL" | "ETH" | "BTC";
  type: "long" | "short";
  side: "market" | "limit";
  price: number;
  qty: number;
  margin: number;
  slippage: number;
}): HandleResult {
  //1- validate user
  const { userId, marketType, type, price, qty, side, margin, slippage } =
    payload;

  const user = users.get(userId);
  if (!user) {
    return { ok: false, payload: "User doesnot exists" };
  }

  //2 - Get or create orderbook
  const orderBook = getOrderBook(marketType);

  //3 - validate limit order price
  if (side === "limit" && (price == null || price <= 0)) {
    return { ok: false, payload: "limit order requires a valid price" };
  }

  // 4. Estimate price for  margin + leverage cal
  let estimatedPrice = price;

  if (side === "market") {
    if (type === "long") {
      // Buying -> match against asks -> cheapest ask
      const bestAsk = Object.keys(orderBook.asks)
        .map(Number)
        .sort((a, b) => a - b)[0];

      estimatedPrice = bestAsk ?? orderBook.indexPrice;
    } else {
      // Seling -> match against bids -> highest bid
      const bestBid = Object.keys(orderBook.bids)
        .map(Number)
        .sort((a, b) => b - a)[0];

      estimatedPrice = bestBid ?? orderBook.indexPrice;
    }
  }

  if (!estimatedPrice || estimatedPrice <= 0) {
    return { ok: false, payload: "Cannot determine price for order" };
  }

  // 5 - slippage (market order)
  const hasSlippageGuard = side === "market" && slippage > 0;
  const slippageFactor = slippage / 100;

  const maxAcceptablePrice =
    type === "long"
      ? estimatedPrice * (1 + slippageFactor)
      : estimatedPrice * (1 - slippageFactor);

  // 6 - leverage from margin
  const leverage = (estimatedPrice * qty) / margin;

  // 7 - Check and lock collateral
  if (user.collateral.available < margin) {
    return { ok: false, payload: "Insufficient collateral" };
  }

  user.collateral.available -= margin;
  user.collateral.locked += margin;

  // 8 - Build order object
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

  // 9 - Match against order book
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

  // 10 - Resolve final status
  const filledQty = qty - remainingQty;
  let releasedMargin = 0;
  let cancelledQty = 0;

  if (remainingQty === 0) {
    // fully filled
    order.status = "filled";
    releasedMargin = margin - usedMargin;
    user.collateral.locked -= releasedMargin;
    user.collateral.available += releasedMargin;
  } else if (filledQty > 0) {
    // partially filled
    order.status = "partially_filled";

    if (side === "market") {
      // market orders never rest
      cancelledQty = remainingQty;
      releasedMargin = margin - usedMargin;
      user.collateral.locked -= releasedMargin;
      user.collateral.available += releasedMargin;
    } else {
      // limit orders rest remaining qty in the orderbook
      restInOrderBook(orderBook, orderId, userId, type, price, remainingQty);
    }
  } else {
    // Nothing filled
    if (side === "market") {
      order.status = "cancelled";
      cancelledQty = qty;
      releasedMargin = margin;
      user.collateral.locked -= margin;
      user.collateral.available += margin;
    } else {
      order.status = "open";
      restInOrderBook(orderBook, orderId, userId, type, price, remainingQty);
    }
  }

  order.fillQty = filledQty;
  user.orders.push(order);

  // 11 Build reason string
  let reason: string | undefined;

  if (order.status === "cancelled") {
    if (hasSlippageGuard) {
      reason = "no fills within slippage tolerance";
    } else {
      reason = "no matching orders";
    }
  } else if (order.status === "partially_filled" && side === "market") {
    if (hasSlippageGuard) {
      reason = "partial fiil, remaing exceeded slippage tolerance";
    } else {
      reason = "partial fill, remaining calcelled";
    }
  }

  // 12 return result
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
      collateral: {
        available: user.collateral.available,
        locked: user.collateral.locked,
      },
    },
  };
}
