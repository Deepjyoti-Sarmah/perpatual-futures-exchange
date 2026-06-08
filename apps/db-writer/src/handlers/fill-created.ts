import prisma from "@perp-v1-boilerplate/db";
import type { FillCreatedPayload } from "../types";

export async function handleFillCreated(payload: FillCreatedPayload) {
  const { makerOrderId, takerOrderId, market, qty, price } = payload;

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

  const marketRow = await prisma.market.findFirst({
    where: { symbol: market },
  });
  if (!marketRow) {
    throw new Error(`fill_created: market ${market} not in DB — will retry`);
  }

  // idempotency guard
  const existing = await prisma.fill.findFirst({
    where: { makerId: makerOrder.id, takerId: takerOrder.id },
  });
  if (existing) return;

  await prisma.fill.create({
    data: {
      qty: qty,
      price: price,
      makerId: makerOrder.id,
      takerId: takerOrder.id,
      userId: takerOrder.userId,
      marketId: marketRow.id,
      orderId: takerOrder.id,
    },
  });
}
