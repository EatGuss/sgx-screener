/** Session auth client for /api/auth. The session itself is an httpOnly cookie. */

export interface AuthUser {
  id: number;
  email: string;
  username: string;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // Non-JSON error body — fall through to the status text.
  }
  return res.statusText || `Request failed (${res.status})`;
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (!res.ok) return null;
  const body = (await res.json()) as { user: AuthUser | null };
  return body.user;
}

export async function signup(
  email: string,
  username: string,
  password: string,
): Promise<AuthUser> {
  const res = await postJson("/api/auth/signup", { email, username, password });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as AuthUser;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await postJson("/api/auth/login", { email, password });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as AuthUser;
}

export async function logout(): Promise<void> {
  await postJson("/api/auth/logout", {});
}
