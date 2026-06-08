import type { EngineUser, Orderbooks } from "@perp-v1-boilerplate/commons";
import { connectRedis, subscriberClient } from "@perp-v1-boilerplate/redis";
import { ENGINE_EVENT_STREAM } from "@perp-v1-boilerplate/redis/engine-events";
import {
  handleFillCreated,
  handleFundingSettled,
  handleLiquidationExecuted,
  handleMarketCreated,
  handleMarketPriceUpdated,
  handleOrderCancelled,
  handleOrderCreated,
} from "./build-state";
import { loadSnapshort, saveSnapshort } from "./snapshort";
import { lastEventId, orderBooks, setLastEventId, users } from "./state";

const SNAPSHORT_INTERVAL_MS = 30_000;
const EVENTS_BETWEEN_SNAPSHORT = 100;

let eventsSinceLastSnapshort = 0;

type RedisStreamEntry = {
  id: string;
  message: Record<string, string>;
};

type RedisReadResponse = Array<{
  name: string;
  messages: RedisStreamEntry[];
}>;

const HANDLERS: Record<
  string,
  (
    users: Map<string, EngineUser>,
    orderBooks: Orderbooks,
    payload: Record<string, unknown>,
  ) => void
> = {
  market_created: handleMarketCreated,
  order_created: handleOrderCreated,
  order_cancelled: handleOrderCancelled,
  fill_created: handleFillCreated,
  liquidation_executed: handleLiquidationExecuted,
  market_price_updated: handleMarketPriceUpdated,
  funding_settled: handleFundingSettled,
};

async function processEvent(id: string, message: Record<string, string>) {
  const eventType = message.eventType;

  const handler = HANDLERS[eventType!];
  if (!handler) {
    return;
  }

  const payload = message.payload ? JSON.parse(message.payload) : {};
  handler(users, orderBooks, payload);

  setLastEventId(id);
  eventsSinceLastSnapshort++;

  if (eventsSinceLastSnapshort >= EVENTS_BETWEEN_SNAPSHORT) {
    await saveSnapshort(lastEventId, users, orderBooks);
    eventsSinceLastSnapshort = 0;
  }
}

async function replayFromStart() {
  console.log("Replaying events from start...");
  let startId = "0";

  const snapshot = await loadSnapshort();
  if (snapshot) {
    startId = snapshot.lastEventId;

    for (const [id, user] of Object.entries(snapshot.users)) {
      users.set(id, user);
    }
    Object.assign(orderBooks, snapshot.orderBooks);
    setLastEventId(snapshot.lastEventId);

    console.log(
      `Restored ${users.size} users and ${Object.keys(orderBooks).length} markets from snapshot`,
    );
  }

  let batchCount = 0;

  for (; ;) {
    const raw = (await subscriberClient.xRead(
      [{ key: ENGINE_EVENT_STREAM, id: startId }],
      { BLOCK: 0, COUNT: 500 },
    )) as RedisReadResponse | null;

    if (!raw) {
      break;
    }

    for (const stream of raw) {
      for (const entry of stream.messages) {
        await processEvent(entry.id, entry.message);
        startId = entry.id;
      }
    }

    batchCount++;
    if (batchCount > 100) {
      break;
    }

    await saveSnapshort(lastEventId, users, orderBooks);
    eventsSinceLastSnapshort = 0;

    console.log(`Replay complete. Last event: ${lastEventId}`);
  }
}

async function liveStream() {
  console.log("Starting live stream consuption...");

  for (; ;) {
    try {
      const raw = (await subscriberClient.xRead(
        [{ key: ENGINE_EVENT_STREAM, id: ">" }],
        { BLOCK: 5000, COUNT: 50 },
      )) as RedisReadResponse | null;

      if (!raw) {
        continue;
      }

      for (const stream of raw) {
        for (const entry of stream.messages) {
          await processEvent(entry.id, entry.message);
        }
      }
    } catch (error) {
      console.error("snapshort live stream error:", error);

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function main() {
  await connectRedis();
  console.log("snapshort connected to Redis");

  await replayFromStart();

  setInterval(async () => {
    await saveSnapshort(lastEventId, users, orderBooks);
  }, SNAPSHORT_INTERVAL_MS);

  await liveStream();
}

main().catch(console.error);
