import type {
  EngineCommandType,
  EngineRequest,
  EngineResponse,
} from "@perp-v1-boilerplate/commons";
import { env } from "@perp-v1-boilerplate/env/index";
import { producerClient, subscriberClient } from "../src";

const ENGINE_COMMAND_STREAM = "engine:command";
const SERVER_ID = crypto.randomUUID();
const RESPONSE_STREAM = `engine:response:${SERVER_ID}`;

interface PendingResponse {
  resolve: (response: EngineResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pendingResponse = new Map<string, PendingResponse>();

export async function waitForEngineResponse(
  correlationId: string,
  timeoutMs: number,
): Promise<EngineResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingResponse.delete(correlationId);
      reject(new Error("Engine timeout"));
    }, timeoutMs);

    pendingResponse.set(correlationId, { resolve, reject, timeout });
  });
}

export async function sendToEngine(
  type: EngineCommandType,
  payload: Record<string, unknown>,
): Promise<EngineResponse> {
  const correlationId = crypto.randomUUID();

  const responsePromise = waitForEngineResponse(
    correlationId,
    env.ENGINE_TIMEOUT || 5000,
  );

  const message: EngineRequest = {
    correlationId: correlationId,
    responseStream: RESPONSE_STREAM,
    type,
    payload,
  };

  await producerClient.xAdd(ENGINE_COMMAND_STREAM, "*", {
    correlationId: message.correlationId,
    responseStream: message.responseStream,
    type: message.type,
    payload: JSON.stringify(message.payload),
  });

  return responsePromise;
}

type redisReadResponse = Array<{
  name: string;
  messages: Array<{
    id: string;
    message: Record<string, string>;
  }>;
}>;

function resolveEngineResponse(response: EngineResponse) {
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
