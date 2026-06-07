import { onRampSchema } from "@perp-v1-boilerplate/commons";
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

		const adminUser = await prisma.user.findFirst({
			where: {
				id: userId,
			},
		});

		if (!adminUser || adminUser.role !== "admin") {
			return res.status(400).json({
				message: "Forbidden: admin access is required",
			});
		}

		const parsedData = onRampSchema.safeParse(req.body);

		if (!parsedData.success) {
			return res.status(400).json({
				message: "Invalid request",
				error: parsedData.error.message,
			});
		}

		const { targetUserId, amount } = parsedData.data;

		const targetUser = await prisma.user.findFirst({
			where: {
				id: targetUserId,
			},
		});

		if (!targetUser) {
			return res.status(404).json({
				message: "Target user not found",
			});
		}

		const engineRes = await sendToEngine("on_ramp", {
			userId: targetUser.id,
			username: targetUser.username,
			amount,
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
			message: "Error onramping user account",
			error,
		});
	}
});

export default onRampRouter;
