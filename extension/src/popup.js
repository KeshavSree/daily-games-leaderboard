const label = document.querySelector("#result");
const button = document.querySelector("#submit");
const status = document.querySelector("#status");
let candidate;
(async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const response = await chrome.tabs.sendMessage(tab.id, { type: "result" });
    candidate = response?.result;
  } catch {}
  label.textContent = candidate
    ? `${candidate.name} / ${candidate.display}`
    : "Finish a supported game. If needed, click the game’s Share button.";
  button.hidden = !candidate;
})();
button.addEventListener("click", async () => {
  if (!candidate) return;
  button.disabled = true;
  status.textContent = "Submitting…";
  try {
    const result = await chrome.runtime.sendMessage({
      type: "daily:submit",
      raw: candidate.raw,
    });
    if (!result?.ok) throw new Error(result?.error || "Could not submit.");
    button.textContent = "Submitted";
    status.textContent = "";
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
});
document
  .querySelector("#login")
  .addEventListener("click", () =>
    chrome.runtime.sendMessage({ type: "daily:login" }),
  );

const account = document.querySelector("#account");
const login = document.querySelector("#login");
async function refreshAccount() {
  login.hidden = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: "daily:status" });
    if (result?.ok) {
      account.textContent = `Logged in as ${result.name}`;
    } else if (result?.authenticated === false) {
      account.textContent = "";
      login.hidden = false;
    } else {
      account.textContent = "Could not check account";
    }
  } catch {
    account.textContent = "Could not check account";
  }
}
void refreshAccount();
