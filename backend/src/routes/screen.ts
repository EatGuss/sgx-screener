import express, { Router, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  CountRequest,
  CountResponse,
  ResultsRequest,
  ResultsResponse,
} from "screener-contract";
import { validateBody } from "../middleware/validate";
import { countScreen } from "../services/screen/count";
import { resultsScreen } from "../services/screen/results";

export const screenRoutes: Router = express.Router();

screenRoutes.post(
  "/count",
  validateBody(CountRequest),
  async (req: Request, res: Response) => {
    try {
      const count = await countScreen(req.body);
      return res.json(CountResponse.parse({ count }));
    } catch (err) {
      const error = err as Error;
      if (error.message.includes("Unsupported")) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
      }
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    }
  },
);

screenRoutes.post(
  "/results",
  validateBody(ResultsRequest),
  async (req: Request, res: Response) => {
    try {
      const result = await resultsScreen(req.body);
      return res.json(ResultsResponse.parse(result));
    } catch (err) {
      const error = err as Error;
      if (error.message.includes("Unsupported")) {
        return res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
      }
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    }
  },
);
