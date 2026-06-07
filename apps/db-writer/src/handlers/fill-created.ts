import prisma from "@perp-v1-boilerplate/db";
import type { FillCreatedPayload } from "src/types";

export async function handleFillCreated(payload: FillCreatedPayload) {
  const { maker, taker, market, qty, price } = payload;

  const marketRow = await prisma.market.findFirst({
    where: { symbol: market },
  });
  if (!marketRow) {
    throw new Error(`fill_created: market ${market} not  in DB - will retry`);
  }

  const makerOrder = await prisma.order.findFirst({
    where: {
      userId: maker,
      marketId: marketRow.id,
      status: {
        in: ["OPEN", "PARTIALLY_FILLED", "FILLED"],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const takerOrder = await prisma.order.findFirst({
    where: {
      userId: taker,
      marketId: marketRow.id,
      status: {
        in: ["OPEN", "PARTIALLY_FILLED", "FILLED"],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!makerOrder || !takerOrder) {
    throw new Error(
      `fill_created: maker/taker order not in DB (maker = ${maker} taker=${taker} - will retry)`,
    );
  }

  // idempotency guaed - avoid duplicates on stream re-deliery
  const existing = await prisma.fill.findFirst({
    where: { makerId: makerOrder.id, takerId: takerOrder.id, qty, price },
  });
  if (existing) {
    return;
  }

  await prisma.fill.create({
    data: {
      qty,
      price,
      makerId: makerOrder.id,
      takerId: takerOrder.id,
      userId: taker,
      marketId: marketRow.id,
      orderId: takerOrder.id,
    },
  });
}
