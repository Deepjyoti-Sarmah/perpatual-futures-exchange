import { signInSchema } from "@perp-v1-boilerplate/commons";
import prisma from "@perp-v1-boilerplate/db";
import { env } from "@perp-v1-boilerplate/env/index";
import bcrypt from "bcryptjs";
import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { sendToEngine } from "@perp-v1-boilerplate/redis/handlers";

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
