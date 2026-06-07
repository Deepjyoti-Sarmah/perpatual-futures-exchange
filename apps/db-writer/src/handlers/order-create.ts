import prisma from "@perp-v1-boilerplate/db";
import type { OrderCreatedPayload } from "../types";
import { mapOrderStatus, mapOrderType, mapSide } from "./map-order";

export async function handleOrderCreated(
  payload: OrderCreatedPayload,
): Promise<void> {
  const {
    userId,
    orderId,
    marketType,
    side,
    type,
    qty,
    price,
    margin,
    status,
    fillQty,
  } = payload;

  const market = await prisma.market.findFirst({
    where: { symbol: marketType },
  });
  if (!market) {
    throw new Error(`Market not found for symbol ${marketType} — will retry`);
  }

  await prisma.order.upsert({
    where: { id: orderId },
    create: {
      id: orderId,
      marketType,
      type: mapOrderType(type),
      side: mapSide(side),
      status: mapOrderStatus(status),
      qty: qty,
      price: price ?? null,
      margin,
      fillQty,
      userId,
      marketId: market.id,
    },
    update: {
      status: mapOrderStatus(status),
      fillQty,
    },
  });
}
