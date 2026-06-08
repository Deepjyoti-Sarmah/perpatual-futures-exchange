import fs from "node:fs/promises";
import path from "node:path";
import { orderBooks, users } from "./store/engine-store";

type Snapshort = {
  lastEventId: string;
  timestamp: number;
  users: Record<
    string,
    {
      userId: string;
      username?: string;
      collateral: { available: number; locked: number };
      reservedOrderMargin: number;
      positions: Array<{
        market: string;
        type: "LONG" | "SHORT";
        qty: number;
        margin: number;
        liquidationPrice: number;
        averagePrice: number;
        pnL?: number;
      }>;

      orders: Array<{
        orderId: string;
        market: "SOL" | "ETH" | "BTC";
        type: "LONG" | "SHORT";
        qty: number;
        margin: number;
        side: "limit" | "market";
        price?: number;
        status: "filled" | "cancelled" | "open" | "partially_filled";
        fillQty: number;
      }>;
    }
  >;
  orderBooks: Record<
    string,
    {
      bids: Record<string, { availableQty: number; openOrders: Array<any> }>;
      asks: Record<string, { availableQty: number; openOrders: Array<any> }>;
      lastTradedPrice: number;
      indexPrice: number;
      markPrice: number;
      fundingRate: number;
      lastFundingTime: number;
      nextFundingTime: number;
    }
  >;
};

const SNAPSHORT_PATH = path.resolve("snapshot.json");

export async function restoreFromSnapshot() {
  try {
    const data = await fs.readFile(SNAPSHORT_PATH, "utf-8");
    const snapshot = JSON.parse(data) as Snapshort;

    for (const [id, user] of Object.entries(snapshot.users)) {
      users.set(id, user as any);
    }
    Object.assign(orderBooks, snapshot.orderBooks);

    console.log(
      `Restored from snapshot: ${snapshot.lastEventId}, ${Object.keys(snapshot.users).length} users`,
    );

    return snapshot.lastEventId;
  } catch (error) {
    console.log("No snapshot found, starting fresh", error);
    return null;
  }
}
