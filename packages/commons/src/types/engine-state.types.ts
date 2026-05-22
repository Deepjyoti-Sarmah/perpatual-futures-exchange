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
  market: string;
  type: "LONG" | "SHORT";
  qty: number;
  margin: number;
  orderType: "limit" | "market";
  price: number;
  status: "filled" | "cancelled" | "open" | "partially_filled";
  fillQty: number;
};

export type EngineUser = {
  userId: string;
  username: string;
  collateral: Collateral;
  positions: Position[];
  orders: Order[];
};

export type Fill = {
  maker: string;
  taker: string;
  market: string;
  qty: number;
  price: number;
  long: string;
  short: string;
};

export type Bid = {
  availableQty: number;
  openOrders: {
    userId: string;
    qty: number;
    filledQty: number;
    orderId: string;
    createdAt: Date;
  }[];
};

export type Orderbook = {
  bids: Record<string, Bid>; //price (string key) -> Bid
  asks: Record<string, Bid>;
  lastTradedPrice: number;
  indexPrice: number;
};

export type Orderbooks = Record<string, Orderbook>;
