import { emitEngineEvent } from "@perp-v1-boilerplate/redis/engine-events";
import type { HandleResult } from "@/handlers/processCommand";
import { orderBooks } from "@/store/engine-store";

export function createMarket(payload: { symbol: string }): HandleResult {
	const { symbol } = payload;

	if (orderBooks[symbol]) {
		return { ok: false, error: "Market already exists" };
	}

	const now = Date.now();

	orderBooks[symbol] = {
		bids: {},
		asks: {},
		lastTradedPrice: 0,
		indexPrice: 0,
		markPrice: 0,
		fundingRate: 0,
		lastFundingTime: 0,
		nextFundingTime: now + 60 * 1000,
	};

	void emitEngineEvent("market_created", {
		symbol,
		createdAt: now,
	}).catch(console.error);

	return { ok: true, payload: { symbol } };
}
