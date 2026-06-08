import { connectRedis } from "@perp-v1-boilerplate/redis";
import { loadMarketCache } from "./cache/market-cache";
import { flushBuffer } from "./flusher";
import { startDbWriter } from "./poller";

async function shutdown() {
  console.log("Shutting down DB writer...");
  await flushBuffer();
  process.exit(0);
}

async function main() {
  await connectRedis();

  console.log("Redis connected");

  await loadMarketCache();

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  setInterval(() => {
    flushBuffer().catch(console.error);
  }, 1000);

  await startDbWriter();
}

main().catch(console.error);
