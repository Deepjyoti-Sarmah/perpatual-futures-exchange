import { env } from "@perp-v1-boilerplate/env/index";
import { createClient } from "redis";

export const producerClient = createClient({
	url: env.REDIS_URL,
}).on("error", (error) => {
	console.error("Redis publisher error", error);
});

export const subscriberClient = createClient({
	url: env.REDIS_URL,
}).on("error", (error) => {
	console.error("Redis subscriber error", error);
});

export async function connectRedis() {
	return Promise.all([producerClient.connect(), subscriberClient.connect()]);
}

export async function pingRedis() {
	return producerClient.ping();
}
