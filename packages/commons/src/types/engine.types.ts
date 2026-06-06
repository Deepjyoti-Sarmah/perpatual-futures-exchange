import type { Collateral } from "./engine-state.types";

export type EngineCommandType =
  | "seed_user"
  | "on_ramp"
  | "create_order"
  | "cancel_order"
  | "get_order"
  | "get_depth"
  | "get_user_balance"
  | "create_market"
  | "update_market_price"
  | "liquidate_position"
  | "settle_funding";

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
  marketType: "SOL" | "ETH" | "BTC";
}

export interface UpdateMarketPricePayload {
  marketType: "SOL" | "ETH" | "BTC";
  indexPrice: number;
  markPrice: number;
}

export interface LiquidatePositionPayload {
  userId: string;
  marketType: "SOL" | "ETH" | "BTC";
  positionType: "LONG" | "SHORT";
}

export interface SettleFundingPayload {
  marketType: "SOL" | "ETH" | "BTC";
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
  markPrice: number;
  fundingRate: number;
  lastFundingTime: number;
  nextFundingTime: number;
}
