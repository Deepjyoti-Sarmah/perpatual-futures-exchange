import type { EngineUser } from "@perp-v1-boilerplate/commons";
import { MAINTENANCE_MARGIN_RATE } from "@/constants/risk";
import { recalculatePnl } from "./calculate-Pnl";

type UpdatePositionParams = {
	user: EngineUser;
	marketType: "SOL" | "ETH" | "BTC";
	type: "LONG" | "SHORT";
	fillPrice: number;
	fillQty: number;
	fillMargin: number;
};

export function updatePosition(params: UpdatePositionParams) {
	const { user, marketType, type, fillPrice, fillQty, fillMargin } = params;

	const position = user.positions.find(
		(p) => p.market === marketType && p.type === type,
	);

	if (!position) {
		const liqPrice =
			type === "LONG"
				? fillPrice - fillMargin / fillQty + fillPrice * MAINTENANCE_MARGIN_RATE
				: fillPrice +
					fillMargin / fillQty -
					fillPrice * MAINTENANCE_MARGIN_RATE;

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
				? newAvgPrice -
					newMargin / totalQty +
					newAvgPrice * MAINTENANCE_MARGIN_RATE
				: newAvgPrice +
					newMargin / totalQty -
					newAvgPrice * MAINTENANCE_MARGIN_RATE;

		position.averagePrice = newAvgPrice;
		position.qty = totalQty;
		position.margin = newMargin;
		position.liquidationPrice = liqPrice;
	}

	user.collateral.locked += fillMargin;
	recalculatePnl(user);
}
