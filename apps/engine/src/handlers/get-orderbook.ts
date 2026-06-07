import { orderBooks } from "@/store/engine-store";

export function getOrderBook(symbol: string) {
	if (!orderBooks[symbol]) {
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
	}

	return orderBooks[symbol];
}
