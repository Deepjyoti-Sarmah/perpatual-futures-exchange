import type { Collateral } from "@perp-v1-boilerplate/commons";
import prisma from "@perp-v1-boilerplate/db";
import { sendToEngine } from "@perp-v1-boilerplate/redis/send-to-engine";
import { type Request, type Response, Router } from "express";

const onRampRouter = Router();

onRampRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { userId, role } = req;

    if (role !== "admin") {
      return res.status(400).json({
        message: "Forbidden: admin access is required",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
      },
    });

    if (!existingUser) {
      return res.status(400).json({
        message: "User does not exists",
      });
    }

    if (existingUser.role !== "admin") {
      return res.status(400).json({
        message: "Forbidden: admin access is required",
      });
    }

    const collateral: Collateral = {
      available: 100,
      locked: 0,
    };

    const engineRes = await sendToEngine("on_ramp", {
      userId: existingUser.id,
      username: existingUser.username,
      collateral: collateral,
    });

    if (!engineRes.ok) {
      return res.status(500).json({
        message: "On ramp failed",
        error: engineRes.error,
      });
    }

    return res.status(200).json({
      message: "Balance updated",
      balance: engineRes.payload,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error onRamping users account",
      error: error,
    });
  }
});

export default onRampRouter;
