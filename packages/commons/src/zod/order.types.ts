import { z } from "zod";

export const createOrderSchema = z
  .object({
    marketType: z.enum(["SOL", "ETH", "BTC"]),
    type: z.enum(["long", "short"]),
    side: z.enum(["market", "limit"]),
    qty: z.number().positive(),
    price: z.number().positive().optional().nullable(),
    margin: z.number().positive(),
    slippage: z.number().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.side === "limit" && (!data.price || data.price <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["price"],
        message: "Limit order requires a valid price",
      });
    }
  });

export const deleteOrderSchema = z.object({
  orderId: z.string().nonempty(),
  marketType: z.enum(["SOL", "ETH", "BTC"]),
});

export type createOrderSchemaRequest = z.infer<typeof createOrderSchema>;
export type deleteOrderSchemaRequest = z.infer<typeof deleteOrderSchema>;
