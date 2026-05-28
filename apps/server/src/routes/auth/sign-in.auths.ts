import { type Collateral, signInSchema } from "@perp-v1-boilerplate/commons";
import prisma from "@perp-v1-boilerplate/db";
import { env } from "@perp-v1-boilerplate/env/index";
import { sendToEngine } from "@perp-v1-boilerplate/redis/send-to-engine";
import bcrypt from "bcryptjs";
import { type Request, type Response, Router } from "express";
import jwt from "jsonwebtoken";

const signInRoute = Router();

signInRoute.post("/", async (req: Request, res: Response) => {
  try {
    const parsedData = signInSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({
        message: "Invalid Request",
        error: parsedData.error.message,
      });
    }

    const { username, password } = parsedData.data;

    const existingUser = await prisma.user.findFirst({
      where: {
        username: username,
      },
    });

    if (!existingUser) {
      return res.status(400).json({
        message: "User does not exist",
      });
    }

    const isValidPassword = bcrypt.compare(password, existingUser.password);

    if (!isValidPassword) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const collateral: Collateral = {
      available: 0,
      locked: 0,
    };

    const engineRes = await sendToEngine("seed_user", {
      userId: existingUser.id,
      username: existingUser.username,
      collateral: collateral,
    });

    if (!engineRes.ok) {
      return res.status(500).json({
        message: "Failed to initalize user balance in engine",
        error: engineRes.error,
      });
    }

    const token = jwt.sign(
      {
        userId: existingUser.id,
        role: existingUser.role,
      },
      env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(200).json({
      message: "User logged In",
      token,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error logging in user",
      error,
    });
  }
});

export default signInRoute;
