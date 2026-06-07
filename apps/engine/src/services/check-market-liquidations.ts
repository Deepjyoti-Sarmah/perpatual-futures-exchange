import { recalculatePnl } from "@/handlers/calculate-Pnl";
import { checkLiquidation } from "@/handlers/check-liquidation";
import type { HandleResult } from "@/handlers/processCommand";
import { users } from "@/store/engine-store";

export function checkMarketLiqidations(payload: {
	marketType: "SOL" | "ETH" | "BTC";
}): HandleResult {
	const { marketType } = payload;

	const liquidations: {
		userId: string;
		market: string;
		type: "LONG" | "SHORT";
		qty: number;
		markPrice: number;
		equity: number;
		maintenanceMargin: number;
	}[] = [];

	for (const user of users.values()) {
		recalculatePnl(user);

		for (const position of user.positions) {
			if (position.market !== marketType) {
				continue;
			}

			const result = checkLiquidation(user, position);

			if (result.shouldLiquidate) {
				liquidations.push({
					userId: user.userId,
					market: position.market,
					type: position.type,
					qty: position.qty,
					markPrice: result.markPrice,
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
			count: liquidations.length,
			liquidations,
		},
	};
}
