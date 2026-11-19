import {
  parseScore,
  dateInZone,
  gameNames,
  formatScore,
} from "../../lib/games.ts";
import { GAME_HOSTS } from "./config.js";
export function detectResult(
  text,
  hostname,
  date = dateInZone(),
  pageDate = date,
) {
  const game = GAME_HOSTS[hostname];
  if (!game || typeof text !== "string") return null;
  text = text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
  const candidates = [];
  if (game === "travle") {
    const route =
      /^Today I['’]d like to\s+travle\s+from\s+([^\n]+?)\s+to\s+([^\n]+)$/im.exec(
        text,
      );
    const result =
      /^Success![^\n]*\n[ \t]*(\d+) guesses?[ \t]*\(\+(\d+)\)[ \t]*$/im.exec(
        text,
      );
    if (route && result)
      candidates.push(
        `Travle ${pageDate}\n${route[1].trim()} → ${route[2].trim()}\n${result[1]} guesses (+${result[2]})`,
      );
  }
  if (game === "farflung") {
    for (const result of text.matchAll(
      /Farflung(?:[ \t]+Expedition)?[ \t]*#\d+[ \t]*\n[ \t]*[\d,]+[ \t]*km/gi,
    ))
      candidates.push(result[0]);
    const completed = /Expedition[ \t]*#(\d+)\s+Complete\s+([\d,]+)\s*km/i.exec(
      text,
    );
    if (completed)
      candidates.push(`Farflung #${completed[1]}\n${completed[2]} km`);
  }
  if (game === "animillion") {
    candidates.push(
      ...[
        ...text.matchAll(
          /ANIMILLION[ \t]*[·•][ \t]*CLIMB[ \t]*#\d+[ \t]*[·•][ \t]*Floor[ \t]+\d+\/700/gi,
        ),
      ].map((match) => match[0]),
    );
    for (const result of text.matchAll(
      /CLIMB[ \t]*#(\d+)[ \t]*[·•][ \t]*YOU REACHED\s+FLOOR[ \t]+(\d+)/gi,
    ))
      candidates.push(
        `ANIMILLION · CLIMB #${result[1]} · Floor ${result[2]}/700`,
      );
  }
  if (game === "linkdle") {
    const jumps = /Jumps[^\n]*\n\s*(\d+)/i.exec(text);
    const path = /Path[^\n]*\n([^]*?)(?=\nCan you do better|\nTry again)/i.exec(
      text,
    );
    if (
      /You have won/i.test(text) &&
      /Next linkdle in/i.test(text) &&
      jumps &&
      path
    ) {
      const words = path[1].split(/\s*\n\s*arrow_forward\s*\n\s*/);
      if (words.length > 1)
        candidates.push(
          `I solved today's linkdle (${words[0].trim()} → ${words.at(-1).trim()}) in ${jumps[1]} jumps! 🎉 https://linkdle.com/en`,
        );
    }
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
    const completed = /puzzle\s+(\d+)\s+([\d,]+)\s+of\s+5,?000/i.exec(text);
    if (completed && /(?:Share|Continue unlimited)/i.test(text))
      candidates.push(
        `Chainle #${completed[1]} · ${completed[2]} 🔗\nhttps://chainle.io`,
      );
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
    // The completed screen is restored on reload without generating share text.
    // Read its final total directly, never the background HUD or round scores.
    for (const result of text.matchAll(
      /\bDive[ \t]*#[ \t]*(\d+)[ \t]+complete[ \t]*\n[ \t]*(\d+)[ \t]*(?=\n|$)/gi,
    )) {
      candidates.push(`Krillion #${result[1]} 🦐\n${result[2]}`);
    }
  }
  if (game === "maptap") {
    const matches = [
      ...text.matchAll(
        /(?:www\.)?maptap\.gg\/?\s+[A-Za-z]+\s+\d{1,2}(?:,?\s+\d{4})?[^]*?Final score:\s*[\d,]+/gi,
      ),
    ];
    candidates.push(...matches.map((match) => match[0]));
    // The final screen uses SCORE, not Final score.
    const screenDate =
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),\s*(\d{4})/i.exec(
        text,
      );
    const total = /(?:^|\n)SCORE\s*\n\s*(\d+)(?=\n|$)/i.exec(text);
    if (screenDate && total && /Share your score/i.test(text)) {
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const month = months.find((value) =>
        value.toLowerCase().startsWith(screenDate[1].toLowerCase()),
      );
      candidates.push(
        `www.maptap.gg ${month} ${screenDate[2]}, ${screenDate[3]}\nFinal score: ${total[1]}`,
      );
    }
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
