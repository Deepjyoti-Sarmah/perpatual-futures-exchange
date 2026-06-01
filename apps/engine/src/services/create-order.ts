import { getOrderBook } from "@/handlers/get-orderbook";
import { users } from "@/store/engine-store";

export function createOrder(payload: {
  userId: string;
  marketType: "SOL" | "ETH" | "BTC";
  type: "long" | "short";
  price: number;
  side: "market" | "limit";
  margin: number;
  slippage: number;
}) {
  //1- validate user
  const { userId, marketType, type, price, side, margin, slippage } = payload;

  if (!users.has(userId)) {
    return { ok: false, payload: "User doesnot exists" };
  }

  //2 - Get or create orderbook
  const orderBook = getOrderBook(marketType);

  //3 - validate limit order price
  if (side === "limit" && (price == null || price <= 0)) {
    return { ok: false, payload: "limit order requires a valid price" };
  }

  // 4. Estimate price for  margin + leverage cal
  let estimatedPrice = price;

  if (side === "market") {
    if (type === "long") {
      // Buying -> match against asks -> cheapest ask
      const bestAsk = Object.keys(orderBook.asks)
        .map(Number)
        .sort((a, b) => a - b)[0];

      estimatedPrice = bestAsk ?? orderBook.indexPrice;
    } else {
      // Seling -> match against bids -> highest bid
    }
  }
}
