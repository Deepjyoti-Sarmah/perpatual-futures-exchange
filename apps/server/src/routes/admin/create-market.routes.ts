import {
  marketSchema,
  type CreateOrderPayload,
} from "@perp-v1-boilerplate/commons";
import prisma from "@perp-v1-boilerplate/db";
import { sendToEngine } from "@perp-v1-boilerplate/redis/send-to-engine";
import { Router, type Request, type Response } from "express";

const createMarketRouter = Router();

createMarketRouter.post("/market", async (req: Request, res: Response) => {
  try {
    const { userId, role } = req;

    if (role !== "admin") {
      return res.status(400).json({
        message: "Forbidden: admin access required",
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
      },
    });

    if (!existingUser) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    if (existingUser.role !== "admin") {
      return res.status(400).json({
        message: "Forbidden: insufficient permission",
      });
    }

    const parsedData = marketSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({
        message: "Invalid Request",
        error: parsedData.error.message,
      });
    }

    const { slug, symbol, image } = parsedData.data;

    const marketId = crypto.randomUUID();

    const enginRes = await sendToEngine("create_market", {
      marketId: marketId,
      symbol,
      slug,
    });

    if (!enginRes.ok) {
      return res.status(500).json({
        message: "Error creating market",
      });
    }

    const market = await prisma.market.create({
      data: {
        slug: slug,
        symbol: symbol,
        image: image,
      },
    });

    return res.status(200).json({
      message: "Market created successfully",
      market,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating market",
      error: error,
    });
  }
});

export default createMarketRouter;
