import {
  mullInternal,
  type EngineUser,
  type Position,
} from "@perp-v1-boilerplate/commons";
import { MAINTENANCE_MARGIN_RATE } from "@/constants/risk";
import { orderBooks } from "@/store/engine-store";

export function checkLiquidation(
  _user: EngineUser,
  position: Position,
  maintenanceMarginRate = MAINTENANCE_MARGIN_RATE,
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

  const positionNotional = mullInternal(position.qty, markPrice);
  const maintenanceMargin = Math.round(
    positionNotional * maintenanceMarginRate,
  );
  const equity = position.margin + (position.pnL || 0);

  return {
    shouldLiquidate: equity <= maintenanceMargin,
    markPrice,
    positionNotional,
    maintenanceMargin,
    equity,
  };
}
