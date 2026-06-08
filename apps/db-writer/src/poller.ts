import { subscriberClient } from "@perp-v1-boilerplate/redis";
import { ENGINE_EVENT_STREAM } from "@perp-v1-boilerplate/redis/engine-events";

import { eventBuffer } from "./buffer";
import { flushBuffer } from "./flusher";
import { parseEvent } from "./parse-event";

const DB_WRITER_GROUP = "db-writer-group";
const DB_WRITER_CONSUMER = `db-writer-${crypto.randomUUID()}`;

const PENDING_IDLE_MS = 30_000;

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
    .xGroupCreate(ENGINE_EVENT_STREAM, DB_WRITER_GROUP, "0", {
      MKSTREAM: true,
    })
    .catch((err: Error) => {
      if (!err.message.includes("BUSYGROUP")) {
        throw err;
      }
    });
}

async function recoverPendingMessages() {
  try {
    const claimed = await subscriberClient.xAutoClaim(
      ENGINE_EVENT_STREAM,
      DB_WRITER_GROUP,
      DB_WRITER_CONSUMER,
      PENDING_IDLE_MS,
      "0-0",
      {
        COUNT: 100,
      },
    );

    const messages =
      (claimed as { messages?: RedisStreamEntry[] }).messages ?? [];

    if (messages.length > 0) {
      console.log(`Recovered ${messages.length} pending message(s)`);
    }

    for (const entry of messages) {
      try {
        const event = parseEvent(entry);

        eventBuffer.push(event);
      } catch (error) {
        console.error("Failed to parse recovered event:", entry.id, error);
      }
    }

    if (eventBuffer.length >= 100) {
      await flushBuffer();
    }
  } catch (error) {
    console.error("Error recovering pending messages:", error);
  }
}

export async function startDbWriter() {
  await ensureConsumerGroup();

  console.log(`DB writer started - consumer: ${DB_WRITER_CONSUMER}`);

  await recoverPendingMessages();

  setInterval(() => {
    recoverPendingMessages().catch(console.error);
  }, 60_000);

  for (; ;) {
    try {
      const raw = (await subscriberClient.xReadGroup(
        DB_WRITER_GROUP,
        DB_WRITER_CONSUMER,
        [
          {
            key: ENGINE_EVENT_STREAM,
            id: ">",
          },
        ],
        {
          BLOCK: 5000,
          COUNT: 50,
        },
      )) as RedisGroupReadResponse | null;

      if (!raw) {
        continue;
      }

      for (const stream of raw) {
        for (const entry of stream.messages) {
          try {
            const event = parseEvent(entry);

            eventBuffer.push(event);

            if (eventBuffer.length >= 100) {
              await flushBuffer();
            }
          } catch (error) {
            console.error("Failed to parse event:", entry.id, error);
          }
        }
      }
    } catch (error) {
      console.error("DB writer loop error, retrying in 2s...", error);

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}
