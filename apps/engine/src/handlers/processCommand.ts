import { cancelOrder } from "../services/cancel-order";
import { createMarket } from "../services/create-market";
import { createOrder } from "../services/create-order";
import { getDepth } from "../services/get-depth";
import { getUserBalance } from "../services/get-user-balance";
import { onRamp } from "../services/on-ramp";
import { seedUser } from "../services/seed-user";

export type HandleResult = {
  ok: boolean;
  payload?: unknown;
  error?: string;
};

export async function processCommand(
  type: string,
  payload: Record<string, unknown>,
): Promise<HandleResult> {
  switch (type) {
    case "seed_user":
      return seedUser(payload as any);
    case "create_market":
      return createMarket(payload as any);
    case "on_ramp":
      return onRamp(payload as any);
    case "get_depth":
      return getDepth(payload as any);
    case "get_user_balance":
      return getUserBalance(payload as any);
    case "create_order":
      return await createOrder(payload as any);
    case "cancel_order":
      return cancelOrder(payload as any);
    default:
      return { ok: false, error: `Unknown command: ${type}` };
  }
}
