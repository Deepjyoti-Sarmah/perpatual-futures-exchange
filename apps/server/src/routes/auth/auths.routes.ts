import { Router } from "express";
import signInRoute from "./sign-in.auths";
import signUpRoute from "./sign-up.auths";

const authRoutes = Router();

authRoutes.use("/sign-up", signUpRoute);
authRoutes.use("/sign-in", signInRoute);

export default authRoutes;
