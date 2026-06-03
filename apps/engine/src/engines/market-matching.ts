import type { EngineUser, Fill, Orderbook } from "@perp-v1-boilerplate/commons";
import { updatePosition } from "@/handlers/update-positions";
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
          taker: user.userId,
          market: marketType,
          qty: matchQty,
          price: askPrice,
          long: user.userId,
          short: openOrder.userId,
        });

        //Drive makers actual leverage from their short position
        // so we release the right amount of there locked margin

        // taker
        updatePosition({
          user,
          marketType,
          type: "LONG",
          fillPrice: askPrice,
          fillQty: matchQty,
          fillMargin,
        });

        const makerUser = users.get(openOrder.userId);
        const makerPos = makerUser?.positions.find(
          (p) => p.market === marketType && p.type === "SHORT",
        );
        const makerFillMargin = makerPos
          ? (matchQty / makerPos.qty) * makerPos.margin
          : fillMargin;

        if (makerUser) {
          // maker
          updatePosition({
            user: makerUser,
            marketType,
            type: "SHORT",
            fillPrice: askPrice,
            fillQty: matchQty,
            fillMargin: makerFillMargin,
          });

          // Release the position of makers locked margin
          makerUser.collateral.locked -= makerFillMargin;

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
            } else {
              makerOrder.status = "open";
            }
          }
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
  } else {
    // Short
    const bidPriceLevels = Object.keys(orderBook.bids)
      .map(Number)
      .sort((a, b) => b - a);

    for (const bidPrice of bidPriceLevels) {
      if (remainingQty <= 0) {
        break;
      }

      if (side === "limit" && price > bidPrice) {
        break;
      }

      if (hasSlippageGuard && bidPrice < maxAcceptablePrice) {
        break;
      }

      const level = orderBook.bids[bidPrice.toString()];
      if (!level || level.availableQty <= 0) {
        continue;
      }

      for (const openOrder of [...level.openOrders]) {
        if (remainingQty <= 0) {
          break;
        }

        const matchQty = Math.min(
          remainingQty,
          openOrder.qty - openOrder.filledQty,
        );
        if (matchQty <= 0) {
          continue;
        }

        // takers proportional margin for this fill
        const fillMargin = (matchQty / qty) * margin;

        // Record the fill - long=maker, short=taker
        updatePosition({
          user,
          marketType,
          type: "SHORT",
          fillPrice: bidPrice,
          fillQty: matchQty,
          fillMargin,
        });

        const makerUser = users.get(openOrder.userId);
        const makerPos = makerUser?.positions.find(
          (p) => p.market === marketType && p.type === "LONG",
        );
        const makerFillMargin = makerPos
          ? (matchQty / makerPos.qty) * makerPos.margin
          : fillMargin;

        if (makerUser) {
          updatePosition({
            user: makerUser,
            marketType,
            type: "LONG",
            fillPrice: bidPrice,
            fillQty: matchQty,
            fillMargin: makerFillMargin,
          });

          // releasee the position of maker locked margin
          makerUser.collateral.locked -= makerFillMargin;

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
            } else {
              makerOrder.status = "open";
            }
          }
        }

        openOrder.filledQty += matchQty;
        level.availableQty -= matchQty;
        remainingQty -= matchQty;
        usedMargin += fillMargin;

        // update lastTradedPrice to recalPNL
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

  // Return the three values createOrder needs to finalize the order:
  // fills       → full match history to attach to the order and return to caller
  // usedMargin  → actual margin consumed so createOrder can release the surplus
  // remainingQty → how much didn't fill so createOrder can decide the final status
  return { fills, usedMargin, remainingQty };
}
