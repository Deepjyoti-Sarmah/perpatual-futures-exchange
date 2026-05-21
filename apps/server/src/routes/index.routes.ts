import { Router } from "express";
import authRoutes from "./auth/auths.routes";
import requireAuth from "./auth/middleware.auths";
import onRampRouter from "./onramp.routes";

const router = Router();

router.use("/auth", authRoutes);

router.use("/onramp", requireAuth, onRampRouter);

router.use("/order", requireAuth);

export default router;
