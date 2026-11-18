import {
  parseScore,
  dateInZone,
  gameNames,
  formatScore,
} from "../../lib/games.ts";
import { GAME_HOSTS } from "./config.js";
export function detectResult(text, hostname, date = dateInZone()) {
  const game = GAME_HOSTS[hostname];
  if (!game || typeof text !== "string") return null;
  text = text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
  const candidates = [];
  if (game === "linkdle") {
    const match =
      /I solved today['’]s linkdle[^\n]*?in\s+\d+\s+jumps?!\s*🎉(?:\s+https:\/\/(?:www\.)?linkdle\.com\/en\/?)?/i.exec(
        text,
      );
    if (match)
      candidates.push(
        match[0].includes("https://")
          ? match[0]
          : match[0] + " https://linkdle.com/en",
      );
  }
  if (game === "chainle") {
    const matches = [...text.matchAll(/Chainle\s*#\d+\s*[·•]\s*[\d,]+\s*🔗/gi)];
    for (const match of matches)
      candidates.push(match[0] + "\nhttps://chainle.io");
  }
  if (game === "krillion") {
    const matches = [
      ...text.matchAll(
        /Krillion[ \t]*#\d+[ \t]*🦐[ \t]*\n\s*\d+[ \t]*(?=\n|$)/gi,
      ),
    ];
    candidates.push(...matches.map((match) => match[0]));
  }
  if (game === "maptap") {
    const matches = [
      ...text.matchAll(
        /(?:www\.)?maptap\.gg\/?\s+[A-Za-z]+\s+\d{1,2}(?:,?\s+\d{4})?[^]*?Final score:\s*[\d,]+/gi,
      ),
    ];
    candidates.push(...matches.map((match) => match[0]));
    // Some result screens show the date and final score, without the share URL.
    const label = new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
    const final = /Final score:\s*([\d,]+)/i.exec(text);
    if (final && text.includes(label))
      candidates.push(`www.maptap.gg ${label}\nFinal score: ${final[1]}`);
  }
  const valid = [];
  for (const raw of candidates) {
    try {
      const parsed = parseScore(raw, date);
      if (parsed.game === game)
        valid.push({
          raw,
          ...parsed,
          name: gameNames[game],
          display: formatScore(game, parsed.score),
        });
    } catch {}
  }
  // Never pick one result out of a page containing conflicting results.
  const keys = new Set(
    valid.map((result) => JSON.stringify([result.puzzleKey, result.score])),
  );
  return keys.size === 1 ? valid[0] : null;
}
