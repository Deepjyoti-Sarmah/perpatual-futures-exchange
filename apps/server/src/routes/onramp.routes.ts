import { type Request, type Response, Router } from "express";

const onRampRouter = Router();

onRampRouter.post("/", async (req: Request, res: Response) => {
  //TODO: add redis implementation
  const { userId, role } = req;

  res.json({ userId, role });
});

export default onRampRouter;
