import { z } from "zod";

export const signUpSchema = z.object({
  username: z.string().min(1).nonempty(),
  password: z.string().min(4).nonempty(),
  // role: z.enum(["user", "admin"]),
});

export const signInSchema = z.object({
  username: z.string().min(1).nonempty(),
  password: z.string().min(4).nonempty(),
  // role: z.enum(["user", "admin"]),
});

export type signUpSchemaRequest = z.infer<typeof signUpSchema>;
export type signInSchemaRequest = z.infer<typeof signInSchema>;
