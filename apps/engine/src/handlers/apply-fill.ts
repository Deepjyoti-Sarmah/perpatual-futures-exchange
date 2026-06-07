import type { EngineUser } from "@perp-v1-boilerplate/commons";
import { reducePosition } from "./reduce-position";
import { updatePosition } from "./update-positions";

type ApplyFillParams = {
  user: EngineUser;
  marketType: "SOL" | "ETH" | "BTC";
  incomingType: "LONG" | "SHORT";
  fillPrice: number;
  fillQty: number;
  fillMargin: number;
};

export function applyFillToUser(params: ApplyFillParams) {
  const { user, marketType, incomingType, fillPrice, fillQty, fillMargin } =
    params;

  const oppositeType = incomingType === "LONG" ? "SHORT" : "LONG";

  const oppositePosition = user.positions.find(
    (p) => p.market === marketType && p.type === oppositeType,
  );

  let remainingQty = fillQty;
  let remainingMargin = fillMargin;
  const reductions: unknown[] = [];

  if (oppositePosition && oppositePosition.qty > 0) {
    const reducibleQty = Math.min(oppositePosition.qty, remainingQty);
    const proportionalMargin = (fillMargin * reducibleQty) / fillQty;

    const reduceResult = reducePosition({
      user,
      marketType,
      type: oppositeType,
      closeQty: reducibleQty,
      closePrice: fillPrice,
    });

    if (!reduceResult.ok) {
      return reduceResult;
    }

    reductions.push(reduceResult.payload);
    remainingQty -= reducibleQty;
    remainingMargin -= proportionalMargin;
  }

  if (remainingQty > 0) {
    updatePosition({
      user,
      marketType,
      type: incomingType,
      fillPrice,
      fillQty: remainingQty,
      fillMargin: remainingMargin,
    });
  }

  return {
    ok: true,
    payload: {
      reductions,
      openedQty: remainingQty,
      openedMargin: remainingMargin,
    },
  };
}
