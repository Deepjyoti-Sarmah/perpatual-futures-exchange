import prisma from "@perp-v1-boilerplate/db";
import type { LiquidationExecutedPayload } from "../types";
import { handleFillCreated } from "./fill-created";

export async function handleLiquidationExecuted(
  payload: LiquidationExecutedPayload,
) {
  const { cancelledOrderIds, fills } = payload;

  if (cancelledOrderIds.length > 0) {
    await prisma.order.updateMany({
      where: {
        id: {
          in: cancelledOrderIds,
        },
      },
      data: { status: "CANCELLED" },
    });
  }

  for (const fill of fills) {
    await handleFillCreated(fill);
  }
}
