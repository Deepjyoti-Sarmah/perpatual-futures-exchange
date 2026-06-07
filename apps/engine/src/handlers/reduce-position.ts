import type { EngineUser } from "@perp-v1-boilerplate/commons";
import { recalculatePnl } from "./calculate-Pnl";
import { MAINTENANCE_MARGIN_RATE } from "@/constants/risk";

type ReducePositionParams = {
  user: EngineUser;
  marketType: "SOL" | "ETH" | "BTC";
  type: "LONG" | "SHORT";
  closeQty: number;
  closePrice: number;
};

export function reducePosition(params: ReducePositionParams) {
  const { user, marketType, type, closeQty, closePrice } = params;

  const positionIndex = user.positions.findIndex(
    (p) => p.market === marketType && p.type === type,
  );

  if (positionIndex === -1) {
    return { ok: false, error: "Position not found" };
  }

  const position = user.positions[positionIndex];
  if (!position) {
    return { ok: false, error: "Position not found" };
  }

  if (closeQty <= 0) {
    return {
      ok: false,
      error: "closeQty must be greater than 0",
    };
  }

  if (closePrice <= 0) {
    return {
      ok: false,
      error: "closePrice must be greater than 0",
    };
  }

  if (closeQty > position.qty) {
    return {
      ok: false,
      error: "closeQty exceeds position qty",
    };
  }

  const releasedMargin = (position.margin * closeQty) / position.qty;

  const realizedPnl =
    type === "LONG"
      ? (closePrice - position.averagePrice) * closeQty
      : (position.averagePrice - closePrice) * closeQty;

  user.wallet.available += releasedMargin + realizedPnl;

  const remainingQty = position.qty - closeQty;

  if (remainingQty === 0) {
    user.positions.splice(positionIndex, 1);
  } else {
    const remainingMargin = position.margin - releasedMargin;

    position.qty = remainingQty;
    position.margin = remainingMargin;

    const newLiquidationPrice =
      type === "LONG"
        ? position.averagePrice -
        remainingMargin / remainingQty +
        position.averagePrice * MAINTENANCE_MARGIN_RATE
        : position.averagePrice +
        remainingMargin / remainingQty -
        position.averagePrice * MAINTENANCE_MARGIN_RATE;

    position.liquidationPrice = newLiquidationPrice;
  }

  recalculatePnl(user);

  return {
    ok: true,
    payload: {
      userId: user.userId,
      market: marketType,
      type,
      closeQty,
      closePrice,
      releasedMargin,
      realizedPnl,
      collateral: {
        available: user.wallet.available,
      },
      remainingPosition:
        user.positions.find(
          (p) => p.market === marketType && p.type === type,
        ) || null,
    },
  };
}
