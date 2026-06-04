import { recalculatePnl } from "@/handlers/calculate-Pnl";
import { checkLiquidation } from "@/handlers/check-liquidation";
import { getOrderBook } from "@/handlers/get-orderbook";
import type { HandleResult } from "@/handlers/processCommand";
import { users } from "@/store/engine-store";

export function updateMarketPrice(payload: {
  marketType: "SOL" | "ETH" | "BTC";
  indexPrice: number;
  markPrice: number;
}): HandleResult {
  const { marketType, indexPrice, markPrice } = payload;

  if (indexPrice <= 0 || markPrice <= 0) {
    return { ok: false, error: "Invalid market prices" };
  }

  const orderBook = getOrderBook(marketType);

  orderBook.indexPrice = indexPrice;
  orderBook.markPrice = markPrice;

  const liquidationCandidates: {
    userId: string;
    market: string;
    type: "LONG" | "SHORT";
    qty: number;
    equity: number;
    maintenanceMargin: number;
  }[] = [];

  for (const user of users.values()) {
    const hasPositionInMarket = user.positions.some(
      (position) => position.market === marketType,
    );

    if (!hasPositionInMarket) {
      continue;
    }

    recalculatePnl(user);

    for (const position of user.positions) {
      if (position.market !== marketType) {
        continue;
      }

      const result = checkLiquidation(user, position);

      if (result.shouldLiquidate) {
        liquidationCandidates.push({
          userId: user.userId,
          market: position.market,
          type: position.type,
          qty: position.qty,
          equity: result.equity,
          maintenanceMargin: result.maintenanceMargin,
        });
      }
    }
  }

  return {
    ok: true,
    payload: {
      market: marketType,
      indexPrice: orderBook.indexPrice,
      markPrice: orderBook.markPrice,
      liquidationCandidates,
    },
  };
}
