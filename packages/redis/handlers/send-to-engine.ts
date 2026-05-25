import type {
  EngineCommandType,
  EngineRequest,
  EngineResponse,
} from "@perp-v1-boilerplate/commons";
import { env } from "@perp-v1-boilerplate/env/index";
import { producerClient } from "../src";

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
