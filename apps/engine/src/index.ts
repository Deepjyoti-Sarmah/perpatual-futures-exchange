import { connectEngineRedis } from "@perp-v1-boilerplate/redis/engine-listener";
import { startEngineListener } from "./redis/start-engine-listener";
import { startMarketDataListener } from "./redis/start-market-data-listener";

async function main() {
  await connectEngineRedis();

  await Promise.all([startEngineListener(), startMarketDataListener()]);
}

main().catch(console.error);
