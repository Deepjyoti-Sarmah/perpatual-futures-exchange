import {
  CONSUMER_ID,
  ENGINE_COMMAND_STREAM,
  ENGINE_GROUP,
  engineRedisClinet,
} from "@perp-v1-boilerplate/redis/engine-listener";
import { processCommand } from "../handlers/processCommand";

type redisGroupReadResponse = Array<{
  name: string;
  messages: Array<{
    id: string;
    message: Record<string, string>;
  }>;
}>;

export async function startEngineListener() {
  console.log(`Engine listener started: ${CONSUMER_ID}`);

  for (; ;) {
    try {
      const raw = (await engineRedisClinet.xReadGroup(
        ENGINE_GROUP,
        CONSUMER_ID,
        [{ key: ENGINE_COMMAND_STREAM, id: ">" }],
        { BLOCK: 5000, COUNT: 50 },
      )) as redisGroupReadResponse | null;

      if (!raw) continue;

      for (const stream of raw) {
        for (const { id, message } of stream.messages) {
          // const { correlationId, responseStream, type, payload } = message;
          const { correlationId, type, payload } = message;

          if (!correlationId || !type) {
            console.warn("Malformed message, ACKing and skipping:", id);
            await engineRedisClinet.xAck(
              ENGINE_COMMAND_STREAM,
              ENGINE_GROUP,
              id,
            );
            continue;
          }

          try {
            const result = await processCommand(
              type,
              payload ? JSON.parse(payload) : {},
              correlationId,
            );

            // await sendEngineResponse(responseStream, {
            //   correlationId,
            //   ok: result.ok,
            //   payload: result.payload,
            //   error: result.error,
            // });
            //
            await engineRedisClinet.xAck(
              ENGINE_COMMAND_STREAM,
              ENGINE_GROUP,
              id,
            );
          } catch (error) {
            console.error("Failed to process command:", type, error);

            //TODO:
            // await sendEngineResponse(responseStream, {
            //   correlationId,
            //   ok: false,
            //   error: error instanceof Error ? error.message : "Engine error",
            // }).catch(() => { });
          }
        }
      }
    } catch (error) {
      console.error("Engine listener error, retrying in 1s...", error);

      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
