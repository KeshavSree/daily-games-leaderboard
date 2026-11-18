"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { finishAuth } from "@/app/actions";

export default function CompleteAuth() {
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    // Remove credentials from the address bar before loading any other page.
    window.history.replaceState(null, "", window.location.pathname);
    if (!accessToken || !refreshToken) {
      setFailed(true);
      return;
    }
    const client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { detectSessionInUrl: false } },
    );
    void (async () => {
      try {
        const { error } = await client.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setFailed(true);
          return;
        }
        const result = await finishAuth();
        if (result.path) {
          router.replace(result.path);
          router.refresh();
        } else setFailed(true);
      } catch {
        setFailed(true);
      }
    })();
  }, [router]);
  return (
    <main className="auth-shell">
      <Link href="/" className="wordmark">
        daily<span>/</span>
      </Link>
      <h1>{failed ? "Link expired." : "Signing in…"}</h1>
      {failed && (
        <Link className="text-link" href="/forgot-password">
          Request a new link
        </Link>
      )}
    </main>
  );
}
