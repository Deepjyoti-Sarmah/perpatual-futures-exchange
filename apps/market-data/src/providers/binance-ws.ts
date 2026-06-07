import { producerClient } from "@perp-v1-boilerplate/redis";
import { MARKET_DATA_STREAM } from "@perp-v1-boilerplate/redis/market-data-stream";
import { sleep } from "bun";

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

	for (;;) {
		try {
			console.log("Connecting to Binance futures mark price websocket...");

			const ws = new WebSocket(BINANCE_FUTURES_WS_URL);

			const closePromise = new Promise<void>((resolve) => {
				ws.onopen = () => {
					console.log("Binance websocket connected");
				};

				ws.onmessage = async (event) => {
					try {
						const rawData =
							typeof event.data === "string"
								? event.data
								: event.data.toString();

						const message = JSON.parse(
							rawData,
						) as BinanceMarketPriceStreamMessage;

						const symbol = message.data.s;
						const markPrice = Number(message.data.p);
						const indexPrice = Number(message.data.i);
						const ts = message.data.E ?? Date.now();

						if (!symbol || !markPrice || !indexPrice) {
							return;
						}

						const marketType = mapSymbolTOMarketType(symbol);

						if (!marketType) {
							return;
						}

						if (markPrice <= 0 || indexPrice <= 0) {
							return;
						}

						const previousMarkPrice = lastPublishedPrice.get(marketType);

						if (previousMarkPrice === markPrice) {
							return;
						}

						lastPublishedPrice.set(marketType, markPrice);

						await producerClient.xAdd(MARKET_DATA_STREAM, "*", {
							marketType,
							markPrice: String(markPrice),
							indexPrice: String(indexPrice),
							ts: String(ts),
						});
					} catch (error) {
						console.error("Failed to process Binance WS message", error);
					}
				};

				ws.onerror = (error) => {
					console.error("Binance websocket error:", error);
				};

				ws.onclose = () => {
					console.warn("Binance websocket closed");
					resolve();
				};
			});

			await closePromise;
		} catch (error) {
			console.error("Binance websocket loop error:", error);
		}

		console.log("Reconnecting to binance websoket in 3 sec...");
		await sleep(3000);
	}
}
