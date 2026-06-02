import type { getOrderBook } from "./get-orderbook";

export function restInOrderBook(
  orderBook: ReturnType<typeof getOrderBook>,
  orderId: string,
  userId: string,
  type: "long" | "short",
  price: number,
  qty: number,
) {
  const priceKey = price.toString();
  const bookSide = type === "long" ? "bids" : "asks";

  if (!orderBook[bookSide][priceKey]) {
    orderBook[bookSide][priceKey] = { availableQty: 0, openOrders: [] };
  }

  orderBook[bookSide][priceKey].availableQty += qty;
  orderBook[bookSide][priceKey].openOrders.push({
    userId,
    qty,
    filledQty: 0,
    orderId,
    createdAt: new Date(),
  });
}
