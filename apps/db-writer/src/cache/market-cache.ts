import prisma from "@perp-v1-boilerplate/db";

const marketCache = new Map<string, string>();

export async function loadMarketCache(): Promise<void> {
  const markets = await prisma.market.findMany({
    select: { symbol: true, id: true },
  });

  marketCache.clear();

  for (const market of markets) {
    marketCache.set(market.symbol, market.id);
  }

  console.log(`Loaded ${markets.length} markets into cache`);
}

export function getMarketId(symbol: string): string {
  const id = marketCache.get(symbol);
  if (!id) {
    throw new Error(`Market not found for symbol ${symbol}`);
  }
  return id;
}
