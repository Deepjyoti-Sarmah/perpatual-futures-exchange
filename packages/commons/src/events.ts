export type EngineEventType =
  | "order_created"
  | "fill_created"
  | "position_updated"
  | "liquidation_executed";

export interface EngineEvent {
  type: EngineEventType;
  payload: string;
  timestamp: number;
}
