import { connectEngineRedis } from "@perp-v1-boilerplate/redis/engine-listener";
import { startEngineListener } from "./redis/start-engine-listener";
import { startMarketDataListener } from "./redis/start-market-data-listener";
import { restoreFromSnapshot } from "./restore-snapshort";

async function main() {
  await connectEngineRedis();
  console.log("Engine Redis connected");

  await restoreFromSnapshot();

  await Promise.all([startEngineListener(), startMarketDataListener()]);
}

main().catch(console.error);
