import { env } from "@perp-v1-boilerplate/env/index";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

interface TokenPayload {
  userId: number;
  role: string;
}

export default function requireAuth(
  req: Request,
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

    const decode = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    if (!decode) {
      return res.status(400).json({
        message: "Unauthorized tokens",
      });
    }

    req.userId = decode.userId;
    req.role = decode.role;

    next();
  } catch (error) {
    return res.status(500).json({
      message: "Unable to authorize user",
      error: error,
    });
  }
}
