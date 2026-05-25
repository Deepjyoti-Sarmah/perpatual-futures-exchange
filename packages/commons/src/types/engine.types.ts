import type { Collateral } from "./engine-state.types";

export type EngineCommandType =
  | "seed_user"
  | "create_order"
  | "cancel_order"
  | "get_order"
  | "get_depth"
  | "get_user_balance"
  | "create_market";

export interface EngineRequest {
  correlationId: string;
  responseStream: string;
  type: EngineCommandType;
  payload: Record<string, unknown>;
}

export interface EngineResponse {
  correlationId: string;
  ok: boolean;
  payload?: unknown;
  error?: string;
}

export interface CreateOrderPayload {
  userId: string;
  marketType: "SOL" | "ETH" | "BTC";
  type: "long" | "short";
  side: "limit" | "market";
  qty: number;
  price: number;
  margin: number;
  slippage?: number;
}

export interface CancelOrderPayload {
  userId: string;
  orderId: string;
  market: string;
}

export interface SeedUserResponse {
  userId: string;
  collateral: Collateral;
}

export interface GetDepthResponse {
  market: string;
  bids: Record<string, number>; //price -> available qyt
  asks: Record<string, number>;
  lastTradedPrice: number;
  indexPrice: number;
}
