export type Collateral = {
  available: number;
  locked: number;
};

export type Position = {
  market: string;
  type: "LONG" | "SHORT";
  qty: number;
  margin: number;
  liquidationPrice: number;
  averagePrice: number;
  pnL?: number;
};

export type Order = {
  orderId: string;
  market: "SOL" | "ETH" | "BTC";
  type: "LONG" | "SHORT";
  qty: number;
  margin: number;
  side: "limit" | "market";
  price?: number;
  status: "filled" | "cancelled" | "open" | "partially_filled";
  fillQty: number;
};

export type EngineUser = {
  userId: string;
  username?: string;
  collateral: Collateral;
  reservedOrderMargin: number;
  positions: Position[];
  orders: Order[];
};

export type Fill = {
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

export type PriceLevel = {
  availableQty: number;
  openOrders: {
    userId: string;
    qty: number;
    filledQty: number;
    orderId: string;
    createdAt: Date;
    remainingMargin: number;
  }[];
};

export type Orderbook = {
  bids: Record<string, PriceLevel>; //price (string key) -> Bid/Ask (level)
  asks: Record<string, PriceLevel>;
  lastTradedPrice: number;
  indexPrice: number;
  markPrice: number;
  fundingRate: number;
  lastFundingTime: number;
  nextFundingTime: number;
};

export type Orderbooks = Record<string, Orderbook>;
