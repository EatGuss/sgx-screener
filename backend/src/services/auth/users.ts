import argon2 from "argon2";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { db } from "../../db/drizzleClient";
import { users } from "../../models/screener/users";

export const SESSION_COOKIE = "session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface PublicUser {
  id: number;
  email: string;
  username: string;
}

export class EmailTakenError extends Error {
  constructor() {
    super("An account with that email already exists");
    this.name = "EmailTakenError";
  }
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

function toPublic(row: typeof users.$inferSelect): PublicUser {
  return { id: row.id, email: row.email, username: row.username };
}

export async function createUser(
  email: string,
  username: string,
  password: string,
): Promise<PublicUser> {
  const normalized = email.trim().toLowerCase();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  if (existing.length > 0) {
    throw new EmailTakenError();
  }
  const [row] = await db
    .insert(users)
    .values({
      email: normalized,
      username: username.trim(),
      passwordHash: await argon2.hash(password),
    })
    .returning();
  return toPublic(row!);
}

/** Returns the user when the email/password pair is valid, otherwise null. */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  if (!row || !(await argon2.verify(row.passwordHash, password))) {
    return null;
  }
  return toPublic(row);
}

export function signSession(user: PublicUser): string {
  return jwt.sign({ sub: String(user.id) }, jwtSecret(), {
    expiresIn: SESSION_TTL_SECONDS,
  });
}

/** Resolves a session token to its user; null for missing, invalid or expired tokens. */
export async function userFromSession(
  token: string | undefined,
): Promise<PublicUser | null> {
  if (!token) return null;
  let sub: string | undefined;
  try {
    const payload = jwt.verify(token, jwtSecret());
    sub = typeof payload === "string" ? undefined : payload.sub;
  } catch {
    return null;
  }
  const id = Number(sub);
  if (!Number.isInteger(id) || id < 1) return null;
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ? toPublic(row) : null;
}
