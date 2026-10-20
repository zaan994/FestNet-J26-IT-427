import { FirebaseError } from "firebase/app";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { Logo } from "@/components/common/Logo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { signIn } from "@/services/authService";

export function LoginPage() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    const from = (location.state as { from?: string } | null)?.from ?? "/overview";
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof FirebaseError ? err.code.replace("auth/", "").replace(/-/g, " ") : "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* Stage lights */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-brand-2/25 blur-3xl" />

      <div className="absolute right-6 top-6">
        <ThemeToggle compact />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo size={48} subtitle="Smart wearable festival safety" />
        </div>

        <form onSubmit={onSubmit} className="card space-y-5 p-8">
          <div>
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="mt-1 text-sm text-muted">Event staff sign-in (operators, medical responders, administrators)</p>
          </div>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Email</span>
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Password</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && (
            <p className="rounded-xl border border-status-critical/30 bg-status-critical/10 px-3 py-2 text-sm capitalize text-ink">
              ⚠ {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-2.5" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* <p className="mt-6 text-center text-xs text-muted">SLIIT IT4010 Research · J26-IT-427 · Prototype — not a certified medical device</p> */}
      </div>
    </div>
  );
}
