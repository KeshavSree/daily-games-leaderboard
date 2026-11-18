import { createClient } from "@supabase/supabase-js";
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^\S+@\S+\.\S+$/.test(email))
  throw new Error(
    "Usage: node --env-file=.env.local scripts/invite-owner.mjs you@example.com",
  );
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
])
  if (!process.env[key]) throw new Error(`Missing ${key}`);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const { data: owners, error } = await db
  .from("profiles")
  .select("id")
  .eq("role", "owner");
if (error) throw new Error("Run the migration first.");
if (owners.length)
  throw new Error(
    "An owner already exists. Use the app to invite other members.",
  );
const { error: inviteError } = await db
  .from("invites")
  .upsert(
    {
      email,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      accepted_at: null,
    },
    { onConflict: "email" },
  );
if (inviteError) throw inviteError;
const { data, error: sendError } = await db.auth.admin.inviteUserByEmail(
  email,
  {
    redirectTo:
      process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "") + "/auth/confirm",
  },
);
if (sendError) throw sendError;
const { error: roleError } = await db
  .from("profiles")
  .update({ role: "owner" })
  .eq("id", data.user.id);
if (roleError) throw roleError;
console.log("Owner invitation sent. Open the email to choose your password.");
