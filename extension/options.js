// Options page: store App URL + shared token in chrome.storage.sync.
const $ = (id) => document.getElementById(id);
const DEFAULT_URL = "http://localhost:3000";

chrome.storage.sync.get(["dfAppUrl", "dfToken"]).then(({ dfAppUrl, dfToken }) => {
  $("url").value = dfAppUrl || DEFAULT_URL;
  $("tok").value = dfToken || "";
});

$("save").addEventListener("click", async () => {
  let origin;
  try { origin = new URL($("url").value.trim() || DEFAULT_URL).origin; }
  catch { $("msg").textContent = "Invalid URL."; return; }
  // Non-localhost https apps need host permission so the background fetch works (needs this click).
  if (origin.startsWith("https://")) {
    const ok = await chrome.permissions.request({ origins: [origin + "/*"] });
    if (!ok) { $("msg").textContent = "Host permission denied; saves to this app will fail."; }
  }
  await chrome.storage.sync.set({ dfAppUrl: origin, dfToken: $("tok").value.trim() });
  $("url").value = origin;
  if (!$("msg").textContent.startsWith("Host")) $("msg").textContent = "Saved.";
});
