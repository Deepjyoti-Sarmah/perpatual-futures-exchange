type BinanceMarketPriceStreamMessage = {
  stream: string;
  data: {
    e: string;
    E: number;
    s: string;
    p: string;
    i: string;
    P?: string;
    r?: string;
    T?: number;
  };
};

const BINANCE_FUTURES_WS_URL =
  "wss://fstream.binance.com/stream?streams=btcusdt@markPrice@1s/ethusdt@markPrice@1s/solusdt@markPrice@1s";

function mapSymbolTOMarketType(symbol: string): "SOL" | "ETH" | "BTC" | null {
  if (symbol === "BTCUSDT") return "BTC";
  if (symbol === "ETHUSDT") return "ETH";
  if (symbol === "SOLUSDT") return "SOL";

  return null;
}

export async function startBinanceWs() {
  const lastPublishedPrice = new Map<"SOL" | "ETH" | "BTC", number>();

  for (; ;) {
    try {
      console.log("Connecting to Binance futures mark price websocket...");

      const ws = new WebSocket(BINANCE_FUTURES_WS_URL);
    } catch (error) { }
  }
}
