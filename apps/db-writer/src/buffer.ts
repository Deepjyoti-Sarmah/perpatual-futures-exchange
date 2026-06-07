import type { EngineEventType } from "./types";

export type BufferedEvent = {
  id: string;
  eventType: EngineEventType;
  payload: Record<string, unknown>;
};

export const eventBuffer: BufferedEvent[] = [];
