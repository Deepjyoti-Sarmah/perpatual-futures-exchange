import type { EngineUser, Orderbooks } from "@perp-v1-boilerplate/commons";

export const users = new Map<string, EngineUser>();
export const orderBooks: Orderbooks = {};
export let lastEventId = "0";
export let snapshortCount = 0;

export function setLastEventId(id: string) {
  lastEventId = id;
}

export function incrementSnapshotCount() {
  snapshortCount++;
}
