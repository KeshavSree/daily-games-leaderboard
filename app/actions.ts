"use server";
import { randomBytes } from "node:crypto";
import { invitationHash } from "@/lib/invitation-links";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { admin, appUrl, member, session } from "@/lib/supabase";
import { dateInZone, parseScore } from "@/lib/games";
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
      animillionAnchorDate: s.animillion_anchor_date,
      animillionAnchorNumber: s.animillion_anchor_number,
      farflungAnchorDate: s.farflung_anchor_date,
      farflungAnchorNumber: s.farflung_anchor_number,
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

export async function createInviteLink(): Promise<{
  url?: string;
  error?: string;
}> {
  try {
    const { user, db } = await member(true);
    const token = randomBytes(32).toString("base64url");
    const { error } = await db
      .from("member_invites")
      .insert({ token_hash: invitationHash(token), created_by: user.id });
    if (error) throw new Error("Could not create invite. Try again.");
    return { url: appUrl() + "/join/" + token };
  } catch (error) {
    return message(error);
  }
}

export async function joinWithInvite(
  token: string,
  email: string,
  password: string,
  name: string,
): Promise<{ ok?: boolean; error?: string }> {
  const hash = invitationHash(token);
  if (!hash) return { error: "Invite unavailable." };
  email = email.trim().toLowerCase();
  name = name.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    return { error: "Enter a valid email." };
  if (!name || name.length > 30)
    return { error: "Use a name with 1–30 characters." };
  if (password.length < 12 || password.length > 128)
    return { error: "Use 12–128 characters." };
  const db = admin();
  const reservation = crypto.randomUUID();
  const { error: reserveError } = await db.rpc("reserve_member_invite", {
    p_hash: hash,
    p_reservation: reservation,
  });
  if (reserveError)
    return { error: "This invite has expired or already been used." };
  let createdUser: string | undefined;
  let completed = false;
  try {
    const { data: existing, error: lookupError } = await db
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (lookupError) throw new Error("Could not check account. Try again.");
    if (existing)
      throw new Error("This email already has an account. Log in instead.");
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user)
      throw new Error(
        "Could not create account. Try another email or try again.",
      );
    createdUser = data.user.id;
    const { error: completeError } = await db.rpc("complete_member_invite", {
      p_hash: hash,
      p_reservation: reservation,
      p_user: createdUser,
      p_name: name,
    });
    if (completeError) throw new Error("Could not join. Try again.");
    completed = true;
    const client = await session();
    const { error: loginError } = await client.auth.signInWithPassword({
      email,
      password,
    });
    revalidatePath("/");
    if (loginError) return { error: "Account created. Log in to continue." };
    return { ok: true };
  } catch (error) {
    return message(error);
  } finally {
    if (!completed) {
      if (createdUser) {
        const { data: profile } = await db
          .from("profiles")
          .select("active")
          .eq("id", createdUser)
          .single();
        if (profile && !profile.active)
          await db.auth.admin.deleteUser(createdUser);
      }
      await db.rpc("release_member_invite", {
        p_hash: hash,
        p_reservation: reservation,
      });
    }
  }
}
