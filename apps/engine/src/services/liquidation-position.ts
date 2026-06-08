import type { EngineUser, Fill, Order } from "@perp-v1-boilerplate/commons";
import { emitEngineEvent } from "@perp-v1-boilerplate/redis/engine-events";
import { randomUUIDv7 } from "bun";
import { applyFillToUser } from "@/handlers/apply-fill";
import { checkLiquidation } from "@/handlers/check-liquidation";
import type { HandleResult } from "@/handlers/processCommand";
import { orderBooks, users } from "@/store/engine-store";
import { cancelOrder } from "./cancel-order";

function cancelUserOrdersInMarket(
  userId: string,
  marketType: "SOL" | "ETH" | "BTC",
  orders: Order[],
) {
  const cancellableOrders = orders.filter(
    (order) =>
      order.market === marketType &&
      order.side === "limit" &&
      (order.status === "open" || order.status === "partially_filled"),
  );

  for (const order of cancellableOrders) {
    cancelOrder({ userId, orderId: order.orderId, marketType });
  }

  return cancellableOrders.map((order) => order.orderId);
}

function syncMakerOrderFill(
  makerUser: EngineUser,
  orderId: string,
  matchQty: number,
) {
  const makerOrder = makerUser.orders.find((o) => o.orderId === orderId);
  if (!makerOrder) return;

  makerOrder.fillQty = Math.min(makerOrder.qty, makerOrder.fillQty + matchQty);

  if (makerOrder.fillQty >= makerOrder.qty) {
    makerOrder.status = "filled";
  } else if (makerOrder.fillQty > 0) {
    makerOrder.status = "partially_filled";
  } else {
    makerOrder.status = "open";
  }
}

export function liquidatePosition(payload: {
  userId: string;
  marketType: "SOL" | "ETH" | "BTC";
  positionType: "LONG" | "SHORT";
}): HandleResult {
  const { userId, marketType, positionType } = payload;

  const user = users.get(userId);
  if (!user) {
    return { ok: false, error: "User does not exist" };
  }

  const position = user.positions.find(
    (p) => p.market === marketType && p.type === positionType,
  );
  if (!position) {
    return { ok: false, error: "Position not found" };
  }

  const orderBook = orderBooks[marketType];
  if (!orderBook) {
    return { ok: false, error: "Orderbook not found" };
  }

  const liquidationCheck = checkLiquidation(user, position);
  if (!liquidationCheck.shouldLiquidate) {
    return { ok: false, error: "Position is not eligible for liquidation" };
  }

  const cancelledOrderIds = cancelUserOrdersInMarket(userId, marketType, [
    ...user.orders,
  ]);

  let remainingQty = position.qty;
  const fills: Fill[] = [];

  if (positionType === "LONG") {
    // user's LONG is being closed (reduced), maker's LONG is being opened
    const bidPriceLevels = Object.keys(orderBook.bids)
      .map(Number)
      .sort((a, b) => b - a);

    for (const bidPrice of bidPriceLevels) {
      if (remainingQty <= 0) break;

      const level = orderBook.bids[bidPrice.toString()];
      if (!level || level.availableQty <= 0) continue;

      for (const openOrder of [...level.openOrders]) {
        if (remainingQty <= 0) break;

        const availableMakerQty = openOrder.qty - openOrder.filledQty;
        if (availableMakerQty <= 0) continue;

        const matchQty = Math.min(remainingQty, availableMakerQty);
        const makerUser = users.get(openOrder.userId);
        if (!makerUser) continue;

        const makerOrder = makerUser.orders.find(
          (o) => o.orderId === openOrder.orderId,
        );
        const makerFillMargin =
          makerOrder != null
            ? (makerOrder.margin * matchQty) / makerOrder.qty
            : 0;

        // close the liquidated user's LONG position
        const takerApply = applyFillToUser({
          user,
          marketType,
          incomingType: "SHORT", // closing LONG = applying SHORT fill
          fillPrice: bidPrice,
          fillQty: matchQty,
          fillMargin: 0, // no new margin for liquidation
        });
        if (!takerApply.ok) continue;

        // open/increase maker's LONG position
        const makerApply = applyFillToUser({
          user: makerUser,
          marketType,
          incomingType: "LONG",
          fillPrice: bidPrice,
          fillQty: matchQty,
          fillMargin: makerFillMargin,
        });
        if (!makerApply.ok) continue;

        makerUser.reservedOrderMargin -= makerFillMargin;
        if (makerUser.reservedOrderMargin < 0)
          makerUser.reservedOrderMargin = 0;

        syncMakerOrderFill(makerUser, openOrder.orderId, matchQty);

        fills.push({
          fillId: randomUUIDv7(),
          maker: openOrder.userId,
          taker: user.userId,
          market: marketType,
          qty: matchQty,
          price: bidPrice,
          long: openOrder.userId,
          short: user.userId,
          makerOrderId: openOrder.orderId,
          takerOrderId: "",
        });

        openOrder.filledQty += matchQty;
        openOrder.remainingMargin -= makerFillMargin;
        if (openOrder.remainingMargin < 0) openOrder.remainingMargin = 0;

        level.availableQty -= matchQty;
        remainingQty -= matchQty;
        orderBook.lastTradedPrice = bidPrice;

        if (openOrder.filledQty >= openOrder.qty) {
          level.openOrders = level.openOrders.filter(
            (o) => o.orderId !== openOrder.orderId,
          );
        }
      }

      if (level.availableQty <= 0 || level.openOrders.length === 0) {
        delete orderBook.bids[bidPrice.toString()];
      }
    }
  } else {
    // user's SHORT is being closed (reduced), maker's SHORT is being opened
    const askPriceLevels = Object.keys(orderBook.asks)
      .map(Number)
      .sort((a, b) => a - b);

    for (const askPrice of askPriceLevels) {
      if (remainingQty <= 0) break;

      const level = orderBook.asks[askPrice.toString()];
      if (!level || level.availableQty <= 0) continue;

      for (const openOrder of [...level.openOrders]) {
        if (remainingQty <= 0) break;

        const availableMakerQty = openOrder.qty - openOrder.filledQty;
        if (availableMakerQty <= 0) continue;

        const matchQty = Math.min(remainingQty, availableMakerQty);
        const makerUser = users.get(openOrder.userId);
        if (!makerUser) continue;

        const makerOrder = makerUser.orders.find(
          (o) => o.orderId === openOrder.orderId,
        );
        const makerFillMargin =
          makerOrder != null
            ? (makerOrder.margin * matchQty) / makerOrder.qty
            : 0;

        // close the liquidated user's SHORT position
        const takerApply = applyFillToUser({
          user,
          marketType,
          incomingType: "LONG", // closing SHORT = applying LONG fill
          fillPrice: askPrice,
          fillQty: matchQty,
          fillMargin: 0, // no new margin for liquidation
        });
        if (!takerApply.ok) continue;

        // open/increase maker's SHORT position
        const makerApply = applyFillToUser({
          user: makerUser,
          marketType,
          incomingType: "SHORT",
          fillPrice: askPrice,
          fillQty: matchQty,
          fillMargin: makerFillMargin,
        });
        if (!makerApply.ok) continue;

        makerUser.reservedOrderMargin -= makerFillMargin;
        if (makerUser.reservedOrderMargin < 0)
          makerUser.reservedOrderMargin = 0;

        syncMakerOrderFill(makerUser, openOrder.orderId, matchQty);

        fills.push({
          fillId: randomUUIDv7(),
          maker: openOrder.userId,
          taker: user.userId,
          market: marketType,
          qty: matchQty,
          price: askPrice,
          long: user.userId,
          short: openOrder.userId,
          makerOrderId: openOrder.orderId,
          takerOrderId: "",
        });

        openOrder.filledQty += matchQty;
        openOrder.remainingMargin -= makerFillMargin;
        if (openOrder.remainingMargin < 0) openOrder.remainingMargin = 0;

        level.availableQty -= matchQty;
        remainingQty -= matchQty;
        orderBook.lastTradedPrice = askPrice;

        if (openOrder.filledQty >= openOrder.qty) {
          level.openOrders = level.openOrders.filter(
            (o) => o.orderId !== openOrder.orderId,
          );
        }
      }

      if (level.availableQty <= 0 || level.openOrders.length === 0) {
        delete orderBook.asks[askPrice.toString()];
      }
    }
  }

  const remainingPosition =
    user.positions.find(
      (p) => p.market === marketType && p.type === positionType,
    ) || null;

  void emitEngineEvent("liquidation_executed", {
    userId,
    marketType,
    positionType,
    filledQty: position.qty - remainingQty,
    remainingQty,
    fills,
    cancelledOrderIds,
  }).catch(console.error);

  return {
    ok: true,
    payload: {
      userId,
      market: marketType,
      positionType,
      markPrice: liquidationCheck.markPrice,
      cancelledOrderIds,
      fills,
      filledQty: position.qty - remainingQty,
      remainingQty,
      status: remainingPosition ? "partially_filled" : "fully_liquidated",
      bankruptcyCandidate: remainingQty > 0,
      remainingPosition,
      collateral: user.collateral,
      reservedOrderMargin: user.reservedOrderMargin,
    },
  };
}
