import prisma from "@perp-v1-boilerplate/db";
import { getMarketId } from "../cache/market-cache";
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

  const marketId = getMarketId(marketType);

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
      marketId,
    },
    update: {
      status: mapOrderStatus(status),
      fillQty,
    },
  });
}
