import type { HandleResult } from "@/handlers/processCommand";
import { users } from "@/store/engine-store";

export function getUserBalance(payload: { userId: string }): HandleResult {
  const { userId } = payload;

  const user = users.get(userId);

  if (!user) {
    return { ok: false, error: "User doesnot exists" };
  }

  return {
    ok: true,
    payload: {
      userId: user.userId,
      wallet: {
        available: user.wallet.available,
      },
      reservedOrderMargin: user.reservedOrderMargin,
      positionMargin: user.positions.reduce((sum, p) => sum + p.margin, 0),
    },
  };
}
