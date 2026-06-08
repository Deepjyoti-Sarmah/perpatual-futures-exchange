import prisma from "@perp-v1-boilerplate/db";
import type { OrderCancelledPayload } from "../types";

export async function handleOrderCancelled(payload: OrderCancelledPayload) {
  const existing = await prisma.order.findUnique({
    where: { id: payload.orderId },
  });
  if (!existing) {
    console.warn(
      `order_cancelled: order ${payload.orderId} not in DB - skipping`,
    );
    return;
  }

  await prisma.order.update({
    where: { id: payload.orderId },
    data: { status: "CANCELLED" },
  });
}
