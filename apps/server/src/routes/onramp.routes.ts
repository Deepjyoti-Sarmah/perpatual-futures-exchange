import { type Request, type Response, Router } from "express";

const onRampRouter = Router();

onRampRouter.post("/", async (req: Request, res: Response) => {
  try {
    //TODO: add redis implementation
    const { userId, role } = req;

    res.json({ userId, role });
  } catch (error) {
    return res.status(500).json({
      message: "Error onRamping users account",
      error: error,
    });
  }
});

export default onRampRouter;
