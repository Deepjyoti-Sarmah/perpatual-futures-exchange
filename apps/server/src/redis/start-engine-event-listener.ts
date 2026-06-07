import { subscriberClient } from "@perp-v1-boilerplate/redis";
import { ENGINE_EVENT_STREAM } from "@perp-v1-boilerplate/redis/engine-events";
import { pendingResponse } from "@perp-v1-boilerplate/redis/send-to-engine";

type RedisReadResponse = Array<{
  name: string;
  messages: Array<{
    id: string;
    message: Record<string, string>;
  }>;
}>;

export async function listenForEngineEvents() {
  console.log(`Listening for engine events on ${ENGINE_EVENT_STREAM}`);

  let lastId = "$";

  for (; ;) {
    try {
      const raw = (await subscriberClient.xRead(
        [
          {
            key: ENGINE_EVENT_STREAM,
            id: lastId,
          },
        ],
        {
          BLOCK: 0,
          COUNT: 100,
        },
      )) as RedisReadResponse | null;

      if (!raw) continue;

      for (const stream of raw) {
        for (const { id, message } of stream.messages) {
          lastId = id;

          const correlationId = message.correlationId;

          if (!correlationId) {
            continue;
          }

          const pending = pendingResponse.get(correlationId);

          if (!pending) {
            continue;
          }

          clearTimeout(pending.timeout);
          const eventType = message.eventType;

          const payload = message.payload ? JSON.parse(message.payload) : {};

          if (
            eventType !== "command_succeeded" &&
            eventType !== "command_failed"
          ) {
            continue;
          }

          pending.resolve({
            correlationId,
            ok: eventType === "command_succeeded",
            payload: payload.payload,
            error: payload.error,
          });
        }
      }
    } catch (error) {
      console.error(error);
    }
  }
}
