import { z } from "zod";

export const createOrderSchema = z.object({
  marketType: z.enum(["SOL", "ETH", "BTC"]),
  type: z.enum(["long", "short"]),
  side: z.enum(["market", "limit"]),
  status: z.enum(["filled", "partially_filled", "cancelled", "open"]),
  qty: z.number().positive(),
  price: z.number().positive(),
  margin: z.number().positive(),
  slippage: z.number().positive().optional(),
});

export const deleteOrderSchema = z.object({
  orderId: z.string().nonempty(),
  marketType: z.enum(["SOL", "ETH", "BTC"]),
});

export type createOrderSchemaRequest = z.infer<typeof createOrderSchema>;
export type deleteOrderSchemaRequest = z.infer<typeof deleteOrderSchema>;
