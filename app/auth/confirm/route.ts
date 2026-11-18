import { NextResponse, type NextRequest } from "next/server";
import { session, admin } from "@/lib/supabase";
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const code = url.searchParams.get("code");
  const db = await session();
  if (token_hash && (type === "invite" || type === "recovery")) {
    const { error } = await db.auth.verifyOtp({ token_hash, type });
    if (!error) {
      const {
        data: { user },
      } = await db.auth.getUser();
      const { data: profile } = user
        ? await admin()
            .from("profiles")
            .select("active")
            .eq("id", user.id)
            .single()
        : { data: null };
      return NextResponse.redirect(
        new URL(
          type === "invite" || !profile?.active
            ? "/accept-invite"
            : "/reset-password",
          url.origin,
        ),
      );
    }
  } else if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await db.auth.getUser();
      const { data: profile } = user
        ? await admin()
            .from("profiles")
            .select("active")
            .eq("id", user.id)
            .single()
        : { data: null };
      return NextResponse.redirect(
        new URL(
          profile?.active ? "/reset-password" : "/accept-invite",
          url.origin,
        ),
      );
    }
  }
  return NextResponse.redirect(new URL("/login?error=expired", url.origin));
}
