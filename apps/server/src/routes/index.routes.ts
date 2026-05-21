import { Router } from "express";
import authRoutes from "./auth/index.auths";

const router = Router();

router.use("/auth", authRoutes);

export default router;
