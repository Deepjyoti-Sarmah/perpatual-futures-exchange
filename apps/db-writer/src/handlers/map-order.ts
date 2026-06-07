import type { OrderCreatedPayload } from "src/types";

export function mapOrderStatus(
  status: OrderCreatedPayload["status"],
): "FILLED" | "PARTIALLY_FILLED" | "CANCELLED" | "OPEN" {
  switch (status) {
    case "open":
      return "OPEN";
    case "filled":
      return "FILLED";
    case "partially_filled":
      return "PARTIALLY_FILLED";
    case "cancelled":
      return "CANCELLED";
  }
}

export function mapOrderType(type: "long" | "short"): "LONG" | "SHORT" {
  return type === "long" ? "LONG" : "SHORT";
}

export function mapSide(side: "limit" | "market"): "Limit" | "Market" {
  return side === "limit" ? "Limit" : "Market";
}
