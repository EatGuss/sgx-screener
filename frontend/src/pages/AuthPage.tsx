import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ScreenerAppShell } from "@/components/ScreenerAppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { login, signup } from "@/lib/auth";

/** Log in / sign up. Accounts only gate saved screens; screening is anonymous. */
export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isSignup = mode === "signup";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isSignup) {
        await signup(email, username, password);
      }
      await login(email, password);
      // Full navigation so every useAuth() picks up the new session cookie.
      window.location.assign("/screener");
    } catch (err) {
      toast.error((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <ScreenerAppShell>
      <header className="flex h-12 items-center border-b px-3">
        <SidebarTrigger />
      </header>
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{isSignup ? "Create an account" : "Log in"}</CardTitle>
            <CardDescription>
              An account lets you save and reopen named screens. Screening and
              share links work without one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {isSignup && (
                <div className="space-y-2">
                  <Label htmlFor="username">Display name</Label>
                  <Input
                    id="username"
                    autoComplete="nickname"
                    required
                    minLength={3}
                    maxLength={50}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  required
                  minLength={isSignup ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {isSignup ? "Already have an account? " : "New here? "}
              <Link
                to={isSignup ? "/login" : "/signup"}
                className="underline underline-offset-4"
              >
                {isSignup ? "Log in" : "Create an account"}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </ScreenerAppShell>
  );
}
