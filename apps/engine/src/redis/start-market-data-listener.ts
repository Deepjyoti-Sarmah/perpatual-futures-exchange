import { engineRedisClinet } from "@perp-v1-boilerplate/redis/engine-listener";
import {
	MARKET_DATA_CONSUMER_ID,
	MARKET_DATA_GROUP,
	MARKET_DATA_STREAM,
} from "@perp-v1-boilerplate/redis/market-data-stream";
import { updateMarketPrice } from "@/services/update-market-price";

type RedisGroupReadResponse = Array<{
	name: string;
	messages: Array<{
		id: string;
		message: Record<string, string>;
	}>;
}>;

export async function startMarketDataListener() {
	await engineRedisClinet
		.xGroupCreate(MARKET_DATA_STREAM, MARKET_DATA_GROUP, "$", {
			MKSTREAM: true,
		})
		.catch((error) => {
			if (!error.message.includes("BUSYGROUP")) {
				throw error;
			}
		});

	console.log(`Market data listener started: ${MARKET_DATA_CONSUMER_ID}`);

	for (;;) {
		try {
			const raw = (await engineRedisClinet.xReadGroup(
				MARKET_DATA_GROUP,
				MARKET_DATA_CONSUMER_ID,
				[{ key: MARKET_DATA_STREAM, id: ">" }],
				{ BLOCK: 5000, COUNT: 100 },
			)) as RedisGroupReadResponse | null;

			if (!raw) {
				continue;
			}

			for (const stream of raw) {
				for (const { id, message } of stream.messages) {
					try {
						const marketType = message.marketType as "SOL" | "ETH" | "BTC";
						const markPrice = Number(message.markPrice);
						const indexPrice = Number(message.indexPrice);

						if (
							!marketType ||
							!markPrice ||
							markPrice <= 0 ||
							!indexPrice ||
							indexPrice <= 0
						) {
							await engineRedisClinet.xAck(
								MARKET_DATA_STREAM,
								MARKET_DATA_GROUP,
								id,
							);
							continue;
						}

						updateMarketPrice({
							marketType,
							markPrice,
							indexPrice,
						});

						await engineRedisClinet.xAck(
							MARKET_DATA_STREAM,
							MARKET_DATA_GROUP,
							id,
						);
					} catch (error) {
						console.error("Failed to process market data message:", error);
					}
				}
			}
		} catch (error) {
			console.error(
				"Market data listener error, retying in 1 second...",
				error,
			);

			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}
}
