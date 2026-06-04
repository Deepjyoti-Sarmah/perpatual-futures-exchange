import type { EngineUser, Position } from "@perp-v1-boilerplate/commons";
import { orderBooks } from "@/store/engine-store";

export function checkLiquidation(
  user: EngineUser,
  position: Position,
  maintenanceMarginRate = 0.005,
) {
  const orderBook = orderBooks[position.market];
  const markPrice =
    orderBook?.markPrice || orderBook?.indexPrice || orderBook?.lastTradedPrice;

  if (!markPrice || markPrice <= 0) {
    return {
      shouldLiquidate: false,
      markPrice: 0,
      positionNotional: 0,
      maintenanceMargin: 0,
      equity: 0,
    };
  }

  const positionNotional = position.qty * markPrice;
  const maintenanceMargin = positionNotional * maintenanceMarginRate;
  const equity = position.margin + (position.pnL || 0);

  return {
    shouldLiquidate: equity <= maintenanceMargin,
    markPrice,
    positionNotional,
    maintenanceMargin,
    equity,
  };
}
