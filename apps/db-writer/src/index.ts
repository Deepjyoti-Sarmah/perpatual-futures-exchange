import { connectRedis } from "@perp-v1-boilerplate/redis";
import { startDbWriter } from "./poller";

async function main() {
  await connectRedis();
  console.log("Redis connected");
  await startDbWriter();
}

main().catch(console.error);
