import { connectEngineRedis } from "@perp-v1-boilerplate/redis/engine-listener";
import { startEngineListener } from "./redis/start-engine-listener";

async function main() {
  await connectEngineRedis();
  await startEngineListener();
}

main().catch(console.error);
