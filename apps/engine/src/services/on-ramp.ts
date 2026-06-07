import type { HandleResult } from "@/handlers/processCommand";
import { users } from "@/store/engine-store";

export function onRamp(payload: {
	userId: string;
	username?: string;
	amount: number;
}): HandleResult {
	const { userId, username, amount } = payload;

	if (amount <= 0) {
		return { ok: false, error: "amount must be greater than 0" };
	}

	let user = users.get(userId);

	if (!user) {
		user = {
			userId,
			username,
			collateral: {
				available: 0,
				locked: 0,
			},
			reservedOrderMargin: 0,
			positions: [],
			orders: [],
		};

		users.set(userId, user);
	}

	user.collateral.available += amount;

	return {
		ok: true,
		payload: {
			userId: user.userId,
			collateral: user.collateral,
			reservedOrderMargin: user.reservedOrderMargin,
		},
	};
}
