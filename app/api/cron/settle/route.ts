import { timingSafeEqual } from "node:crypto";
import { admin } from "@/lib/supabase";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : "";
  const actual = request.headers.get("authorization") || "";
  if (
    !expected ||
    Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await admin().rpc("settle_days");
  if (error) {
    console.error("Settlement failed", error.code);
    return Response.json({ error: "Settlement failed" }, { status: 500 });
  }
  return Response.json({ settled: data });
}
