import { getOrderBook } from "@/handlers/get-orderbook";
import { users } from "@/store/engine-store";
import type { Order } from "@perp-v1-boilerplate/commons";
import { randomUUIDv5, randomUUIDv7 } from "bun";

export function createOrder(payload: {
  userId: string;
  marketType: "SOL" | "ETH" | "BTC";
  type: "long" | "short";
  price: number;
  qty: number;
  side: "market" | "limit";
  margin: number;
  slippage: number;
}) {
  //1- validate user
  const { userId, marketType, type, price, qty, side, margin, slippage } =
    payload;

  const user = users.get(userId);
  if (!user) {
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
      const bestBid = Object.keys(orderBook.bids)
        .map(Number)
        .sort((a, b) => b - a)[0];

      estimatedPrice = bestBid ?? orderBook.indexPrice;
    }
  }

  if (!estimatedPrice || estimatedPrice <= 0) {
    return { ok: false, payload: "Cannot determine price for order" };
  }

  // 5 - slippage (market order)
  const hasSlipppageGuard = side === "market" && slippage > 0;
  const slippageFactor = slippage / 100;

  const maxAcceptablePrice =
    type === "long"
      ? estimatedPrice * (1 + slippageFactor)
      : estimatedPrice * (1 - slippageFactor);

  // 6 - leverage from margin
  const leverage = (estimatedPrice * qty) / margin;

  // 7 - Check and lock collateral
  if (user.collateral.available < margin) {
    return { ok: false, payload: "Insufficient collateral" };
  }

  user.collateral.available -= margin;
  user.collateral.locked += margin;

  // 8 - Build order object
  const orderId = randomUUIDv7();

  const order: Order = {
    orderId,
    market: marketType,
    type: type === "long" ? "LONG" : "SHORT",
    qty,
    margin,
    side,
    price: side === "limit" ? price : undefined,
    status: "open",
    fillQty: 0,
  };

  // 9 - Match against order book
  
}
