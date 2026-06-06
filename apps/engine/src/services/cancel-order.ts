import type { HandleResult } from "@/handlers/processCommand";
import { orderBooks, users } from "@/store/engine-store";

export function cancelOrder(payload: {
  userId: string;
  orderId: string;
  marketType: "SOL" | "ETH" | "BTC";
}): HandleResult {
  const { userId, orderId, marketType } = payload;

  //1 validate user
  const user = users.get(userId);
  if (!user) {
    return { ok: false, error: "User doesnot exists" };
  }

  //2 find order
  const order = user.orders.find((o) => o.orderId === orderId);

  if (!order) {
    return { ok: false, error: "Order does not exists" };
  }

  // 3 validate maarket
  if (order?.market !== marketType) {
    return { ok: false, error: "Order does not belong to this market" };
  }

  // 4 only open / partially filled limit order
  if (order.side !== "limit") {
    return { ok: false, error: "Only limit orders can be cancelled" };
  }

  if (order.status !== "open" && order.status !== "partially_filled") {
    return { ok: false, error: "Oder is not cancelled" };
  }

  if (order.price == null) {
    return { ok: false, error: "Limit order price missing" };
  }

  // 5 orderbook lookup
  const orderBook = orderBooks[marketType];
  if (!orderBook) {
    return { ok: false, error: "Orderbook not found" };
  }

  const priceKey = order.price.toString();
  const orderBookSide = order.type === "LONG" ? orderBook.bids : orderBook.asks;

  const level = orderBookSide[priceKey];
  if (!level) {
    return { ok: false, error: "Order is not resting in orderbook" };
  }

  const restingOrderIndex = level.openOrders.findIndex(
    (o) => o.orderId === orderId,
  );

  if (restingOrderIndex === -1) {
    return { ok: false, error: "Order is not resting in orderBook" };
  }

  // 6 compute remaining qty from the synced user order
  const remainingQty = order.qty - order.fillQty;

  if (remainingQty <= 0) {
    order.status = "filled";
    return { ok: false, error: "Order already fully filled" };
  }

  // 7 remove from price level
  level.availableQty -= remainingQty;
  level.openOrders.splice(restingOrderIndex, 1);

  if (level.availableQty <= 0 || level.openOrders.length === 0) {
    delete orderBookSide[priceKey];
  }

  // 8 release remaining margin only
  const releasedMargin = (order.margin * remainingQty) / order.qty;

  user.collateral.locked -= releasedMargin;
  user.collateral.available += releasedMargin;

  if (user.collateral.locked < 0) {
    user.collateral.locked = 0;
  }

  // 9 update order status
  order.status = "cancelled";

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
      collateral: {
        available: user.collateral.available,
        locked: user.collateral.locked,
      },
    },
  };
}
