import { z } from "zod";

export const marketSchema = z.object({
	slug: z.string().min(1).nonempty(),
	symbol: z.string().min(1).nonempty(),
	image: z.string().optional(),
});

export type marketSchemaRequest = z.infer<typeof marketSchema>;
