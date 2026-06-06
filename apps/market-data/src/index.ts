import { connectRedis } from "@perp-v1-boilerplate/redis";
import { startBinanceWs } from "./providers/binance-ws";

async function main() {
  await connectRedis();
  await startBinanceWs();
}

main().catch(console.error);
