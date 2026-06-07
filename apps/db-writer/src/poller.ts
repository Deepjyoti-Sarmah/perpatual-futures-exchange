import { subscriberClient } from "@perp-v1-boilerplate/redis";
import { ENGINE_EVENT_STREAM } from "@perp-v1-boilerplate/redis/engine-events";
import type { EngineEventType } from "./types";
import { handleOrderCreated } from "./handlers/order-create";
import { handleOrderCancelled } from "./handlers/order-cancelled";
import { handleFillCreated } from "./handlers/fill-created";
import { handleLiquidationExecuted } from "./handlers/liquidation-executed";

const DB_WRITER_GROUP = "db-writer-group";
const DB_WRITER_CONSUMER = `db-writer-${crypto.randomUUID()}`;
const MAX_RETRIES = 5;
const PENDING_IDLE_MS = 30_000;

type RedisStreamEntry = {
  id: string;
  message: Record<string, string>;
};

type RedisGroupReadResponse = Array<{
  name: string;
  message: RedisStreamEntry[];
}>;

async function ensureConsumerGroup() {
  await subscriberClient
    .xGroupCreate(ENGINE_EVENT_STREAM, DB_WRITER_GROUP, "0", { MKSTREAM: true })
    .catch((err: Error) => {
      if (!err.message.includes("BUSYGROUP")) {
        throw err;
      }
    });
}

async function processMessage(entry: RedisStreamEntry) {
  const eventType = entry.message.eventType as EngineEventType | undefined;
  const rawPayload = entry.message.payload;

  if (!eventType || !rawPayload) {
    console.warn("Malformed event:", entry.id);
    return;
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(rawPayload) as Record<string, unknown>;
  } catch {
    console.warn("Bad json payload for event:", eventType, entry.id);
    return;
  }

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
    default:
      console.warn("unknown event type:", eventType);
  }
}

async function handleWithRetry(
  entry: RedisStreamEntry,
): Promise<"ack" | "nack"> {
  try {
    await processMessage(entry);
    return "ack";
  } catch (err) {
    const pending = await subscriberClient.xPending(
      ENGINE_EVENT_STREAM,
      DB_WRITER_GROUP,
      { start: entry.id, end: entry.id, count: 1 },
    );

    const deliveryCount =
      Array.isArray(pending) && pending.length > 0
        ? ((pending[0] as { deliveryCount?: number })?.deliveryCount ?? 1)
        : 1;

    if (deliveryCount >= MAX_RETRIES) {
      console.error(
        `Dead-lettering ${entry.id} after ${deliveryCount} attempts:`,
        err,
      );
      return "ack";
    }

    console.warn(
      `Message ${entry.id} failed (attempt ${deliveryCount}/${MAX_RETRIES}):`,
      (err as Error).message,
    );
    return "nack";
  }
}

async function recoverPendingMessage() {
  try {
    const claimed = await subscriberClient.xAutoClaim(
      ENGINE_EVENT_STREAM,
      DB_WRITER_GROUP,
      DB_WRITER_CONSUMER,
      PENDING_IDLE_MS,
      "0-0",
      { COUNT: 100 },
    );

    const message =
      (claimed as { messages?: RedisStreamEntry[] }).messages ?? [];
    if (message.length > 0) {
      console.log(`Recovered ${message.length} pending message(s)`);
    }

    for (const entry of message) {
      const result = await handleWithRetry(entry);

      if (result === "ack") {
        await subscriberClient.xAck(
          ENGINE_EVENT_STREAM,
          DB_WRITER_GROUP,
          entry.id,
        );
      }
    }
  } catch (error) {
    console.error("Error recovering pending message:", error);
  }
}

export async function startDbWriter() {
  await ensureConsumerGroup();
  console.log(`DB writer started - consumer: ${DB_WRITER_CONSUMER}`);

  await recoverPendingMessage();
  setInterval(() => recoverPendingMessage().catch(console.error), 60_000);

  for (; ;) {
    try {
      const raw = (await subscriberClient.xReadGroup(
        DB_WRITER_GROUP,
        DB_WRITER_CONSUMER,
        [{ key: ENGINE_EVENT_STREAM, id: ">" }],
        { BLOCK: 5000, COUNT: 50 },
      )) as RedisGroupReadResponse | null;

      if (!raw) {
        continue;
      }

      for (const stream of raw) {
        for (const entry of stream.message) {
          const result = await handleWithRetry(entry);
          if (result === "ack") {
            await subscriberClient.xAck(
              ENGINE_EVENT_STREAM,
              DB_WRITER_GROUP,
              entry.id,
            );
          }
        }
      }
    } catch (error) {
      console.error("DB writer loop error, retrying in 2s...", error);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
