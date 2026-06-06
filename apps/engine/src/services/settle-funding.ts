import { recalculatePnl } from "@/handlers/calculate-Pnl";
import { getOrderBook } from "@/handlers/get-orderbook";
import type { HandleResult } from "@/handlers/processCommand";
import { users } from "@/store/engine-store";

export function settleFunding(payload: {
  marketType: "SOL" | "ETH" | "BTC";
}): HandleResult {
  const { marketType } = payload;

  const orderBook = getOrderBook(marketType);
  const markPrice =
    orderBook.markPrice || orderBook.indexPrice || orderBook.lastTradedPrice;

  if (!markPrice || markPrice <= 0) {
    return { ok: false, error: "Invalid mark price for funding settlement " };
  }

  const fundingRate = orderBook.fundingRate;

  if (fundingRate === 0) {
    orderBook.lastFundingTime = Date.now();
    orderBook.nextFundingTime = Date.now() + 60 * 1000;

    return {
      ok: true,
      payload: {
        market: marketType,
        fundingRate,
        settlement: [],
        totalLongPayments: 0,
        totalShortPayments: 0,
        lastFundingTime: orderBook.lastFundingTime,
        nextFundingTime: orderBook.nextFundingTime,
      },
    };
  }

  const settlements: {
    userId: string;
    positionType: "LONG" | "SHORT";
    qty: number;
    payment: number;
    direction: "paid" | "received";
  }[] = [];

  let totalLongPayments = 0;
  let totalShortPayments = 0;

  for (const user of users.values()) {
    const position = user.positions.find((p) => p.market === marketType);

    if (!position) {
      continue;
    }

    const positionNotional = position.qty * markPrice;
    const fundingPayment = positionNotional * Math.abs(fundingRate);

    if (fundingPayment <= 0) {
      continue;
    }

    if (fundingRate > 0) {
      // long pays short
      if (position.type === "LONG") {
        user.collateral.available -= fundingPayment;
        totalLongPayments += fundingPayment;

        settlements.push({
          userId: user.userId,
          positionType: position.type,
          qty: position.qty,
          payment: fundingPayment,
          direction: "paid",
        });
      } else {
        user.collateral.available += fundingPayment;
        totalShortPayments += fundingPayment;

        settlements.push({
          userId: user.userId,
          positionType: position.type,
          qty: position.qty,
          payment: fundingPayment,
          direction: "received",
        });
      }
    } else {
      // short pays long
      if (position.type === "SHORT") {
        user.collateral.available -= fundingPayment;
        totalLongPayments += fundingPayment;

        settlements.push({
          userId: user.userId,
          positionType: position.type,
          qty: position.qty,
          payment: fundingPayment,
          direction: "paid",
        });
      } else {
        user.collateral.available += fundingPayment;
        totalShortPayments += fundingPayment;

        settlements.push({
          userId: user.userId,
          positionType: position.type,
          qty: position.qty,
          payment: fundingPayment,
          direction: "received",
        });
      }
    }

    recalculatePnl(user);
  }

  orderBook.lastFundingTime = Date.now();
  orderBook.nextFundingTime = Date.now() + 60 * 1000;

  return {
    ok: true,
    payload: {
      market: marketType,
      fundingRate,
      settlements,
      totalLongPayments,
      totalShortPayments,
      lastFundingTime: orderBook.lastFundingTime,
      nextFundingTime: orderBook.nextFundingTime,
    },
  };
}
