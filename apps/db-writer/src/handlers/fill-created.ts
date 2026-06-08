import prisma from "@perp-v1-boilerplate/db";
import { getMarketId } from "../cache/market-cache";
import type { FillCreatedPayload } from "../types";

export async function handleFillCreated(payload: FillCreatedPayload) {
  const { fillId, makerOrderId, takerOrderId, market, qty, price } = payload;

  const makerOrder = await prisma.order.findUnique({
    where: { id: makerOrderId },
  });
  const takerOrder = await prisma.order.findUnique({
    where: { id: takerOrderId },
  });

  if (!makerOrder || !takerOrder) {
    throw new Error(
      `fill_created: order not found (maker=${makerOrderId} taker=${takerOrderId}) — will retry`,
    );
  }

  const marketId = getMarketId(market);

  // idempotency guard
  const existing = await prisma.fill.findUnique({
    where: { fillId },
  });

  if (existing) {
    return;
  }

  await prisma.fill.create({
    data: {
      qty: qty,
      price: price,
      makerId: makerOrder.id,
      takerId: takerOrder.id,
      userId: takerOrder.userId,
      marketId,
      orderId: takerOrder.id,
    },
  });
}
