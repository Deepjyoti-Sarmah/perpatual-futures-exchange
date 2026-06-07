import { emitEngineEvent } from "@perp-v1-boilerplate/redis/engine-events";
import { recalculatePnl } from "@/handlers/calculate-Pnl";
import { getOrderBook } from "@/handlers/get-orderbook";
import type { HandleResult } from "@/handlers/processCommand";
import { users } from "@/store/engine-store";

export function settleFunding(payload: {
	marketType: "SOL" | "ETH" | "BTC";
}): HandleResult {
	const { marketType } = payload;

	const orderBook = getOrderBook(marketType);
	const markPrice =
		orderBook.markPrice || orderBook.indexPrice || orderBook.lastTradedPrice;

	if (!markPrice || markPrice <= 0) {
		return {
			ok: false,
			error: "Invalid mark price for funding settlement",
		};
	}

	const fundingRate = orderBook.fundingRate;

	const settlements: {
		userId: string;
		positionType: "LONG" | "SHORT";
		qty: number;
		payment: number;
		direction: "paid" | "received";
	}[] = [];

	let totalPaid = 0;
	let totalReceived = 0;

	for (const user of users.values()) {
		const positions = user.positions.filter((p) => p.market === marketType);

		for (const position of positions) {
			const positionNotional = position.qty * markPrice;
			const fundingPayment = positionNotional * Math.abs(fundingRate);

			if (fundingPayment <= 0) continue;

			const isPaying =
				(fundingRate > 0 && position.type === "LONG") ||
				(fundingRate < 0 && position.type === "SHORT");

			if (isPaying) {
				const actualPayment = Math.min(fundingPayment, position.margin);
				position.margin -= actualPayment;
				user.collateral.locked -= actualPayment;
				if (actualPayment < fundingPayment) {
					user.collateral.available -= fundingPayment - actualPayment;
				}
				totalPaid += fundingPayment;

				settlements.push({
					userId: user.userId,
					positionType: position.type,
					qty: position.qty,
					payment: fundingPayment,
					direction: "paid",
				});
			} else {
				user.collateral.available += fundingPayment;
				totalReceived += fundingPayment;

				settlements.push({
					userId: user.userId,
					positionType: position.type,
					qty: position.qty,
					payment: fundingPayment,
					direction: "received",
				});
			}

			recalculatePnl(user);
		}
	}

	orderBook.lastFundingTime = Date.now();
	orderBook.nextFundingTime = Date.now() + 60 * 1000;

	void emitEngineEvent("funding_settled", {
		marketType,
		fundingRate,
		settlements,
		totalPaid,
		totalReceived,
		markPrice,
		lastFundingTime: orderBook.lastFundingTime,
		nextFundingTime: orderBook.nextFundingTime,
	}).catch(console.error);

	return {
		ok: true,
		payload: {
			market: marketType,
			fundingRate,
			settlements,
			totalPaid,
			totalReceived,
			lastFundingTime: orderBook.lastFundingTime,
			nextFundingTime: orderBook.nextFundingTime,
		},
	};
}
