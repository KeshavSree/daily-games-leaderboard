import { DAILY } from "./config.js";
if (location.origin === DAILY && location.pathname === "/extension") {
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || message?.type !== "daily:bridge")
      return;
    (async () => {
      const session = await fetch("/api/extension", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await session.json();
      if (!session.ok)
        return {
          ...data,
          ...(session.status === 401 ? { authenticated: false } : {}),
        };
      if (message.operation === "status") return { ok: true, name: data.name };
      if (message.operation !== "submit" || typeof message.raw !== "string")
        return { error: "Invalid request." };
      const result = await fetch("/api/extension", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Daily-CSRF": data.csrf,
        },
        body: JSON.stringify({ raw: message.raw }),
      });
      return result.json();
    })()
      .then(reply)
      .catch(() => reply({ error: "Could not reach Daily. Try again." }));
    return true;
  });
}
