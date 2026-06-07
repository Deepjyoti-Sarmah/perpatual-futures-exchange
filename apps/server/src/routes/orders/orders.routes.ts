import { Router } from "express";
import requireAuth from "../auth/middleware.auths";
import createOrderRouter from "./create-order.routes";
import deleteOrderRouter from "./delete-order.routes";

const orderRouter = Router();

orderRouter.use("/", createOrderRouter);
orderRouter.use("/order", deleteOrderRouter);

export default orderRouter;
