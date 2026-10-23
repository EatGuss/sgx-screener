import express, { Router, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  NlDescribeRequest,
  NlDescribeResponse,
  NlParseRequest,
  NlParseResponse,
  NlRefineRequest,
  NlRefineResponse,
} from "screener-contract";
import { validateBody } from "../middleware/validate";
import {
  NlDescribeError,
  describeScreenSpec,
} from "../services/nl/describe";
import {
  NlConfigError,
  NlLlmError,
} from "../services/nl/openrouter";
import { NlParseError, parseNaturalLanguage } from "../services/nl/parse";
import { NlRefineError, refineNaturalLanguage } from "../services/nl/refine";

export const nlRoutes: Router = express.Router();

nlRoutes.post(
  "/parse",
  validateBody(NlParseRequest),
  async (req: Request, res: Response) => {
    try {
      const result = await parseNaturalLanguage(req.body);
      return res.json(NlParseResponse.parse(result));
    } catch (err) {
      if (err instanceof NlConfigError) {
        return res
          .status(StatusCodes.SERVICE_UNAVAILABLE)
          .json({ error: err.message });
      }
      if (err instanceof NlLlmError) {
        return res
          .status(StatusCodes.BAD_GATEWAY)
          .json({ error: err.message });
      }
      if (err instanceof NlParseError) {
        return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
          error: err.message,
        });
      }
      const error = err as Error;
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    }
  },
);

nlRoutes.post(
  "/describe",
  validateBody(NlDescribeRequest),
  async (req: Request, res: Response) => {
    try {
      const result = await describeScreenSpec(req.body);
      return res.json(NlDescribeResponse.parse(result));
    } catch (err) {
      if (err instanceof NlConfigError) {
        return res
          .status(StatusCodes.SERVICE_UNAVAILABLE)
          .json({ error: err.message });
      }
      if (err instanceof NlLlmError) {
        return res
          .status(StatusCodes.BAD_GATEWAY)
          .json({ error: err.message });
      }
      if (err instanceof NlDescribeError) {
        return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
          error: err.message,
        });
      }
      const error = err as Error;
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    }
  },
);

nlRoutes.post(
  "/refine",
  validateBody(NlRefineRequest),
  async (req: Request, res: Response) => {
    try {
      const result = await refineNaturalLanguage(req.body);
      return res.json(NlRefineResponse.parse(result));
    } catch (err) {
      if (err instanceof NlConfigError) {
        return res
          .status(StatusCodes.SERVICE_UNAVAILABLE)
          .json({ error: err.message });
      }
      if (err instanceof NlLlmError) {
        return res
          .status(StatusCodes.BAD_GATEWAY)
          .json({ error: err.message });
      }
      if (err instanceof NlRefineError) {
        return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json({
          error: err.message,
        });
      }
      const error = err as Error;
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    }
  },
);
