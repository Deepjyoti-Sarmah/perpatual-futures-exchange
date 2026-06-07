import type { HandleResult } from "@/handlers/processCommand";
import { orderBooks } from "@/store/engine-store";

export function getDepth(payload: {
	marketType: "SOL" | "ETH" | "BTC";
}): HandleResult {
	const { marketType } = payload;

	const orderBook = orderBooks[marketType];

	if (!orderBook) {
		return { ok: false, error: "Orderbook not found" };
	}

	const bids: Record<string, number> = {};
	const asks: Record<string, number> = {};

	for (const [price, level] of Object.entries(orderBook.bids)) {
		bids[price] = level.availableQty;
	}

	for (const [price, level] of Object.entries(orderBook.asks)) {
		asks[price] = level.availableQty;
	}

	return {
		ok: true,
		payload: {
			market: marketType,
			bids,
			asks,
			lastTradePrice: orderBook.lastTradedPrice,
			indexPrice: orderBook.indexPrice,
			markPrice: orderBook.markPrice,
			fundingRate: orderBook.fundingRate,
			lastFundingTime: orderBook.lastFundingTime,
			nextFundingTime: orderBook.nextFundingTime,
		},
	};
}
