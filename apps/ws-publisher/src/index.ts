import {
  connectRedis,
  producerClient,
  subscriberClient,
} from "@perp-v1-boilerplate/redis";
import {
  ENGINE_EVENT_STREAM,
  ENGINE_WS_CHANNEL,
} from "@perp-v1-boilerplate/redis/engine-events";

const WS_PUBLISHER_GROUP = "ws-publisher-group";
const WS_PUBLISHER_CONSUMER = `ws-publisher-${crypto.randomUUID()}`;

type RedisStreamEntry = {
  id: string;
  message: Record<string, string>;
};

type RedisGroupReadResponse = Array<{
  name: string;
  messages: RedisStreamEntry[];
}>;

async function ensureConsumerGroup() {
  await subscriberClient
    .xGroupCreate(ENGINE_EVENT_STREAM, WS_PUBLISHER_GROUP, "0", {
      MKSTREAM: true,
    })
    .catch((err: Error) => {
      if (!err.message.includes("BUSYGROUP")) {
        throw err;
      }
    });
}

async function main() {
  await connectRedis();

  console.log("WS Publisher connected to Redis");

  await ensureConsumerGroup();

  console.log(`WS Publisher started - consumer: ${WS_PUBLISHER_CONSUMER}`);

  for (; ;) {
    try {
      const raw = (await subscriberClient.xReadGroup(
        WS_PUBLISHER_GROUP,
        WS_PUBLISHER_CONSUMER,
        [{ key: ENGINE_EVENT_STREAM, id: ">" }],
        { BLOCK: 5000, COUNT: 50 },
      )) as RedisGroupReadResponse | null;

      if (!raw) {
        continue;
      }

      for (const stream of raw) {
        for (const entry of stream.messages) {
          try {
            await producerClient.publish(
              ENGINE_WS_CHANNEL,
              JSON.stringify({
                id: entry.id,
                eventType: entry.message.eventType,
                payload: entry.message.payload
                  ? JSON.parse(entry.message.payload)
                  : {},
              }),
            );

            await subscriberClient.xAck(
              ENGINE_EVENT_STREAM,
              WS_PUBLISHER_GROUP,
              entry.id,
            );
          } catch (error) {
            console.error("Failed to publish event:", entry.id, error);
          }
        }
      }
    } catch (error) {
      console.error("WS Publisher loop error, retrying in 2s...", error);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

main().catch(console.error);
