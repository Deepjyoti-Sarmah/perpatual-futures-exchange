import type { HandleResult } from "@/handlers/processCommand";
import { users } from "@/store/engine-store";
import type { Collateral } from "@perp-v1-boilerplate/commons";

export function onRamp(payload: {
  userId: string;
  collateral: Collateral;
}): HandleResult {
  const { userId, collateral } = payload;

  if (!users.has(userId)) {
    return { ok: false, payload: "User does not exists" };
  }

  users.set(userId, {
    userId,
    collateral,
    positions: [],
    orders: [],
  });

  return {ok: true, payload: users.get(userId)}
}
