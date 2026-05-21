import { type Request, type Response, Router } from "express";

const deleteOrderRouter = Router();

deleteOrderRouter.post("/", async (req: Request, res: Response) => {
  //TODO:
  try {
    const { userId, role } = req;

    return { userId, role };
  } catch (error) {}
});

export default deleteOrderRouter;
