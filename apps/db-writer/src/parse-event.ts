import type { EngineEventType } from "./types";

type RedisStreamEntry = {
  id: string;
  message: Record<string, string>;
};

export function parseEvent(entry: RedisStreamEntry) {
  const eventType = entry.message.eventType as EngineEventType | undefined;

  const rawPayload = entry.message.payload;

  if (!eventType) {
    throw new Error(`Missing eventType for event ${entry.id}`);
  }

  if (!rawPayload) {
    throw new Error(`Missing payload for event ${entry.id}`);
  }

  return {
    id: entry.id,
    eventType,
    payload: JSON.parse(rawPayload) as Record<string, unknown>,
  };
}
