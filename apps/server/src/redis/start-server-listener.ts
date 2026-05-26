import type { EngineResponse } from "@perp-v1-boilerplate/commons";
import { subscriberClient } from "@perp-v1-boilerplate/redis";
import {
  pendingResponse,
  RESPONSE_STREAM,
} from "@perp-v1-boilerplate/redis/send-to-engine";

type redisReadResponse = Array<{
  name: string;
  messages: Array<{
    id: string;
    message: Record<string, string>;
  }>;
}>;

export function resolveEngineResponse(response: EngineResponse) {
  const pending = pendingResponse.get(response.correlationId);
  if (!pending) return;

  clearTimeout(pending.timeout);
  pendingResponse.delete(response.correlationId);
  pending.resolve(response);
}

export async function listenForEngineResponse() {
  console.log(`Listening for engine response on ${RESPONSE_STREAM}`);

  let lastId = "$";

  for (;;) {
    try {
      const raw = (await subscriberClient.xRead(
        [
          {
            key: RESPONSE_STREAM,
            id: lastId,
          },
        ],
        { BLOCK: 0, COUNT: 1 },
      )) as redisReadResponse;

      if (!raw) continue;

      for (const stream of raw) {
        for (const { id, message } of stream.messages) {
          lastId = id;

          const response: EngineResponse = {
            correlationId: message.correlationId!,
            ok: message.ok === "true",
            payload: message.payload ? JSON.parse(message.payload) : undefined,
            error: message.error || undefined,
          };

          resolveEngineResponse(response);
        }
      }
    } catch (error) {
      console.error("Response listener error, retrying in 1s ...", error);
    }
  }
}
