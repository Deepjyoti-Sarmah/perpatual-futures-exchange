import { users } from "@/store/engine-store";
import { recalculatePnl } from "./calculate-Pnl";

type UpdatePositionParams = {
  userId: string;
  marketType: "SOL" | "ETH" | "BTC";
  type: "LONG" | "SHORT";
  fillPrice: number;
  fillQty: number;
  fillMargin: number;
};

export function updatePosition(params: UpdatePositionParams) {
  const { userId, marketType, type, fillPrice, fillQty, fillMargin } = params;

  const user = users.get(userId);
  if (!user) {
    return;
  }

  let position = user.positions.find(
    (p) => p.market === marketType && p.type === type,
  );

  if (!position) {
    const liqPrice =
      type === "LONG"
        ? fillPrice - fillMargin / fillQty + fillPrice * 0.005
        : fillPrice + fillMargin / fillQty - fillPrice * 0.005;

    user.positions.push({
      market: marketType,
      type: type,
      qty: fillQty,
      averagePrice: fillPrice,
      margin: fillMargin,
      liquidationPrice: liqPrice,
      pnL: 0,
    });
  } else {
    const totalQty = position.qty + fillQty;
    const newAvgPrice =
      (position.averagePrice * position.qty + fillPrice * fillQty) / totalQty;
    const newMargin = position.margin + fillMargin;

    const liqPrice =
      type === "LONG"
        ? newAvgPrice - newMargin / totalQty + newAvgPrice * 0.005
        : newAvgPrice + newMargin / totalQty - newAvgPrice * 0.005;

    position.averagePrice = newAvgPrice;
    position.qty = totalQty;
    position.margin = newMargin;
    position.liquidationPrice = liqPrice;
  }

  recalculatePnl(userId);
}
