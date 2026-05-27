import type { EngineUser, Orderbooks } from "@perp-v1-boilerplate/commons";

export const users: Map<string, EngineUser> = new Map();
export const orderBooks: Orderbooks = {};
// {"SOL": Orderbook, "ETH": Orderbook, ...}
