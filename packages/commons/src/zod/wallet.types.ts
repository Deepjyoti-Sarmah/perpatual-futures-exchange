import { z } from "zod";

export const onRampSchema = z.object({
	targetUserId: z.string().min(1),
	amount: z.number().positive(),
});

export type onRampSchemaRequest = z.infer<typeof onRampSchema>;
