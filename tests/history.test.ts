import test from "node:test";
import assert from "node:assert/strict";
import { mergeScoreHistory } from "../lib/history";
import type { Submission, History } from "../lib/types";
const share: Submission = {
  userId: "me",
  game: "krillion",
  score: 390,
  date: "2026-11-18",
  puzzleKey: "126",
  raw: "",
};
test("a submitted score appears immediately with pending Elo", () =>
  assert.deepEqual(mergeScoreHistory([share], []), [
    {
      date: share.date,
      game: share.game,
      score: 390,
      delta: null,
      rating: null,
    },
  ]));
test("daily rating replaces the pending row without duplicates", () => {
  const event: History = {
    date: share.date,
    game: share.game,
    score: 390,
    delta: 16,
    rating: 1016,
  };
  assert.deepEqual(mergeScoreHistory([share], [event]), [event]);
});
test("a replacement score updates the pending row", () => {
  const pending: History = {
    date: share.date,
    game: share.game,
    score: 300,
    delta: null,
    rating: null,
  };
  assert.equal(mergeScoreHistory([share], [pending])[0].score, 390);
});
test("zero Elo change is finalized, not pending", () => {
  const event: History = {
    date: share.date,
    game: share.game,
    score: 390,
    delta: 0,
    rating: 1000,
  };
  assert.deepEqual(mergeScoreHistory([share], [event]), [event]);
});
test("results from previous dates remain visible and newest day comes first", () => {
  const yesterday: History = {
    date: "2026-11-17",
    game: "chainle",
    score: 3457,
    delta: -5,
    rating: 995,
  };
  const results = mergeScoreHistory([share], [yesterday]);
  assert.equal(results.length, 2);
  assert.equal(results[0].date, "2026-11-18");
  assert.deepEqual(results[1], yesterday);
});
test("each game has a separate pending result", () =>
  assert.equal(
    mergeScoreHistory([share, { ...share, game: "maptap", score: 959 }], [])
      .length,
    2,
  ));
