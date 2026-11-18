export type Entrant = { id: string; rating: number; score: number };
export function calculateElo(
  players: Entrant[],
  k = 32,
): Record<string, number> {
  if (new Set(players.map((p) => p.id)).size !== players.length)
    throw new Error("Duplicate player");
  if (
    players.some((p) => !Number.isFinite(p.rating) || !Number.isFinite(p.score))
  )
    throw new Error("Invalid rating or score");
  return Object.fromEntries(
    players.map((player) => [
      player.id,
      players.length < 2
        ? 0
        : (k / (players.length - 1)) *
          players.reduce((sum, other) => {
            if (player.id === other.id) return sum;
            const actual =
              player.score === other.score
                ? 0.5
                : player.score > other.score
                  ? 1
                  : 0;
            const expected =
              1 / (1 + 10 ** ((other.rating - player.rating) / 400));
            return sum + actual - expected;
          }, 0),
    ]),
  );
}
