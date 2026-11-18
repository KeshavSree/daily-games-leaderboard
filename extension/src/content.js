import { dateInZone } from "../../lib/games.ts";
import { detectResult } from "./detect.js";
let candidate = null;
let captured = "";
let capturedDate = "";
let host, root, label, button, status;
let busy = false;
let dismissed = "";
let submitted = "";
const key = (result) =>
  result
    ? JSON.stringify([result.game, result.date, result.puzzleKey, result.score])
    : "";
function mount() {
  host = document.createElement("div");
  host.id = "daily-extension";
  root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `<style>
    :host{all:initial;position:fixed;bottom:24px;right:24px;z-index:2147483647;font:14px system-ui;color:#eee}
    section{background:#090909;border:1px solid #444;padding:16px;min-width:220px;box-shadow:0 8px 32px #0006}
    header{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:12px}
    b{font-size:19px;letter-spacing:-1px}em{color:#c9a44c;font-style:normal}
    button{font:inherit;cursor:pointer;border:1px solid #555;background:#e8e8e4;color:#111;padding:10px 14px;width:100%}
    button:disabled{opacity:.5;cursor:default}.close{background:transparent;border:0;color:#aaa;width:auto;padding:0 3px;font-size:20px}
    p{margin:0 0 12px}output{display:block;max-width:280px;font-size:12px;line-height:1.5;color:#aaa}output:not(:empty){margin-top:10px}
  </style><section aria-label="Daily score"><header><b>daily<em>/</em></b><button class="close" aria-label="Dismiss">×</button></header><p></p><button class="submit">Submit to Daily</button><output aria-live="polite"></output></section>`;
  label = root.querySelector("p");
  button = root.querySelector(".submit");
  status = root.querySelector("output");
  button.addEventListener("click", submit);
  root.querySelector(".close").addEventListener("click", () => {
    dismissed = key(candidate);
    host.remove();
  });
  document.documentElement.append(host);
}
function show(next) {
  if (!next) return;
  const changed = key(next) !== key(candidate);
  candidate = next;
  if (dismissed === key(next)) return;
  if (!host?.isConnected) mount();
  if (changed || !label.textContent) {
    label.textContent = `${next.name} / ${next.display}`;
    status.textContent = "";
    button.disabled = busy || submitted === key(next);
    button.textContent =
      submitted === key(next) ? "Submitted" : "Submit to Daily";
  }
}
async function submit() {
  if (busy || !candidate) return;
  const current = candidate;
  busy = true;
  button.disabled = true;
  status.textContent = "Submitting…";
  try {
    const result = await chrome.runtime.sendMessage({
      type: "daily:submit",
      raw: current.raw,
    });
    if (!result?.ok) throw new Error(result?.error || "Could not submit.");
    submitted = key(current);
    button.textContent = "Submitted";
    status.textContent = "";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    busy = false;
    button.disabled = submitted === key(candidate);
  }
}
function scan() {
  if (busy) return;
  const today = dateInZone();
  if (capturedDate !== today) captured = "";
  if (candidate && candidate.date !== today) {
    candidate = null;
    host?.remove();
  }
  const visible = document.body?.innerText || "";
  const texts = [visible.slice(0, 200000)];
  // Linkdle exposes its completed result as the share button's title.
  for (const el of document.querySelectorAll(
    "[title],textarea,input[readonly]",
  )) {
    const value = el.getAttribute("title") || el.value || "";
    if (value.length <= 4000) texts.push(value);
  }
  let next = detectResult(texts.join("\n"), location.hostname);
  if (!next && captured) next = detectResult(captured, location.hostname);
  if (next) show(next);
}
window.addEventListener("message", (event) => {
  if (
    event.source !== window ||
    event.origin !== location.origin ||
    event.data?.type !== "daily:share"
  )
    return;
  const raw = event.data.text;
  if (typeof raw !== "string" || raw.length > 4000) return;
  const next = detectResult(raw, location.hostname);
  if (next) {
    captured = raw;
    capturedDate = dateInZone();
    show(next);
  }
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message.type === "result") {
    scan();
    reply({ result: candidate });
  }
});
let timer;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(scan, 250);
}).observe(document.documentElement, {
  subtree: true,
  childList: true,
  characterData: true,
});
scan();
