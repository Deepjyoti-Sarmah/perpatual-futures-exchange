import type { HandleResult } from "@/handlers/processCommand";
import { orderBooks } from "@/store/engine-store";

export function createMarket(payload: { symbol: string }): HandleResult {
  const { symbol } = payload;

  if (orderBooks[symbol]) {
    return { ok: false, error: "Market already exists" };
  }

  orderBooks[symbol] = {
    bids: {},
    asks: {},
    lastTradedPrice: 0,
    indexPrice: 0,
  };

  return { ok: true, payload: { symbol } };
}
