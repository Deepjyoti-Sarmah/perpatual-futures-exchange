import type { EngineUser, Fill, Orderbook } from "@perp-v1-boilerplate/commons";
import { randomUUIDv7 } from "bun";
import { applyFillToUser } from "@/handlers/apply-fill";
import { users } from "@/store/engine-store";

type MatchOrdersParams = {
  user: EngineUser;
  marketType: "SOL" | "ETH" | "BTC";
  type: "long" | "short";
  side: "limit" | "market";
  price: number;
  qty: number;
  margin: number;
  hasSlippageGuard: boolean;
  maxAcceptablePrice: number;
  orderBook: Orderbook;
};

type MatchOrderResult = {
  fills: Fill[];
  usedMargin: number;
  remainingQty: number;
};

export function marketMatch(params: MatchOrdersParams): MatchOrderResult {
  const {
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
  } = params;

  let remainingQty = qty;
  const fills: Fill[] = [];
  let usedMargin = 0;

  if (type === "long") {
    const askPriceLevels = Object.keys(orderBook.asks)
      .map(Number)
      .sort((a, b) => a - b);

    for (const askPrice of askPriceLevels) {
      if (remainingQty <= 0) break;
      if (side === "limit" && price < askPrice) break;
      if (hasSlippageGuard && askPrice > maxAcceptablePrice) break;

      const level = orderBook.asks[askPrice.toString()];
      if (!level || level.availableQty <= 0) continue;

      for (const openOrder of [...level.openOrders]) {
        if (remainingQty <= 0) break;

        const availableMakerQty = openOrder.qty - openOrder.filledQty;
        const matchQty = Math.min(remainingQty, availableMakerQty);
        if (matchQty <= 0) continue;

        const takerFillMargin = (matchQty / qty) * margin;

        const takerApply = applyFillToUser({
          user,
          marketType,
          incomingType: "LONG",
          fillPrice: askPrice,
          fillQty: matchQty,
          fillMargin: takerFillMargin,
        });

        if (!takerApply.ok) continue;

        const makerUser = users.get(openOrder.userId);
        if (!makerUser) continue;

        const makerRemainingQty = openOrder.qty - openOrder.filledQty;
        const makerFillMargin =
          (matchQty / makerRemainingQty) * openOrder.remainingMargin;

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

        const makerOrder = makerUser.orders.find(
          (o) => o.orderId === openOrder.orderId,
        );

        if (makerOrder) {
          makerOrder.fillQty = Math.min(
            makerOrder.qty,
            makerOrder.fillQty + matchQty,
          );

          if (makerOrder.fillQty >= makerOrder.qty) {
            makerOrder.status = "filled";
          } else if (makerOrder.fillQty > 0) {
            makerOrder.status = "partially_filled";
          }
        }

        openOrder.filledQty += matchQty;
        openOrder.remainingMargin -= makerFillMargin;
        if (openOrder.remainingMargin < 0) openOrder.remainingMargin = 0;

        level.availableQty -= matchQty;
        remainingQty -= matchQty;
        usedMargin += takerFillMargin;
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
  } else {
    const bidPriceLevels = Object.keys(orderBook.bids)
      .map(Number)
      .sort((a, b) => b - a);

    for (const bidPrice of bidPriceLevels) {
      if (remainingQty <= 0) break;
      if (side === "limit" && price > bidPrice) break;
      if (hasSlippageGuard && bidPrice < maxAcceptablePrice) break;

      const level = orderBook.bids[bidPrice.toString()];
      if (!level || level.availableQty <= 0) continue;

      for (const openOrder of [...level.openOrders]) {
        if (remainingQty <= 0) break;

        const availableMakerQty = openOrder.qty - openOrder.filledQty;
        const matchQty = Math.min(remainingQty, availableMakerQty);
        if (matchQty <= 0) continue;

        const takerFillMargin = (matchQty / qty) * margin;

        const takerApply = applyFillToUser({
          user,
          marketType,
          incomingType: "SHORT",
          fillPrice: bidPrice,
          fillQty: matchQty,
          fillMargin: takerFillMargin,
        });

        if (!takerApply.ok) continue;

        const makerUser = users.get(openOrder.userId);
        if (!makerUser) continue;

        const makerRemainingQty = openOrder.qty - openOrder.filledQty;
        const makerFillMargin =
          (matchQty / makerRemainingQty) * openOrder.remainingMargin;

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

        const makerOrder = makerUser.orders.find(
          (o) => o.orderId === openOrder.orderId,
        );

        if (makerOrder) {
          makerOrder.fillQty = Math.min(
            makerOrder.qty,
            makerOrder.fillQty + matchQty,
          );

          if (makerOrder.fillQty >= makerOrder.qty) {
            makerOrder.status = "filled";
          } else if (makerOrder.fillQty > 0) {
            makerOrder.status = "partially_filled";
          }
        }

        openOrder.filledQty += matchQty;
        openOrder.remainingMargin -= makerFillMargin;
        if (openOrder.remainingMargin < 0) openOrder.remainingMargin = 0;

        level.availableQty -= matchQty;
        remainingQty -= matchQty;
        usedMargin += takerFillMargin;
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
  }

  return { fills, usedMargin, remainingQty };
}
