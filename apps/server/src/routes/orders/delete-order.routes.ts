import {
  type CancelOrderPayload,
  deleteOrderSchema,
} from "@perp-v1-boilerplate/commons";
import prisma from "@perp-v1-boilerplate/db";
import { sendToEngine } from "@perp-v1-boilerplate/redis/send-to-engine";
import { type Request, type Response, Router } from "express";

const deleteOrderRouter = Router();

deleteOrderRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { userId, role } = req;

    if (role === "admin") {
      res.status(400).json({
        message: "unauthorized to perform the task",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
      },
    });

    if (!existingUser) {
      return res.status(400).json({
        message: "User does not exist",
      });
    }

    if (existingUser.role === "admin") {
      res.status(400).json({
        message: "unauthorized to perform the task",
      });
    }

    const parsedData = deleteOrderSchema.safeParse(req.body);

    if (!parsedData.success) {
      return res.status(400).json({
        message: "Invalid request",
        error: parsedData.error.message,
      });
    }

    const { orderId, marketType } = parsedData.data;

    const cancelOrder: CancelOrderPayload = {
      userId: existingUser.id,
      orderId,
      marketType,
    };

    const deleteOrder = await sendToEngine("cancel_order", {
      userId: existingUser.id,
      cancelOrder,
    });

    return res.status(200).json({
      message: "Order deleted successfully",
      deleteOrder,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error deleting users order",
      error: error,
    });
  }
});

export default deleteOrderRouter;
