import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { member, appUrl } from "@/lib/supabase";
import { submitScore } from "@/app/actions";
export const dynamic = "force-dynamic";
const cookieName = "daily-extension-csrf";
const json = (data: object, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET() {
  try {
    const { profile } = await member();
    const csrf = randomBytes(32).toString("hex");
    const response = json({ name: profile.display_name, csrf });
    response.cookies.set(cookieName, csrf, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/extension",
      maxAge: 300,
    });
    return response;
  } catch {
    return json({ error: "Log in to Daily first." }, 401);
  }
}
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(appUrl()).origin)
    return json({ error: "Invalid request origin." }, 403);
  const expected = (await cookies()).get(cookieName)?.value || "";
  const supplied = request.headers.get("x-daily-csrf") || "";
  if (
    !/^[a-f0-9]{64}$/.test(supplied) ||
    expected.length !== supplied.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  )
    return json({ error: "Reconnect to Daily." }, 403);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    return json({ error: "Invalid request." }, 415);
  const body = await request.text();
  if (body.length > 24000)
    return json({ error: "Share text is too long." }, 413);
  try {
    const { raw } = JSON.parse(body);
    if (typeof raw !== "string" || raw.length > 4000)
      return json({ error: "Invalid share text." }, 400);
    const result = await submitScore(raw);
    return json(result, result.error ? 400 : 200);
  } catch {
    return json({ error: "Could not submit score." }, 400);
  }
}
