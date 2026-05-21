import { Router } from "express";
import requireAuth from "../auth/middleware.auths";
import createOrderRouter from "./create-order.routes";

const orderRouter = Router();

orderRouter.use("/order", requireAuth, createOrderRouter);

export default orderRouter;
