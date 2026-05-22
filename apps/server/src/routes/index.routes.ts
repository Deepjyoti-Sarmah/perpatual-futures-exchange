import { Router } from "express";
import authRoutes from "./auth/auths.routes";
import requireAuth from "./auth/middleware.auths";
import onRampRouter from "./onramp.routes";
import createOrderRouter from "./orders/create-order.routes";
import createMarketRouter from "./admin/create-market.routes";

const router = Router();

router.use("/auth", authRoutes);

router.use("/onramp", requireAuth, onRampRouter);

router.use("/order", requireAuth, createOrderRouter);

router.use("/admin", requireAuth, createMarketRouter);

export default router;
