import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import type { ZodType } from "zod";

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(StatusCodes.BAD_REQUEST).json({
        error: "Validation failed",
        details: parsed.error.flatten(),
      });
      return;
    }
    req.body = parsed.data;
    next();
  };
}
