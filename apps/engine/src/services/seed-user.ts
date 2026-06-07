import type { Collateral } from "@perp-v1-boilerplate/commons";
import type { HandleResult } from "../handlers/processCommand";
import { users } from "../store/engine-store";

export function seedUser(payload: {
	userId: string;
	collateral: Collateral;
	username?: string;
}): HandleResult {
	const { userId, collateral, username } = payload;

	if (users.has(userId)) {
		return { ok: false, error: "User already exists" };
	}

	users.set(userId, {
		userId,
		username,
		collateral: {
			available: collateral.available,
			locked: 0,
		},
		reservedOrderMargin: 0,
		positions: [],
		orders: [],
	});

	return {
		ok: true,
		payload: users.get(userId),
	};
}
