import express, { Router, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { FacetsResponse } from "screener-contract";
import { getFacets } from "../services/facets";

export const facetsRoutes: Router = express.Router();

facetsRoutes.get("/", async (_req: Request, res: Response) => {
  try {
    const facets = await getFacets();
    return res.json(FacetsResponse.parse(facets));
  } catch (err) {
    const error = err as Error;
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
});
