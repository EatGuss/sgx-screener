import express, { Router, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  SaveScreenRequest,
  SavedScreen,
  SavedScreensResponse,
  UpdateScreenRequest,
} from "screener-contract";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import {
  ScreenNotFoundError,
  createSavedScreen,
  deleteSavedScreen,
  listSavedScreens,
  updateSavedScreen,
} from "../services/screens/crud";

export const screensRoutes: Router = express.Router();

screensRoutes.use(requireAuth);

screensRoutes.get("/", async (req, res: Response) => {
  try {
    const user = (req as AuthedRequest).user;
    const screens = await listSavedScreens(user.id);
    return res.json(SavedScreensResponse.parse({ screens }));
  } catch (err) {
    const error = err as Error;
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
});

screensRoutes.post(
  "/",
  validateBody(SaveScreenRequest),
  async (req, res: Response) => {
    try {
      const user = (req as AuthedRequest).user;
      const { name, spec, columns, description } = req.body as {
        name: string;
        spec: unknown;
        columns?: unknown;
        description?: string;
      };
      const screen = await createSavedScreen(
        user.id,
        name,
        spec as never,
        columns as never,
        description,
      );
      return res.status(StatusCodes.CREATED).json(SavedScreen.parse(screen));
    } catch (err) {
      const error = err as Error;
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    }
  },
);

screensRoutes.put(
  "/:id",
  validateBody(UpdateScreenRequest),
  async (req, res: Response) => {
    try {
      const user = (req as AuthedRequest).user;
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid id" });
      }
      const screen = await updateSavedScreen(user.id, id, req.body);
      return res.json(SavedScreen.parse(screen));
    } catch (err) {
      if (err instanceof ScreenNotFoundError) {
        return res.status(StatusCodes.NOT_FOUND).json({ error: err.message });
      }
      const error = err as Error;
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    }
  },
);

screensRoutes.delete("/:id", async (req, res: Response) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid id" });
    }
    await deleteSavedScreen(user.id, id);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof ScreenNotFoundError) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: err.message });
    }
    const error = err as Error;
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
});
