import { mergeScoreHistory } from "@/lib/history";
import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard";
import { demoData } from "@/lib/demo";
import { configured, isDemo, member, admin } from "@/lib/supabase";
import { dateInZone } from "@/lib/games";
import type { DashboardData } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Home() {
  if (isDemo()) return <Dashboard initial={demoData()} />;
  if (!configured())
    return (
      <main className="auth-shell">
        <a className="wordmark" href="/">
          daily<span>/</span>
        </a>
        <h1>Almost ready.</h1>
        <p className="muted">Connect Supabase to enable your leaderboard.</p>
      </main>
    );
  let current;
  try {
    current = await member();
  } catch {
    redirect("/login");
  }
  const db = admin();
  const { data: s, error: settingsError } = await db
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (settingsError || !s)
    throw new Error("Run the database migration to configure Daily.");
  const settings = {
    timezone: s.timezone,
    chainleAnchorDate: s.chainle_anchor_date,
    chainleAnchorNumber: s.chainle_anchor_number,
    krillionAnchorDate: s.krillion_anchor_date,
    krillionAnchorNumber: s.krillion_anchor_number,
  };
  const date = dateInZone(new Date(), settings.timezone);
  const [profiles, scores, history, latest, invites, lastScore] =
    await Promise.all([
      db
        .from("profiles")
        .select("*")
        .eq("active", true)
        .order("rating", { ascending: false }),
      db.from("submissions").select("*").eq("puzzle_date", date),
      db
        .from("rating_events")
        .select("*")
        .eq("user_id", current.user.id)
        .order("puzzle_date", { ascending: false })
        .limit(100),
      db
        .from("settlements")
        .select("puzzle_date")
        .order("puzzle_date", { ascending: false })
        .limit(1),
      current.profile.role === "owner"
        ? db
            .from("invites")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [], error: null }),
      db
        .from("submissions")
        .select("*")
        .eq("user_id", current.user.id)
        .order("updated_at", { ascending: false })
        .order("game")
        .limit(100),
    ]);
  for (const result of [profiles, scores, history, latest, invites, lastScore])
    if (result.error) throw new Error("Could not load leaderboard.");
  const last = latest.data?.[0]?.puzzle_date;
  const changes = last
    ? await db
        .from("rating_events")
        .select("user_id,delta")
        .eq("puzzle_date", last)
    : { data: [] };
  const players = await Promise.all(
    (profiles.data || []).map(async (p) => {
      let avatar = null;
      if (p.avatar_path) {
        const { data } = await db.storage
          .from("avatars")
          .createSignedUrl(p.avatar_path, 3600);
        avatar = data?.signedUrl || null;
      }
      return {
        id: p.id,
        name: p.display_name,
        rating: Number(p.rating),
        role: p.role,
        active: p.active,
        avatar,
        delta: (changes.data || [])
          .filter((e) => e.user_id === p.id)
          .reduce((a, e) => a + Number(e.delta), 0),
      };
    }),
  );
  const recent = lastScore.data?.[0];
  const initial: DashboardData = {
    latestSubmission: recent
      ? {
          userId: recent.user_id,
          game: recent.game,
          score: recent.score,
          date: recent.puzzle_date,
          puzzleKey: recent.puzzle_key,
          raw: recent.raw_text,
        }
      : null,
    demo: false,
    date,
    settings,
    me: current.user.id,
    players,
    submissions: (scores.data || []).map((x) => ({
      userId: x.user_id,
      game: x.game,
      score: x.score,
      date: x.puzzle_date,
      puzzleKey: x.puzzle_key,
      raw: x.user_id === current.user.id ? x.raw_text : "",
    })),
    history: mergeScoreHistory(
      (lastScore.data || []).map((x) => ({
        userId: x.user_id,
        game: x.game,
        score: x.score,
        date: x.puzzle_date,
        puzzleKey: x.puzzle_key,
        raw: "",
      })),
      (history.data || []).map((x) => ({
        date: x.puzzle_date,
        game: x.game,
        score: x.score,
        delta: Number(x.delta),
        rating: Number(x.rating_after),
      })),
    ),
    invites: (invites.data || []).map((x) => ({
      id: x.id,
      email: x.email,
      expires: x.expires_at,
      accepted: !!x.accepted_at,
    })),
  };
  return <Dashboard initial={initial} />;
}
