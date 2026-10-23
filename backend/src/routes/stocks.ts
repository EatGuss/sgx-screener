import express, { Router, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { SearchResponse, StockDetailResponse } from "screener-contract";
import {
  getStockDetail,
  StockNotFoundError,
} from "../services/stocks/detail";
import { searchCompanies } from "../services/stocks/search";

export const stocksRoutes: Router = express.Router();

/** GET /api/stocks/search?q= — must be registered before /:ticker. */
stocksRoutes.get("/search", async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const payload = await searchCompanies(q);
    return res.json(SearchResponse.parse(payload));
  } catch (err) {
    const error = err as Error;
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
});

stocksRoutes.get("/:ticker", async (req: Request, res: Response) => {
  try {
    const ticker = String(req.params.ticker ?? "");
    if (!ticker) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: "Missing ticker" });
    }

    const detail = await getStockDetail(ticker);
    return res.json(StockDetailResponse.parse(detail));
  } catch (err) {
    if (err instanceof StockNotFoundError) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: err.message });
    }
    const error = err as Error;
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
});
