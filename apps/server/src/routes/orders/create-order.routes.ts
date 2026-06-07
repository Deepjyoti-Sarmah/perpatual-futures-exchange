import { createOrderSchema } from "@perp-v1-boilerplate/commons";
import prisma from "@perp-v1-boilerplate/db";
import { sendToEngine } from "@perp-v1-boilerplate/redis/send-to-engine";
import { type Request, type Response, Router } from "express";

const createOrderRouter = Router();

createOrderRouter.post("/", async (req: Request, res: Response) => {
	try {
		const { userId, role } = req;

		if (role !== "user") {
			return res.status(400).json({
				message: "unauthorized to place order",
			});
		}

		const exitingUser = await prisma.user.findFirst({
			where: {
				id: userId,
			},
		});

		if (!exitingUser) {
			return res.status(400).json({
				message: "user not found",
			});
		}

		if (exitingUser.role !== "user") {
			return res.status(400).json({
				message: "admin account is not allowed to place order",
			});
		}

		const parsedData = createOrderSchema.safeParse(req.body);

		if (!parsedData.success) {
			return res.status(400).json({
				message: "Invalid credentials",
				error: parsedData.error.message,
			});
		}
		const { price, qty, type, side, marketType, margin, slippage } =
			parsedData.data;

		const createOrder = await sendToEngine("create_order", {
			userId: exitingUser.id,
			marketType,
			side,
			type,
			price: price ?? 0,
			qty,
			margin,
			slippage: slippage ?? 0,
		});

		return res.status(200).json({
			message: "Order created",
			createOrder,
		});
	} catch (error) {
		return res.status(500).json({
			message: "Error creating users order",
			error: error,
		});
	}
});

export default createOrderRouter;
