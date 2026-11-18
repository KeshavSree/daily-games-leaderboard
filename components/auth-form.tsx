"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { login, forgotPassword, setPassword } from "@/app/actions";
export default function AuthForm({
  mode,
  ready,
  expired = false,
}: {
  mode: "login" | "forgot" | "reset" | "invite";
  ready: boolean;
  expired?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState(
    expired ? "This link has expired. Request a new one." : "",
  );
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const titles = {
    login: "Welcome back.",
    forgot: "Forgot password?",
    reset: "New password.",
    invite: "You’re in.",
  };
  return (
    <main className="auth-shell">
      <Link className="wordmark" href="/">
        daily<span>/</span>
      </Link>
      <div className="auth-top">
        <span className="tiny muted">Your private leaderboard</span>
        <h1>{titles[mode]}</h1>
      </div>
      {!ready && (
        <p className="notice">
          Accounts are available once Supabase is connected.{" "}
          <Link href="/">Open preview</Link>
        </p>
      )}
      {sent ? (
        <div className="notice" role="status">
          If an account exists, a reset link is on its way.
          <Link className="text-link" href="/login">
            Back to login
          </Link>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            const email = String(form.get("email") || "");
            const password = String(form.get("password") || "");
            if (
              (mode === "reset" || mode === "invite") &&
              password !== form.get("confirm")
            ) {
              setError("Passwords do not match.");
              setBusy(false);
              return;
            }
            const result =
              mode === "login"
                ? await login(email, password)
                : mode === "forgot"
                  ? await forgotPassword(email)
                  : await setPassword(
                      password,
                      mode === "invite" ? String(form.get("name")) : undefined,
                    );
            setBusy(false);
            if (result.error) {
              setError(result.error);
              return;
            }
            if (mode === "forgot") {
              setSent(true);
            } else {
              router.push("/");
              router.refresh();
            }
          }}
        >
          {mode === "invite" && (
            <label>
              Display name
              <input
                name="name"
                autoComplete="nickname"
                maxLength={30}
                required
              />
            </label>
          )}
          {(mode === "login" || mode === "forgot") && (
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </label>
          )}
          {mode !== "forgot" && (
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={mode === "login" ? 1 : 12}
                maxLength={128}
                placeholder={
                  mode === "login" ? "Your password" : "At least 12 characters"
                }
                required
              />
            </label>
          )}
          {(mode === "reset" || mode === "invite") && (
            <label>
              Confirm password
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </label>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy || !ready}>
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : mode === "login" ? (
              "Log in"
            ) : mode === "forgot" ? (
              "Send reset link"
            ) : mode === "invite" ? (
              "Join leaderboard"
            ) : (
              "Save password"
            )}
            {!busy && <ArrowUpRight size={17} />}
          </button>
        </form>
      )}
      <div className="auth-footer">
        {mode === "login" ? (
          <>
            <span>Invite only</span>
            <Link href="/forgot-password">Forgot password?</Link>
          </>
        ) : (
          <Link href="/login">Back to login</Link>
        )}
      </div>
    </main>
  );
}
