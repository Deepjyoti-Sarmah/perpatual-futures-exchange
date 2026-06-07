import { Router } from "express";
import createMarketRouter from "./admin/create-market.routes";
import authRoutes from "./auth/auths.routes";
import requireAuth from "./auth/middleware.auths";
import onRampRouter from "./onramp.routes";
import orderRouter from "./orders/orders.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/onramp", requireAuth, onRampRouter);
router.use("/orders", requireAuth, orderRouter);
router.use("/admin", requireAuth, createMarketRouter);

export default router;
