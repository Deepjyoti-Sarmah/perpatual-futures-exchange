import type { Collateral } from "@perp-v1-boilerplate/commons";
import type { HandleResult } from "../handlers/processCommand";
import { users } from "../store/engine-store";

export function seedUser(payload: {
  userId: string;
  username: string;
  collateral: Collateral;
}): HandleResult {
  const { userId, username, collateral } = payload;

  if (users.has(userId)) {
    return { ok: false, error: "User already exists" };
  }

  users.set(userId, {
    userId,
    username: username || userId,
    collateral,
    positions: [],
    orders: [],
  });

  return {
    ok: true,
    payload: users.get(userId),
  };
}
