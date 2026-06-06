import { recalculatePnl } from "@/handlers/calculate-Pnl";
import { checkLiquidation } from "@/handlers/check-liquidation";
import { getOrderBook } from "@/handlers/get-orderbook";
import type { HandleResult } from "@/handlers/processCommand";
import { users } from "@/store/engine-store";
import { liquidatePosition } from "./liquidation-position";
import { calculateFundingRate } from "@/handlers/create-funding-rate";
import { settleFunding } from "./settle-funding";

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
  orderBook.fundingRate = calculateFundingRate(markPrice, indexPrice);

  const liquidationResults: unknown[] = [];

  for (const user of users.values()) {
    const marketPositions = user.positions.filter(
      (position) => position.market === marketType,
    );

    if (marketPositions.length === 0) {
      continue;
    }

    recalculatePnl(user);

    for (const position of marketPositions) {
      const result = checkLiquidation(user, position);

      if (!result.shouldLiquidate) {
        continue;
      }

      const executionResult = liquidatePosition({
        userId: user.userId,
        marketType,
        positionType: position.type,
      });

      liquidationResults.push({
        userId: user.userId,
        positionType: position.type,
        trigger: {
          markPrice: result.markPrice,
          equity: result.equity,
          maintenanceMargin: result.maintenanceMargin,
        },
        check: result,
        execution: executionResult,
      });
    }
  }

  let fundingSettlement: ReturnType<typeof settleFunding> | null = null;

  if (Date.now() >= orderBook.nextFundingTime) {
    fundingSettlement = settleFunding({ marketType });
  }

  return {
    ok: true,
    payload: {
      market: marketType,
      indexPrice: orderBook.indexPrice,
      markPrice: orderBook.markPrice,
      liquidationResults,
      fundingSettlement,
    },
  };
}
