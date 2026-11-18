import test from "node:test";
import assert from "node:assert/strict";
import { calculateElo } from "../lib/elo";
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
test("equal ratings exchange 16 points", () =>
  assert.deepEqual(
    calculateElo([
      { id: "a", rating: 1000, score: 959 },
      { id: "b", rating: 1000, score: 950 },
    ]),
    { a: 16, b: -16 },
  ));
test("favorites gain less and upsets gain more", () => {
  const win = calculateElo([
    { id: "a", rating: 1200, score: 100 },
    { id: "b", rating: 1000, score: 50 },
  ]);
  near(win.a, 7.688098347265352);
  const loss = calculateElo([
    { id: "a", rating: 1200, score: 50 },
    { id: "b", rating: 1000, score: 100 },
  ]);
  near(loss.b, 24.311901652734648);
});
test("equal ratings and tied scores produce no change", () =>
  assert.deepEqual(
    calculateElo([
      { id: "a", rating: 1000, score: 959 },
      { id: "b", rating: 1000, score: 959 },
    ]),
    { a: 0, b: 0 },
  ));
test("a draw against a stronger player gains points", () =>
  assert.ok(
    calculateElo([
      { id: "a", rating: 1000, score: 50 },
      { id: "b", rating: 1200, score: 50 },
    ]).a > 0,
  ));
test("zero and one participants are unrated", () => {
  assert.deepEqual(calculateElo([]), {});
  assert.deepEqual(calculateElo([{ id: "a", rating: 1000, score: 5 }]), {
    a: 0,
  });
});
test("multiplayer remains zero-sum and bounded", () => {
  const players = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    rating: 900 + i * 25,
    score: i * 100,
  }));
  const result = calculateElo(players);
  near(
    Object.values(result).reduce((a, b) => a + b, 0),
    0,
  );
  assert.ok(Object.values(result).every((x) => Math.abs(x) <= 32));
});
test("results are independent of submission order", () => {
  const players = [
    { id: "a", rating: 1100, score: 3 },
    { id: "b", rating: 1000, score: 2 },
    { id: "c", rating: 900, score: 1 },
  ];
  const a = calculateElo(players),
    b = calculateElo([...players].reverse());
  for (const id of Object.keys(a)) near(a[id], b[id]);
});
test("score margins do not affect Elo", () => {
  const ratings = [
    { id: "a", rating: 1000, score: 2 },
    { id: "b", rating: 1000, score: 1 },
  ];
  assert.deepEqual(
    calculateElo(ratings),
    calculateElo([{ ...ratings[0], score: 1000 }, ratings[1]]),
  );
});
test("duplicate players are rejected", () =>
  assert.throws(() =>
    calculateElo([
      { id: "a", rating: 1000, score: 2 },
      { id: "a", rating: 1000, score: 1 },
    ]),
  ));
