import type {
  EngineUser,
  Order,
  Orderbook,
  Orderbooks,
} from "@perp-v1-boilerplate/commons";

function ensureUser(
  users: Map<string, EngineUser>,
  userId: string,
): EngineUser {
  let user = users.get(userId);

  if (!user) {
    user = {
      userId,
      collateral: { available: 0, locked: 0 },
      reservedOrderMargin: 0,
      positions: [],
      orders: [],
    };
    users.set(userId, user);
  }

  return user;
}

function ensureOrderbook(orderBooks: Orderbooks, symbol: string): Orderbook {
  if (!orderBooks[symbol]) {
    orderBooks[symbol] = {
      bids: {},
      asks: {},
      lastTradedPrice: 0,
      indexPrice: 0,
      markPrice: 0,
      fundingRate: 0,
      lastFundingTime: 0,
      nextFundingTime: 0,
    };
  }

  return orderBooks[symbol];
}

export function handleMarketCreated(
  _users: Map<string, EngineUser>,
  orderBooks: Orderbooks,
  payload: Record<string, unknown>,
) {
  const symbol = payload.symbol as string;
  ensureOrderbook(orderBooks, symbol);
}

export function handleOrderCreated(
  users: Map<string, EngineUser>,
  _orderBooks: Orderbooks,
  payload: Record<string, unknown>,
) {
  const userId = payload.userId as string;
  const orderId = payload.orderId as string;
  const market = payload.marketType as string;
  const type = payload.type as string;
  const side = payload.side as string;
  const qty = payload.qty as number;
  const price = (payload.price as number | null) ?? undefined;
  const margin = payload.margin as number;
  const status = payload.status as string;
  const fillQty = payload.fillQty as number;

  const user = ensureUser(users, userId);

  const existing = user.orders.find((o) => o.orderId === orderId);
  if (existing) {
    existing.status = status as Order["status"];
    existing.fillQty = fillQty;
    return;
  }

  user.orders.push({
    orderId,
    market: market as Order["market"],
    type: type as Order["type"],
    side: side as Order["side"],
    qty,
    price,
    margin,
    status: status as Order["status"],
    fillQty,
  });
}

export function handleOrderCancelled(
  users: Map<string, EngineUser>,
  _orderBooks: Orderbooks,
  payload: Record<string, unknown>,
) {
  const userId = payload.userId as string;
  const orderId = payload.orderId as string;
  const releasedMargin = payload.releasedMargin as number;

  const user = users.get(userId);
  if (!user) return;

  const order = user.orders.find((o) => o.orderId === orderId);
  if (order) {
    order.status = "cancelled";
  }

  user.reservedOrderMargin = Math.max(
    0,
    user.reservedOrderMargin - releasedMargin,
  );
}

function applyFillToPosition(
  users: Map<string, EngineUser>,
  userId: string,
  market: string,
  incomingType: "LONG" | "SHORT",
  oppositeType: "LONG" | "SHORT",
  qty: number,
  price: number,
) {
  const user = users.get(userId);
  if (!user) return;

  const oppositePosition = user.positions.find(
    (p) => p.market === market && p.type === oppositeType,
  );

  let remainingQty = qty;

  if (oppositePosition && oppositePosition.qty > 0) {
    const reducibleQty = Math.min(oppositePosition.qty, remainingQty);
    oppositePosition.qty -= reducibleQty;
    remainingQty -= reducibleQty;

    if (oppositePosition.qty === 0) {
      user.positions = user.positions.filter(
        (p) => !(p.market === market && p.type === oppositeType),
      );
    }
  }

  if (remainingQty > 0) {
    let position = user.positions.find(
      (p) => p.market === market && p.type === incomingType,
    );

    if (!position) {
      position = {
        market,
        type: incomingType,
        qty: 0,
        margin: 0,
        liquidationPrice: 0,
        averagePrice: 0,
      };
      user.positions.push(position);
    }

    const totalQty = position.qty + remainingQty;
    position.averagePrice =
      totalQty > 0
        ? (position.averagePrice * position.qty + price * remainingQty) /
        totalQty
        : price;
    position.qty = totalQty;
  }
}

export function handleFillCreated(
  users: Map<string, EngineUser>,
  orderBooks: Orderbooks,
  payload: Record<string, unknown>,
) {
  const market = payload.market as string;
  const qty = payload.qty as number;
  const price = payload.price as number;
  const makerUserId = payload.maker as string;
  const takerUserId = payload.taker as string;
  const makerOrderId = payload.makerOrderId as string;
  const takerOrderId = payload.takerOrderId as string;
  const longUserId = payload.long as string;
  const shortUserId = payload.short as string;

  const makerUser = users.get(makerUserId);
  const takerUser = users.get(takerUserId);

  const makerOrder = makerUser?.orders.find((o) => o.orderId === makerOrderId);
  const takerOrder = takerUser?.orders.find((o) => o.orderId === takerOrderId);

  if (makerOrder) {
    makerOrder.fillQty = Math.min(makerOrder.qty, makerOrder.fillQty + qty);
    makerOrder.status =
      makerOrder.fillQty >= makerOrder.qty ? "filled" : "partially_filled";
  }

  if (takerOrder) {
    takerOrder.fillQty = Math.min(takerOrder.qty, takerOrder.fillQty + qty);
    takerOrder.status =
      takerOrder.fillQty >= takerOrder.qty ? "filled" : "partially_filled";
  }

  const book = ensureOrderbook(orderBooks, market);
  book.lastTradedPrice = price;

  applyFillToPosition(users, longUserId, market, "LONG", "SHORT", qty, price);
  applyFillToPosition(users, shortUserId, market, "SHORT", "LONG", qty, price);
}

export function handleLiquidationExecuted(
  users: Map<string, EngineUser>,
  orderBooks: Orderbooks,
  payload: Record<string, unknown>,
) {
  const userId = payload.userId as string;
  const cancelledOrderIds = payload.cancelledOrderIds as string[];

  const user = users.get(userId);
  if (!user) return;

  for (const orderId of cancelledOrderIds) {
    const order = user.orders.find((o) => o.orderId === orderId);
    if (order) {
      order.status = "cancelled";
    }
  }

  const fills = payload.fills as Array<Record<string, unknown>>;
  for (const fill of fills) {
    handleFillCreated(users, orderBooks, fill);
  }
}

export function handleMarketPriceUpdated(
  _users: Map<string, EngineUser>,
  orderBooks: Orderbooks,
  payload: Record<string, unknown>,
) {
  const marketType = payload.marketType as string;
  const book = ensureOrderbook(orderBooks, marketType);

  book.indexPrice = payload.indexPrice as number;
  book.markPrice = payload.markPrice as number;
  book.fundingRate = payload.fundingRate as number;
}

export function handleFundingSettled(
  _users: Map<string, EngineUser>,
  orderBooks: Orderbooks,
  payload: Record<string, unknown>,
) {
  const marketType = payload.marketType as string;
  const book = ensureOrderbook(orderBooks, marketType);

  book.fundingRate = payload.fundingRate as number;
  book.markPrice = payload.markPrice as number;
  book.lastFundingTime = payload.lastFundingTime as number;
  book.nextFundingTime = payload.nextFundingTime as number;
}
