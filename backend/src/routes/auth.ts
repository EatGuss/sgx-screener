import express, { Router, Request, Response, type CookieOptions } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import {
  EmailTakenError,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createUser,
  signSession,
  userFromSession,
  verifyCredentials,
} from "../services/auth/users";

const SignupRequest = z.object({
  email: z.string().email(),
  username: z.string().trim().min(3).max(50),
  password: z.string().min(8).max(200),
});

const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export const authRoutes: Router = express.Router();

authRoutes.post(
  "/signup",
  validateBody(SignupRequest),
  async (req: Request, res: Response) => {
    const { email, username, password } = req.body as z.infer<typeof SignupRequest>;
    try {
      const user = await createUser(email, username, password);
      return res.status(StatusCodes.CREATED).json(user);
    } catch (err) {
      if (err instanceof EmailTakenError) {
        return res.status(StatusCodes.CONFLICT).json({ error: err.message });
      }
      const error = err as Error;
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    }
  },
);

authRoutes.post(
  "/login",
  validateBody(LoginRequest),
  async (req: Request, res: Response) => {
    const { email, password } = req.body as z.infer<typeof LoginRequest>;
    try {
      const user = await verifyCredentials(email, password);
      if (!user) {
        return res
          .status(StatusCodes.UNAUTHORIZED)
          .json({ error: "Incorrect email or password" });
      }
      return res
        .cookie(SESSION_COOKIE, signSession(user), {
          ...cookieOptions,
          maxAge: SESSION_TTL_SECONDS * 1000,
        })
        .json(user);
    } catch (err) {
      const error = err as Error;
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: error.message });
    }
  },
);

authRoutes.post("/logout", (_req: Request, res: Response) => {
  return res.clearCookie(SESSION_COOKIE, cookieOptions).json({ ok: true });
});

/** Current user, or `{ user: null }` when signed out. Never 401s. */
authRoutes.get("/me", async (req: Request, res: Response) => {
  try {
    const user = await userFromSession(
      req.cookies?.[SESSION_COOKIE] as string | undefined,
    );
    return res.json({ user });
  } catch (err) {
    const error = err as Error;
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
});
