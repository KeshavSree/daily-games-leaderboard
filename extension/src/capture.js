(() => {
  const publish = (text) => {
    if (
      typeof text === "string" &&
      text.length <= 4000 &&
      /(?:maptap\.gg|Chainle\s*#|Krillion\s*#|today['’]s linkdle)/i.test(text)
    )
      window.postMessage({ type: "daily:share", text }, location.origin);
  };
  // Observe only text the game itself is sharing; never read the clipboard.
  try {
    const original = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = async function (text) {
      const result = await original(text);
      publish(text);
      return result;
    };
  } catch {
    /* Visible result detection remains available. */
  }
  try {
    if (navigator.share) {
      const original = navigator.share.bind(navigator);
      navigator.share = function (data) {
        publish([data?.text, data?.url].filter(Boolean).join(" "));
        return original(data);
      };
    }
  } catch {}
  const exec = document.execCommand.bind(document);
  document.execCommand = function (command, ...args) {
    let text;
    if (String(command).toLowerCase() === "copy") {
      const active = document.activeElement;
      if (
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLInputElement
      )
        text = active.value.slice(
          active.selectionStart ?? 0,
          active.selectionEnd ?? active.value.length,
        );
    }
    const result = exec(command, ...args);
    if (result && text) publish(text);
    return result;
  };
  document.addEventListener("copy", (event) => {
    queueMicrotask(() => publish(event.clipboardData?.getData("text/plain")));
  });
})();
