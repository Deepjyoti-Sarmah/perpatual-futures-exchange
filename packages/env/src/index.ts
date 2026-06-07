import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    REDIS_URL: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    ENGINE_TIMEOUT: z.coerce.number().min(1),

    CORS_ORIGIN: z.string().url(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
