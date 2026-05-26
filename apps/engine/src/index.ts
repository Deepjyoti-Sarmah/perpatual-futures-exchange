import { connectEngineRedis } from "../../../packages/redis/handlers/engine-listener";
import { startEngineListener } from "./redis/start-engine-listener";

async function main() {
  await connectEngineRedis();
  await startEngineListener();
}

main().catch(console.error);
