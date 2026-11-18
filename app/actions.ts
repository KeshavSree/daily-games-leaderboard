"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { admin, appUrl, member, session } from "@/lib/supabase";
import { dateInZone, parseScore, type Game } from "@/lib/games";
const message = (e: unknown) => ({
  error: e instanceof Error ? e.message : "Something went wrong. Try again.",
});
export async function submitScore(
  raw: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { user, db } = await member();
    const { data: s, error } = await db
      .from("settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (error || !s) throw new Error("Could not load game settings.");
    const settings = {
      timezone: s.timezone,
      chainleAnchorDate: s.chainle_anchor_date,
      chainleAnchorNumber: s.chainle_anchor_number,
      krillionAnchorDate: s.krillion_anchor_date,
      krillionAnchorNumber: s.krillion_anchor_number,
    };
    const parsed = parseScore(
      raw,
      dateInZone(new Date(), settings.timezone),
      settings,
    );
    const result = await db.rpc("submit_score", {
      p_user: user.id,
      p_game: parsed.game,
      p_date: parsed.date,
      p_puzzle: parsed.puzzleKey,
      p_score: parsed.score,
      p_raw: raw,
    });
    if (result.error) throw new Error(result.error.message);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return message(e);
  }
}
export async function deleteScore(
  game: Game,
  date: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { user, db } = await member();
    const { error } = await db.rpc("delete_score", {
      p_user: user.id,
      p_game: game,
      p_date: date,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return message(e);
  }
}
export async function saveProfile(
  form: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { user, profile, db } = await member();
    const name = String(form.get("name") || "").trim();
    if (name.length < 1 || name.length > 30)
      throw new Error("Use a name with 1–30 characters.");
    let path = profile.avatar_path;
    const image = form.get("avatar");
    if (form.get("removeAvatar") === "true") path = null;
    if (image instanceof File && image.size) {
      if (image.size > 2 * 1024 * 1024)
        throw new Error("Choose an image under 2 MB.");
      const bytes = Buffer.from(await image.arrayBuffer());
      const png = bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const webp =
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP";
      if (!png && !jpg && !webp)
        throw new Error("Choose a PNG, JPG, or WebP image.");
      const ext = png ? "png" : jpg ? "jpg" : "webp";
      path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from("avatars").upload(path, bytes, {
        contentType: `image/${jpg ? "jpeg" : ext}`,
        upsert: false,
      });
      if (error) throw new Error("Photo upload failed. Try again.");
    }
    const { error } = await db
      .from("profiles")
      .update({ display_name: name, avatar_path: path })
      .eq("id", user.id);
    if (error) {
      if (path && path !== profile.avatar_path)
        await db.storage.from("avatars").remove([path]);
      throw new Error("Could not save profile.");
    }
    if (profile.avatar_path && profile.avatar_path !== path)
      await db.storage.from("avatars").remove([profile.avatar_path]);
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return message(e);
  }
}
export async function inviteFriend(
  email: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { db } = await member(true);
    email = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
      throw new Error("Enter a valid email.");
    const { data: existing } = await db
      .from("profiles")
      .select("id,active")
      .eq("email", email)
      .maybeSingle();
    if (existing?.active) throw new Error("This account is already a member.");
    const { error } = await db
      .from("invites")
      .upsert(
        {
          email,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          accepted_at: null,
        },
        { onConflict: "email" },
      )
      .select()
      .single();
    if (error) throw new Error("An invitation already exists for this email.");
    const result = existing
      ? await (
          await session()
        ).auth.resetPasswordForEmail(email, {
          redirectTo: appUrl() + "/auth/confirm",
        })
      : await db.auth.admin.inviteUserByEmail(email, {
          redirectTo: appUrl() + "/auth/confirm",
        });
    if (result.error)
      throw new Error(
        "Could not send invitation. Check email delivery settings, then resend.",
      );
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return message(e);
  }
}
export async function revokeInvite(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { db } = await member(true);
    const { data: invite, error } = await db
      .from("invites")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !invite || invite.accepted_at)
      throw new Error("Invitation is no longer pending.");
    const result = await db
      .from("invites")
      .delete()
      .eq("id", id)
      .is("accepted_at", null)
      .select("id");
    if (result.error || !result.data?.length)
      throw new Error("Could not revoke invitation.");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return message(e);
  }
}
export async function removeMember(
  id: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { user, db } = await member(true);
    if (id === user.id) throw new Error("You cannot remove yourself.");
    const { error } = await db
      .from("profiles")
      .update({ active: false })
      .eq("id", id)
      .neq("role", "owner");
    if (error) throw new Error("Could not remove member.");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return message(e);
  }
}
export async function logOut() {
  const db = await session();
  await db.auth.signOut();
  redirect("/login");
}
export async function login(
  email: string,
  password: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const db = await session();
    const { error } = await db.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { error: "Incorrect email or password." };
    try {
      await member();
    } catch {
      await db.auth.signOut();
      return { error: "An accepted invitation is required." };
    }
    return { ok: true };
  } catch (e) {
    return message(e);
  }
}
export async function forgotPassword(
  email: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const db = await session();
    const { error } = await db.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: appUrl() + "/auth/confirm",
    });
    if (error) throw new Error("Unable to send reset email. Try again later.");
    return { ok: true };
  } catch (e) {
    return message(e);
  }
}
export async function setPassword(
  password: string,
  name?: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    if (password.length < 12 || password.length > 128)
      throw new Error("Use 12–128 characters.");
    const db = await session();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) throw new Error("This link has expired. Request a new one.");
    if (name !== undefined) {
      if (!name.trim() || name.trim().length > 30)
        throw new Error("Use a name with 1–30 characters.");
    } else await member();
    const { error } = await db.auth.updateUser({ password });
    if (error) throw new Error(error.message);
    if (name !== undefined) {
      const { error: acceptError } = await admin().rpc("accept_invite", {
        p_user: user.id,
        p_name: name.trim(),
      });
      if (acceptError)
        throw new Error("This invitation has expired or was revoked.");
    }
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return message(e);
  }
}

export async function finishAuth(): Promise<{ path?: string; error?: string }> {
  try {
    const db = await session();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { error: "Link expired." };
    const { data: profile, error } = await admin()
      .from("profiles")
      .select("active")
      .eq("id", user.id)
      .single();
    if (error || !profile) return { error: "Invitation required." };
    return { path: profile.active ? "/reset-password" : "/accept-invite" };
  } catch (e) {
    return message(e);
  }
}

export async function createOwnerAccount(
  email: string,
  password: string,
  name: string,
): Promise<{ ok?: boolean; error?: string }> {
  email = email.trim().toLowerCase();
  name = name.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    return { error: "Enter a valid email." };
  if (!name || name.length > 30)
    return { error: "Use a name with 1–30 characters." };
  if (password.length < 12 || password.length > 128)
    return { error: "Use 12–128 characters." };
  const token = crypto.randomUUID();
  const db = admin();
  const { error: reserveError } = await db.rpc("begin_owner_signup", {
    p_email: email,
    p_token: token,
  });
  if (reserveError) return { error: "Account creation is unavailable." };
  let completed = false;
  try {
    const { data: existing, error: lookupError } = await db
      .from("profiles")
      .select("id,active")
      .eq("email", email)
      .maybeSingle();
    if (lookupError || existing?.active)
      throw new Error("Account creation is unavailable.");
    const result = existing
      ? await db.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
        })
      : await db.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
    if (result.error || !result.data.user)
      throw new Error("Could not create the account. Try again.");
    const { error: finishError } = await db.rpc("finish_owner_signup", {
      p_token: token,
      p_user: result.data.user.id,
      p_name: name,
    });
    if (finishError)
      throw new Error("Could not activate the owner account. Try again.");
    completed = true;
    const client = await session();
    const { error: loginError } = await client.auth.signInWithPassword({
      email,
      password,
    });
    revalidatePath("/");
    revalidatePath("/login");
    revalidatePath("/signup");
    if (loginError) return { error: "Account created. Log in to continue." };
    return { ok: true };
  } catch (error) {
    return message(error);
  } finally {
    if (!completed) await db.rpc("cancel_owner_signup", { p_token: token });
  }
}
