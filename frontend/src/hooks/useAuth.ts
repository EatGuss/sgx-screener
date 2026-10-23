import { useEffect, useState } from "react";
import { getCurrentUser, type AuthUser } from "@/lib/auth";

/** Current session. `loading` is true until the first /api/auth/me resolves. */
export function useAuth(): {
  user: AuthUser | null;
  signedIn: boolean;
  loading: boolean;
} {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .catch(() => null)
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, signedIn: user != null, loading };
}
