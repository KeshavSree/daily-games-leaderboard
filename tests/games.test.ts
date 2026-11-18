import test from "node:test";
import assert from "node:assert/strict";
import {
  parseScore,
  sampleScore,
  dateInZone,
  defaultSettings,
  puzzleNumber,
} from "../lib/games";
const day = "2026-11-18";
const map =
  "www.maptap.gg November 18\n95🏅 95🏅 92🏆 99🔥 96🔥\nFinal score: 959";
const chain =
  "Chainle #91 · 3,457 🔗\nBeat 53% of players\n🟥🟩🟨🟧🟩\nhttps://chainle.io";
test("MapTap extracts only the final score", () =>
  assert.deepEqual(parseScore(map, day), {
    game: "maptap",
    date: day,
    puzzleKey: day,
    score: 959,
  }));
test("Chainle extracts total, not percentile or round count", () =>
  assert.deepEqual(parseScore(chain, day), {
    game: "chainle",
    date: day,
    puzzleKey: "91",
    score: 3457,
  }));
test("CRLF, whitespace and comma formatted totals", () =>
  assert.equal(
    parseScore(map.replaceAll("\n", "\r\n").replace("959", "1,000") + "\n", day)
      .score,
    1000,
  ));
test("yesterday and future puzzles are rejected", () => {
  assert.throws(() => parseScore(map, "2026-11-19"), /today/);
  assert.throws(() => parseScore(chain.replace("#91", "#90"), day), /today/);
  assert.throws(() => parseScore(chain.replace("#91", "#92"), day), /today/);
});
test("duplicate and mixed shares rejected", () => {
  assert.throws(() => parseScore(map + "\nFinal score: 1", day));
  assert.throws(() => parseScore(chain + "\n" + chain, day));
  assert.throws(() => parseScore(map + "\n" + chain, day), /one game/);
});
test("out-of-range, malformed and partial values rejected", () => {
  for (const raw of [
    map.replace("959", "1001"),
    map.replace("959", "-1"),
    chain.replace("3,457", "5,001"),
    chain.replace("3,457", "3,45"),
    map.replace("959", "95.9"),
    chain.replace("https://chainle.io", ""),
    "",
    "garbage",
  ])
    assert.throws(() => parseScore(raw, day));
});
test("year is inferred from open date, explicit wrong year rejected", () => {
  assert.equal(
    parseScore("www.maptap.gg January 1\nFinal score: 1", "2027-01-01").date,
    "2027-01-01",
  );
  assert.throws(() =>
    parseScore(map.replace("November 18", "November 18, 2025"), day),
  );
});
test("group day rolls over at local midnight, including DST", () => {
  assert.equal(dateInZone(new Date("2026-11-18T04:59:59Z")), "2026-11-17");
  assert.equal(dateInZone(new Date("2026-11-18T05:00:00Z")), "2026-11-18");
  assert.equal(dateInZone(new Date("2026-07-01T04:00:00Z")), "2026-07-01");
});
test("puzzle number advances across month and year boundaries", () => {
  assert.equal(puzzleNumber("2026-11-19"), 92);
  assert.equal(puzzleNumber("2027-01-01"), 135);
});
test("both generated sample shares parse", () => {
  for (const game of ["maptap", "chainle"] as const)
    assert.equal(parseScore(sampleScore(game, day), day).game, game);
});
test("custom Chainle anchor is respected", () => {
  assert.equal(
    parseScore(chain, day, {
      ...defaultSettings,
      chainleAnchorNumber: 90,
      chainleAnchorDate: "2026-11-17",
    }).score,
    3457,
  );
});

const krillion = "Krillion #126 🦐\n390\n\n🐟🦑🦑🏮🫧🏮🦑";
test("Krillion parses puzzle identity and total, ignoring emojis", () => {
  assert.deepEqual(parseScore(krillion, day), {
    game: "krillion",
    score: 390,
    puzzleKey: "126",
    date: day,
  });
  assert.equal(parseScore(krillion.replaceAll("\n", "\r\n"), day).score, 390);
});
test("Krillion puzzle number identifies the date", () => {
  assert.throws(
    () => parseScore(krillion.replace("#126", "#125"), day),
    /today/,
  );
  assert.throws(
    () => parseScore(krillion.replace("#126", "#127"), day),
    /today/,
  );
  assert.throws(() => parseScore(krillion, "2026-11-19"), /today/);
  assert.equal(
    parseScore(krillion.replace("#126", "#127"), "2026-11-19").puzzleKey,
    "127",
  );
  assert.equal(
    parseScore(krillion.replace("#126", "#170"), "2027-01-01").puzzleKey,
    "170",
  );
});
test("Krillion rejects invalid scores and ambiguous shares", () => {
  for (const share of [
    krillion.replace("390", "701"),
    krillion.replace("390", "-1"),
    krillion.replace("390", "39.0"),
    krillion.replace("390", ""),
    krillion + "\n" + krillion,
    krillion + "\n391",
    krillion + "\n" + map,
    krillion + "\n" + chain,
  ])
    assert.throws(() => parseScore(share, day));
  assert.equal(parseScore(krillion.replace("390", "0"), day).score, 0);
  assert.equal(parseScore(krillion.replace("390", "700"), day).score, 700);
});
test("Krillion supports a configurable puzzle anchor", () =>
  assert.equal(
    parseScore(krillion, day, {
      ...defaultSettings,
      krillionAnchorDate: "2026-11-17",
      krillionAnchorNumber: 125,
    }).score,
    390,
  ));
test("Krillion generated sample parses", () =>
  assert.equal(parseScore(sampleScore("krillion", day), day).score, 390));
