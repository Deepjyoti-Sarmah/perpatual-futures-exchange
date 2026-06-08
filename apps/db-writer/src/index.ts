import { connectRedis } from "@perp-v1-boilerplate/redis";
import { flushBuffer } from "./flusher";
import { startDbWriter } from "./poller";

async function main() {
  await connectRedis();

  console.log("Redis connected");

  setInterval(() => {
    flushBuffer().catch(console.error);
  }, 1000);

  await startDbWriter();
}

main().catch(console.error);
