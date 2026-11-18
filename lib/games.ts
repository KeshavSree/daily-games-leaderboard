export type Game = "maptap" | "chainle" | "krillion" | "linkdle";
export type ParsedScore = {
  game: Game;
  score: number;
  puzzleKey: string;
  date: string;
};
export const gameNames: Record<Game, string> = {
  linkdle: "Linkdle",
  maptap: "MapTap",
  chainle: "Chainle",
  krillion: "Krillion",
};
export const gameLinks: Record<Game, string> = {
  linkdle: "https://linkdle.com/en",
  krillion: "https://krillion.io",
  chainle: "https://chainle.io",
  maptap: "https://www.maptap.gg",
};
export const supportedGames: Game[] = [
  "krillion",
  "chainle",
  "maptap",
  "linkdle",
];
export const defaultSettings = {
  timezone: "America/Indiana/Indianapolis",
  chainleAnchorDate: "2026-11-18",
  chainleAnchorNumber: 91,
  krillionAnchorDate: "2026-11-18",
  krillionAnchorNumber: 126,
};
export type Settings = typeof defaultSettings;
export function dateInZone(
  now = new Date(),
  timezone = defaultSettings.timezone,
) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function puzzleNumber(
  date: string,
  settings: Settings = defaultSettings,
) {
  return (
    settings.chainleAnchorNumber +
    Math.round(
      (Date.parse(date + "T12:00:00Z") -
        Date.parse(settings.chainleAnchorDate + "T12:00:00Z")) /
        86400000,
    )
  );
}
export function krillionPuzzleNumber(
  date: string,
  settings: Settings = defaultSettings,
) {
  return (
    settings.krillionAnchorNumber +
    Math.round(
      (Date.parse(date + "T12:00:00Z") -
        Date.parse(settings.krillionAnchorDate + "T12:00:00Z")) /
        86400000,
    )
  );
}
export function parseScore(
  raw: string,
  date: string,
  settings: Settings = defaultSettings,
): ParsedScore {
  if (!raw.trim()) throw new Error("Paste a score first.");
  if (raw.length > 4000) throw new Error("Share text is too long.");
  const text = raw.replace(/\r\n?/g, "\n").trim();
  const isMap = /(?:www\.)?maptap\.gg\b/i.test(text);
  const isChain = /chainle\s*#/i.test(text);
  const isKrillion = /krillion\s*#/i.test(text);
  const isLinkdle = /\blinkdle\b/i.test(text);
  if ([isMap, isChain, isKrillion, isLinkdle].filter(Boolean).length > 1)
    throw new Error("Submit one game at a time.");
  if (isLinkdle) {
    const share =
      /^I solved today['’]s linkdle[ \t]+\(([^()\n→]+)→([^()\n→]+)\)[ \t]+in[ \t]+(\d+)[ \t]+jumps?![ \t]*🎉[ \t]+https:\/\/(?:www\.)?linkdle\.com\/en\/?$/i.exec(
        text,
      );
    if (!share) throw new Error("Paste the full Linkdle share text.");
    const words = [share[1], share[2]].map((word) =>
      word.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase(),
    );
    if (words.some((word) => !word || word.length > 100))
      throw new Error("Invalid Linkdle words.");
    const score = Number(share[3]);
    if (!Number.isSafeInteger(score) || score < 1 || score > 2147483647)
      throw new Error("Invalid Linkdle jump count.");
    return {
      game: "linkdle",
      score,
      puzzleKey: JSON.stringify([date, ...words]),
      date,
    };
  }
  if (isMap) {
    const headers = [
      ...text.matchAll(
        /^(?:https?:\/\/)?(?:www\.)?maptap\.gg\/?\s+([A-Za-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?\s*$/gim,
      ),
    ];
    const totals = [
      ...text.matchAll(/^Final score:\s*(\d{1,3}(?:,\d{3})+|\d+)\s*$/gim),
    ];
    if (headers.length !== 1 || totals.length !== 1)
      throw new Error("Paste the full MapTap share text.");
    const months = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ];
    const [, month, day, year] = headers[0];
    const expected = `${year || date.slice(0, 4)}-${String(months.indexOf(month.toLowerCase()) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
    if (expected !== date) throw new Error("Only today’s puzzle is open.");
    const score = Number(totals[0][1].replaceAll(",", ""));
    if (!Number.isSafeInteger(score) || score < 0 || score > 1000)
      throw new Error("MapTap scores must be 0–1,000.");
    return { game: "maptap", score, puzzleKey: date, date };
  }
  if (isChain) {
    const headers = [
      ...text.matchAll(
        /^Chainle\s*#(\d+)\s*[·•]\s*(\d{1,3}(?:,\d{3})+|\d+)\s*🔗\s*$/gim,
      ),
    ];
    if (
      headers.length !== 1 ||
      !/^https:\/\/(?:www\.)?chainle\.io\/?\s*$/im.test(text)
    )
      throw new Error("Paste the full Chainle share text.");
    const number = Number(headers[0][1]);
    const score = Number(headers[0][2].replaceAll(",", ""));
    if (!Number.isSafeInteger(score) || score < 0 || score > 5000)
      throw new Error("Chainle scores must be 0–5,000.");
    if (number !== puzzleNumber(date, settings))
      throw new Error("Only today’s Chainle puzzle is open.");
    return { game: "chainle", score, puzzleKey: String(number), date };
  }
  if (isKrillion) {
    const headers = [
      ...text.matchAll(/^Krillion[ \t]*#(\d+)[ \t]*🦐[ \t]*$/gim),
    ];
    const share =
      /^Krillion[ \t]*#(\d+)[ \t]*🦐[ \t]*\n[ \t]*(\d+)[ \t]*(?:\n|$)/i.exec(
        text,
      );
    const totals = [...text.matchAll(/^[ \t]*\d+[ \t]*$/gm)];
    if (headers.length !== 1 || !share || totals.length !== 1)
      throw new Error("Paste the full Krillion share text.");
    const number = Number(share[1]);
    const score = Number(share[2]);
    if (!Number.isSafeInteger(score) || score < 0 || score > 700)
      throw new Error("Krillion scores must be 0–700.");
    if (number !== krillionPuzzleNumber(date, settings))
      throw new Error("Only today’s Krillion puzzle is open.");
    return { game: "krillion", score, puzzleKey: String(number), date };
  }
  throw new Error("Use a Krillion, Chainle, MapTap, or Linkdle share.");
}
export function sampleScore(
  game: Game,
  date: string,
  settings: Settings = defaultSettings,
) {
  if (game === "linkdle")
    return "I solved today’s linkdle (Torque → Adverb) in 3 jumps! 🎉 https://linkdle.com/en";
  if (game === "krillion")
    return `Krillion #${krillionPuzzleNumber(date, settings)} 🦐\n390\n\n🐟🦑🦑🏮🫧🏮🦑`;
  if (game === "chainle")
    return `Chainle #${puzzleNumber(date, settings)} · 3,457 🔗\nBeat 53% of players\n🟥🟩🟨🟧🟩\nhttps://chainle.io`;
  const label = new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return `www.maptap.gg ${label}\n95🏅 95🏅 92🏆 99🔥 96🔥\nFinal score: 959`;
}

export function formatScore(game: Game, score: number) {
  const value = score.toLocaleString("en-US");
  return game === "linkdle"
    ? `${value} ${score === 1 ? "jump" : "jumps"}`
    : value;
}
