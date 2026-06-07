import { producerClient } from "../src";

export const ENGINE_EVENT_STREAM = "engine:events";
export const ENGINE_WS_CHANNEL = "engine:ws:broadcast";

export type EngineEventType =
  | "market_created"
  | "order_created"
  | "order_cancelled"
  | "fill_created"
  | "market_price_updated"
  | "funding_settled"
  | "liquidation_executed";

export async function emitEngineEvent(
  eventType: EngineEventType,
  payload: Record<string, unknown>,
  correlationId?: string,
) {
  const event = {
    eventId: crypto.randomUUID(),
    correlationId: correlationId ?? "",
    eventType,
    ts: String(Date.now()),
    payload: JSON.stringify(payload),
  };

  await producerClient.xAdd(ENGINE_EVENT_STREAM, "*", event);

  await producerClient.publish(
    ENGINE_WS_CHANNEL,
    JSON.stringify({
      ...event,
      payload,
    }),
  );
}
