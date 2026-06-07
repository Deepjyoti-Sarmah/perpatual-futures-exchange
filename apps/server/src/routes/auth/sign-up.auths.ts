import { signUpSchema } from "@perp-v1-boilerplate/commons";
import prisma from "@perp-v1-boilerplate/db";
import bcrypt from "bcryptjs";
import { type Request, type Response, Router } from "express";

const signUpRoute = Router();

signUpRoute.post("/", async (req: Request, res: Response) => {
	try {
		const parsedData = signUpSchema.safeParse(req.body);
		if (!parsedData.success) {
			return res.status(400).json({
				message: "Invalid Request",
				error: parsedData.error.message,
			});
		}

		const { username, password } = parsedData.data;

		const existingUser = await prisma.user.findUnique({
			where: {
				username: username,
			},
		});

		if (existingUser) {
			return res.status(400).json({
				message: "User already exists",
			});
		}

		const hashedPassword = await bcrypt.hash(password, 10);

		const user = await prisma.user.create({
			data: {
				username: username,
				password: hashedPassword,
			},
		});

		return res.status(200).json({
			message: "User created",
			user: user.id,
		});
	} catch (error) {
		return res.status(500).json({ message: "Error signing up user", error });
	}
});

export default signUpRoute;
