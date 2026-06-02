import type { EngineUser } from "@perp-v1-boilerplate/commons";
import { orderBooks } from "@/store/engine-store";

export function recalculatePnl(user: EngineUser) {
  for (const positon of user.positions) {
    // Get current mark price
    const orderBook = orderBooks[positon.market];

    const markPrice = orderBook?.lastTradedPrice || orderBook?.indexPrice;

    if (!markPrice || markPrice <= 0) {
      continue;
    }

    /**
     * PnL formula:
     *
     * LONG  → profit when price goes UP
     *   pnL = (markPrice - averagePrice) * qty
     *   e.g. bought 10 SOL at $100, now $120 → (120 - 100) * 10 = +$200
     *
     * SHORT → profit when price goes DOWN
     *   pnL = (averagePrice - markPrice) * qty
     *   e.g. sold 10 SOL at $100, now $80  → (100 - 80)  * 10 = +$200
     */
    if (positon.type === "LONG") {
      positon.pnL = (markPrice - positon.averagePrice) * positon.qty;
    } else {
      positon.pnL = (positon.averagePrice - markPrice) * positon.qty;
    }
  }
}
