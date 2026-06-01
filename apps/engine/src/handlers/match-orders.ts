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
  leverage: number;
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
    leverage,
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
        const fillMargin = (askPrice * matchQty) / leverage;

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

        const makerLeverage = makerPos
          ? (makerPos.averagePrice * makerPos.qty) / makerPos.margin
          : leverage; // if  maker has no positon yet

        // update both sides
        updatePosition({
          userId: openOrder.userId,
          marketType,
          type: "SHORT",
          price: askPrice,
          matchQty,
          leverage: makerLeverage,
        });
        updatePosition({
          userId,
          marketType,
          type: "LONG",
          price: askPrice,
          matchQty,
          leverage,
        });
      }
    }
  }
}
