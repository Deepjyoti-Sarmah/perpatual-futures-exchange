import { env } from "@perp-v1-boilerplate/env/index";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId: string;
  role: "admin" | "user";
}

export default function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const token = authHeader.slice("Bearer".length);

    const payload = jwt.verify(token, env.JWT_SECRET) as {
      userId: string;
      role: "user" | "admin";
    };

    req.userId = payload.userId;
    req.role = payload.role;

    next();
  } catch (error) {
    return res.status(500).json({
      message: "Unable to authorize user",
      error: error,
    });
  }
}
