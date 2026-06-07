import { handleFillCreated } from "./handlers/fill-created";
import { handleLiquidationExecuted } from "./handlers/liquidation-executed";
import { handleOrderCancelled } from "./handlers/order-cancelled";
import { handleOrderCreated } from "./handlers/order-create";

import type { EngineEventType } from "./types";

export async function processEvent(
  eventType: EngineEventType,
  payload: Record<string, unknown>,
) {
  switch (eventType) {
    case "order_created":
      await handleOrderCreated(payload as any);
      break;

    case "order_cancelled":
      await handleOrderCancelled(payload as any);
      break;

    case "fill_created":
      await handleFillCreated(payload as any);
      break;

    case "liquidation_executed":
      await handleLiquidationExecuted(payload as any);
      break;
  }
}
