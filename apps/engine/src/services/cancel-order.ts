import { emitEngineEvent } from "@perp-v1-boilerplate/redis/engine-events";
import type { HandleResult } from "@/handlers/processCommand";
import { orderBooks, users } from "@/store/engine-store";

export function cancelOrder(payload: {
	userId: string;
	orderId: string;
	marketType: "SOL" | "ETH" | "BTC";
}): HandleResult {
	const { userId, orderId, marketType } = payload;

	const user = users.get(userId);
	if (!user) {
		return { ok: false, error: "User does not exist" };
	}

	const order = user.orders.find((o) => o.orderId === orderId);

	if (!order) {
		return { ok: false, error: "Order does not exist" };
	}

	if (order.market !== marketType) {
		return {
			ok: false,
			error: "Order does not belong to this market",
		};
	}

	if (order.side !== "limit") {
		return {
			ok: false,
			error: "Only limit orders can be cancelled",
		};
	}

	if (order.status !== "open" && order.status !== "partially_filled") {
		return { ok: false, error: "Order is not cancellable" };
	}

	if (order.price == null) {
		return {
			ok: false,
			error: "Limit order price missing",
		};
	}

	const orderBook = orderBooks[marketType];
	if (!orderBook) {
		return { ok: false, error: "Orderbook not found" };
	}

	const priceKey = order.price.toString();
	const orderBookSide = order.type === "LONG" ? orderBook.bids : orderBook.asks;

	const level = orderBookSide[priceKey];
	if (!level) {
		return {
			ok: false,
			error: "Order is not resting in orderbook",
		};
	}

	const restingOrderIndex = level.openOrders.findIndex(
		(o) => o.orderId === orderId,
	);

	if (restingOrderIndex === -1) {
		return {
			ok: false,
			error: "Order is not resting in orderbook",
		};
	}

	const restingOrder = level.openOrders[restingOrderIndex];
	const remainingQty = order.qty - order.fillQty;

	if (!restingOrder) {
		return { ok: false, error: "Resting order missing" };
	}

	level.availableQty -= remainingQty;
	level.openOrders.splice(restingOrderIndex, 1);

	if (level.availableQty <= 0 || level.openOrders.length === 0) {
		delete orderBookSide[priceKey];
	}

	const releasedMargin = restingOrder.remainingMargin;

	user.reservedOrderMargin -= releasedMargin;
	if (user.reservedOrderMargin < 0) user.reservedOrderMargin = 0;

	user.collateral.locked -= releasedMargin;
	if (user.collateral.locked < 0) user.collateral.locked = 0;
	user.collateral.available += releasedMargin;
	order.status = "cancelled";

	void emitEngineEvent("order_cancelled", {
		userId,
		orderId,
		marketType,
		releasedMargin,
		cancelledQty: remainingQty,
	}).catch(console.error);

	return {
		ok: true,
		payload: {
			orderId: order.orderId,
			market: order.market,
			status: order.status,
			filledQty: order.fillQty,
			remainingQty: 0,
			cancelledQty: remainingQty,
			releasedMargin,
			collateral: user.collateral,
			reservedOrderMargin: user.reservedOrderMargin,
		},
	};
}
