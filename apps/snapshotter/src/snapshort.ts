import type { EngineUser, Orderbooks } from "@perp-v1-boilerplate/commons";
import fs from "fs/promises";
import path from "path";

export type Snapshort = {
  lastEventId: string;
  timestamp: number;
  users: Record<string, EngineUser>;
  orderBooks: Orderbooks;
};

const SNAPSHORT_PATH = path.resolve("snapshort.json");

export async function saveSnapshort(
  lastEventId: string,
  users: Map<string, EngineUser>,
  orderBooks: Orderbooks,
) {
  const userObj: Record<string, EngineUser> = {};

  for (const [id, user] of users) {
    userObj[id] = user;
  }

  const snapshort: Snapshort = {
    lastEventId,
    timestamp: Date.now(),
    users: userObj,
    orderBooks,
  };

  await fs.writeFile(SNAPSHORT_PATH, JSON.stringify(snapshort, null, 2));

  console.log(`Snapshort saved at event ${lastEventId}`);
}

export async function loadSnapshort() {
  try {
    const data = await fs.readFile(SNAPSHORT_PATH, "utf-8");
    const snapshort = JSON.parse(data) as Snapshort;

    console.log(
      `Snapshot loaded: event=${snapshort.lastEventId} users=${Object.keys(snapshort.users).length} markets=${Object.keys(snapshort.orderBooks).length}`,
    );

    return snapshort;
  } catch {
    return null;
  }
}
