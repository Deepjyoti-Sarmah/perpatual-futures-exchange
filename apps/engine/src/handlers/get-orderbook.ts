import { orderBooks } from "@/store/engine-store";

export function getOrderBook(symbol: string) {
  if (!orderBooks[symbol]) {
    orderBooks[symbol] = {
      bids: {},
      asks: {},
      lastTradedPrice: 0,
      indexPrice: 0,
    };
  }

  return orderBooks[symbol];
}
