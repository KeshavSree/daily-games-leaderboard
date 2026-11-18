import { DAILY, GAME_HOSTS } from "./config.js";
import { parseScore, dateInZone } from "../../lib/games.ts";
let bridgeId;
let queue = Promise.resolve();
async function bridge(message) {
  if (bridgeId) {
    try {
      const tab = await chrome.tabs.get(bridgeId);
      if (
        !tab.url ||
        new URL(tab.url).origin !== DAILY ||
        new URL(tab.url).pathname !== "/extension"
      )
        bridgeId = undefined;
    } catch {
      bridgeId = undefined;
    }
  }
  if (!bridgeId) {
    const existing = await chrome.tabs.query({ url: DAILY + "/extension" });
    bridgeId = existing[0]?.id;
  }
  if (!bridgeId) {
    const tab = await chrome.tabs.create({
      url: DAILY + "/extension",
      active: false,
    });
    bridgeId = tab.id;
  }
  // The new tab may still be loading its content script.
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      return await chrome.tabs.sendMessage(bridgeId, {
        ...message,
        type: "daily:bridge",
      });
    } catch {
      if (attempt === 39)
        throw new Error("Open Daily and log in, then try again.");
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (
    sender.id !== chrome.runtime.id ||
    !["daily:submit", "daily:status", "daily:login"].includes(message?.type)
  )
    return;
  const extensionPage =
    !sender.tab && sender.url === chrome.runtime.getURL("popup.html");
  let game;
  try {
    game = GAME_HOSTS[new URL(sender.tab?.url || "").hostname];
  } catch {}
  if (!extensionPage && !game) return;
  if (message.type === "daily:login") {
    if (!extensionPage) return;
    chrome.tabs
      .create({ url: DAILY + "/login" })
      .then(() => reply({ ok: true }));
    return true;
  }
  let raw;
  if (message.type === "daily:submit") {
    try {
      raw = message.raw;
      const parsed = parseScore(raw, dateInZone());
      if (game && parsed.game !== game) throw new Error("Wrong game.");
    } catch (error) {
      reply({ error: error.message });
      return;
    }
  }
  const work = () =>
    bridge({
      operation: message.type === "daily:submit" ? "submit" : "status",
      raw,
    });
  const result = queue.then(work, work);
  queue = result.catch(() => {});
  result
    .then(reply)
    .catch((error) =>
      reply({ error: error.message || "Could not reach Daily." }),
    );
  return true;
});
chrome.tabs.onRemoved.addListener((id) => {
  if (id === bridgeId) bridgeId = undefined;
});
