import "server-only";
import { createHash } from "node:crypto";
import { admin, configured } from "./supabase";
export function invitationHash(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return createHash("sha256").update(token).digest("hex");
}
export async function invitationAvailable(token: string) {
  const hash = invitationHash(token);
  if (!hash || !configured()) return false;
  const { data, error } = await admin()
    .from("member_invites")
    .select("expires_at,used_at,revoked_at,reserved_by")
    .eq("token_hash", hash)
    .single();
  return (
    !error &&
    !!data &&
    !data.used_at &&
    !data.revoked_at &&
    !data.reserved_by &&
    Date.parse(data.expires_at) > Date.now()
  );
}
