import { env } from "@perp-v1-boilerplate/env/index";
import { connectRedis } from "@perp-v1-boilerplate/redis";
import cors from "cors";
import express from "express";
import { listenForEngineEvents } from "./redis/start-engine-event-listener";
import router from "./routes/index.routes";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
  }),
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

app.use("/api/v1", router);

async function main() {
  await connectRedis();

  // listenForEngineResponse();
  listenForEngineEvents();

  app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
  });
}

main().catch(console.error);
