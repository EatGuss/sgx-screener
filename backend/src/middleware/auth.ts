import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  SESSION_COOKIE,
  userFromSession,
  type PublicUser,
} from "../services/auth/users";

export type AuthedRequest = Request & { user: PublicUser };

/** Require a valid session cookie; attach `req.user`. */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await userFromSession(
      req.cookies?.[SESSION_COOKIE] as string | undefined,
    );
    if (!user) {
      res.status(StatusCodes.UNAUTHORIZED).json({ error: "Authentication required" });
      return;
    }
    (req as AuthedRequest).user = user;
    next();
  } catch (err) {
    const error = err as Error;
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
}
