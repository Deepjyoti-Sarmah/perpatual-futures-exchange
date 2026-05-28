import type { Fill } from "@perp-v1-boilerplate/commons";

export function matchOrder(
  market: string,
  takerOrder: {
    userId: string;
    type: "Long" | "Short";
    qty: number;
    orderId: string;
  },
): Fill[] {}
