import type { History, Submission } from "./types";

// A score exists immediately; rating fields appear only after daily settlement.
export function mergeScoreHistory(
  submissions: Submission[],
  events: History[],
): History[] {
  const rows = new Map(
    events.map((event) => [`${event.date}:${event.game}`, event]),
  );
  for (const submission of submissions) {
    const key = `${submission.date}:${submission.game}`;
    const existing = rows.get(key);
    if (existing?.delta != null) continue;
    rows.set(key, {
      date: submission.date,
      game: submission.game,
      score: submission.score,
      delta: null,
      rating: null,
    });
  }
  return [...rows.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || a.game.localeCompare(b.game),
  );
}
