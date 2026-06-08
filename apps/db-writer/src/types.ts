export type EngineEventType =
  | "market_created"
  | "order_created"
  | "order_cancelled"
  | "fill_created"
  | "market_price_updated"
  | "funding_settled"
  | "liquidation_executed";

export type OrderCreatedPayload = {
  userId: string;
  orderId: string;
  marketType: "SOL" | "ETH" | "BTC";
  side: "limit" | "market";
  type: "long" | "short";
  qty: number;
  price: number | null;
  margin: number;
  status: "open" | "filled" | "partially_filled" | "cancelled";
  fillQty: number;
};

export type OrderCancelledPayload = {
  userId: string;
  orderId: string;
  marketType: "SOL" | "ETH" | "BTC";
  releasedMargin: number;
  cancelledQty: number;
};

export type FillCreatedPayload = {
  fillId: string;
  maker: string;
  taker: string;
  market: string;
  qty: number;
  price: number;
  long: string;
  short: string;
  makerOrderId: string;
  takerOrderId: string;
};

export type LiquidationExecutedPayload = {
  userId: string;
  marketType: "SOL" | "ETH" | "BTC";
  positionType: "LONG" | "SHORT";
  filledQty: number;
  remainingQty: number;
  fills: FillCreatedPayload[];
  cancelledOrderIds: string[];
};
