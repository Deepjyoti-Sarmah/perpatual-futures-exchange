import type { EngineResponse } from "@perp-v1-boilerplate/commons";
import { env } from "@perp-v1-boilerplate/env/index";
import { createClient } from "redis";

export const ENGINE_COMMAND_STREAM = "engine:command";
export const ENGINE_GROUP = "engine-workers";
export const CONSUMER_ID = `engine-${crypto.randomUUID()}`;

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

export async function sendEngineResponse(
	responseStream: string,
	response: EngineResponse,
) {
	await engineRedisClinet.xAdd(responseStream, "*", {
		correlationId: response.correlationId,
		ok: String(response.ok),
		payload: JSON.stringify(response.payload ?? null),
		error: response.error ?? "",
	});
}

// 12 LPA --> dhoni
// 17.5 LPA --> harbajan
// 15 LPA --> kholi
// 15-16 LPA --> deenda
// 20 LPA --> sachin
// 20 - 25 LPA --> bhumbra
