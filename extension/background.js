// TJ Record Reader - service worker.
// 1) Receives "df:start-lookup" from the app and opens the court search in a new tab.
// 2) Performs the "save" POST on behalf of the content script (avoids page CORS).
// Nothing here runs on a timer or submits any court form.

// Let content scripts read chrome.storage.session (off by default).
chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" });

// Hosts we allow the app to open = the content_scripts matches in the manifest.
function allowedSearchHost(url) {
  const patterns = chrome.runtime.getManifest().content_scripts.flatMap((c) => c.matches);
  return patterns.some((p) => {
    const m = p.match(/^https:\/\/([^/]+)\//);
    return m && m[1] === url.hostname;
  });
}

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (!msg || msg.type !== "df:start-lookup") return sendResponse({ ok: false, error: "unknown message" });
    let target;
    try { target = new URL(msg.searchUrl); } catch { return sendResponse({ ok: false, error: "bad searchUrl" }); }
    if (target.protocol !== "https:" || !allowedSearchHost(target)) {
      return sendResponse({ ok: false, error: "searchUrl host not allowed (add it to content_scripts.matches)" });
    }
    // Trust the sender's origin, not an appUrl supplied in the message body.
    const appUrl = sender.origin || new URL(sender.url).origin;
    const pendingLookup = {
      propertyId: String(msg.propertyId || ""),
      last: String(msg.last || ""),
      first: String(msg.first || ""),
      appUrl,
      state: String(msg.state || "WI"),
      createdAt: Date.now(),
    };
    await chrome.storage.session.set({ pendingLookup });
    await chrome.tabs.create({ url: target.href });
    sendResponse({ ok: true });
  })().catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true; // async response
});

// Save request from our own content script: POST page text to the app.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || msg.type !== "df:save") return;
  (async () => {
    const { dfToken = "" } = await chrome.storage.sync.get("dfToken");
    const res = await fetch(`${msg.appUrl.replace(/\/+$/, "")}/api/court/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-DF-Token": dfToken },
      body: JSON.stringify(msg.body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON response */ }
    sendResponse({ status: res.status, data });
  })().catch((e) => sendResponse({ status: 0, data: { ok: false, error: String(e.message || e) } }));
  return true; // async response
});
