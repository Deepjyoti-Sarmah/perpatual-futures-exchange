// import { producerClient } from "@perp-v1-boilerplate/redis";
// import { RESPONSE_STREAM } from "@perp-v1-boilerplate/redis/send-to-engine";
//
// export async function publishEvent(type: string, payload: unknown) {
//   await producerClient.xAdd(RESPONSE_STREAM, "*", {
//     type,
//     payload: JSON.stringify(payload),
//     timestamp: Date.now().toString(),
//   });
// }
