import { env } from "@perp-v1-boilerplate/env/index";
import { createClient } from "@redis/client";

const ENGINE_COMMAND_STREAM = "engine:command";
const ENGINE_GROUP = "engine-workers";
const CONSUMER_ID = `engine-${crypto.randomUUID()}`;

export const engineRedisClinet = createClient({ url: env.REDIS_URL }).on(
  "error",
  (error) => console.error("Engine Redis error", error),
);

export async function connectEngineRedis() {
  await engineRedisClinet.connect();

  // create consumer group
  await engineRedisClinet
    .xGroupCreate(ENGINE_COMMAND_STREAM, ENGINE_GROUP, "$", { MKSTREAM: true })
    .catch((error) => {
      if (!error.message.includes("BUSYGROUP")) throw error;
    });

  console.log("Engine Redis connected");
}

type CommandProcessor = {
  type: string;
  payload: Record<string, unknown>;
};

type redisGroupReadResponse = Array<{
  name: string;
  messages: Array<{
    id: string;
    payload: Record<string, string>;
  }>;
}>;

export async function startEngineListener(processCommand: CommandProcessor) {}
