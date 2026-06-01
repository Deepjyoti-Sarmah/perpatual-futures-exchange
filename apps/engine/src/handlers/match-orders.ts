import { users } from "@/store/engine-store";
import type { Fill, Orderbook } from "@perp-v1-boilerplate/commons";
import { updatePosition } from "./update-positions";

type MatchOrdersParams = {
  userId: string;
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

export function matchOrders(params: MatchOrdersParams): MatchOrderResult {
  const {
    userId,
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
      if (remainingQty <= 0) {
        break;
      }

      if (side === "limit" && price < askPrice) {
        break;
      }

      if (hasSlippageGuard && askPrice > maxAcceptablePrice) {
        break;
      }

      const level = orderBook.asks[askPrice.toString()];
      if (!level || level.availableQty <= 0) {
        continue;
      }

      for (const openOrder of [...level.openOrders]) {
        if (remainingQty <= 0) {
          break;
        }

        // only fill the maker still has
        const matchQty = Math.min(
          remainingQty,
          openOrder.qty - openOrder.filledQty,
        );

        // margin consumed by taker for the fill
        const fillMargin = (matchQty / qty) * margin;

        // Record the fill, long=taker(we), short=maker(them)
        fills.push({
          maker: openOrder.userId,
          taker: userId,
          market: marketType,
          qty: matchQty,
          price: askPrice,
          long: userId,
          short: openOrder.userId,
        });

        //Drive makers actual leverage from their short position
        // so we release the right amount of there locked margin

        const makerUser = users.get(openOrder.userId);
        const makerPos = makerUser?.positions.find(
          (p) => p.market === marketType && p.type === "SHORT",
        );

        const makerFillMargin = makerPos
          ? (matchQty / makerPos.qty) * makerPos.margin
          : fillMargin;

        // update both sides
        updatePosition({
          userId: openOrder.userId,
          marketType,
          type: "SHORT",
          fillPrice: askPrice,
          fillQty: matchQty,
          fillMargin: makerFillMargin,
        });
        updatePosition({
          userId,
          marketType,
          type: "LONG",
          fillPrice: askPrice,
          fillQty: matchQty,
          fillMargin,
        });

        // Release the position of makers locked margin
        if (makerUser) {
          makerUser.collateral.locked -= makerFillMargin;
        }

        // update tracking counter
        openOrder.filledQty += matchQty;
        level.availableQty -= matchQty;
        remainingQty -= matchQty;
        usedMargin += fillMargin;

        // update lastTradedPrice to recalPNL
        orderBook.lastTradedPrice = askPrice;

        //Remove maker order from level
        if (openOrder.filledQty >= openOrder.qty) {
          level.openOrders = level.openOrders.filter(
            (o) => o.orderId !== openOrder.orderId,
          );
        }
      }

      // Remove the price level if no qty left
      if (level.availableQty <= 0 || level.openOrders.length === 0) {
        delete orderBook.asks[askPrice.toString()];
      }
    }
    // Short
  } else {
    
  }
}
