import express, { Router, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { PRESETS, PresetsResponse } from "screener-contract";

export const presetsRoutes: Router = express.Router();

/** GET /api/presets — curated ScreenSpec screens from the contract. */
presetsRoutes.get("/", async (_req: Request, res: Response) => {
  try {
    return res.json(PresetsResponse.parse({ presets: PRESETS }));
  } catch (err) {
    const error = err as Error;
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
});
