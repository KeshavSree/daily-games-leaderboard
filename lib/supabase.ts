import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export function configured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
export function isDemo() {
  return (
    process.env.DEMO_MODE === "true" ||
    (!configured() && process.env.NODE_ENV !== "production")
  );
}
export function admin() {
  if (!configured()) throw new Error("Supabase is not configured.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function session() {
  if (!configured()) throw new Error("Supabase is not configured.");
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server component: refresh is handled by proxy. */
          }
        },
      },
    },
  );
}
export async function member(ownerOnly = false) {
  const db = await session();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Please log in.");
  const { data, error } = await admin()
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error || !data?.active || (ownerOnly && data.role !== "owner"))
    throw new Error("Invitation required.");
  return { user, profile: data, db: admin() };
}
export function appUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("App URL is not configured.");
  return url.replace(/\/$/, "");
}
