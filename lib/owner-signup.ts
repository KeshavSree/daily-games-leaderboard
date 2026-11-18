import "server-only";
import { admin, configured } from "./supabase";
export async function ownerSignupAvailable() {
  if (!configured()) return false;
  const { data, error } = await admin()
    .from("owner_signup")
    .select("claimed_at,reserved_by")
    .eq("id", 1)
    .single();
  return !error && !!data && !data.claimed_at && !data.reserved_by;
}
