// OverlookAI Record Reader - content script (runs on WCCA pages only).
// Prefills party-name fields and shows a "Save to property" panel.
// It NEVER clicks Search, submits forms, paginates, or runs on a timer.
(async () => {
  if (window.top !== window || document.getElementById("df-record-reader")) return;

  const b64urlDecode = (s) => {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0))));
  };
  const originOf = (u) => { try { return new URL(u).origin; } catch { return ""; } };

  // ---- 1. Work out the pending lookup -------------------------------------
  const { dfAppUrl = "http://localhost:3000" } = await chrome.storage.sync.get("dfAppUrl");
  const { pendingLookup: stored } = await chrome.storage.session.get("pendingLookup").catch(() => ({}));
  const fresh = stored && Date.now() - (stored.createdAt || 0) < 30 * 60 * 1000 ? stored : null;

  let lookup = null, warn = "";
  const param = new URL(location.href).searchParams.get("df");
  if (param) { try { lookup = b64urlDecode(param); } catch { warn = "Could not read df parameter."; } }
  if (!lookup && fresh) lookup = fresh;

  // SECURITY: a link could carry any appUrl. Only send data to the configured
  // app origin (or the origin that opened this lookup via the extension).
  let appUrl = dfAppUrl;
  if (lookup && lookup.appUrl) {
    const o = originOf(lookup.appUrl);
    if (o && (o === originOf(dfAppUrl) || (fresh && o === originOf(fresh.appUrl)))) appUrl = o;
    else warn = `Ignored appUrl ${o || "(invalid)"}; using ${dfAppUrl}.`;
  }
  const L = {
    propertyId: lookup?.propertyId || "",
    last: lookup?.last || "",
    first: lookup?.first || "",
    state: lookup?.state || "WI",
  };

  // ---- 2. Prefill (best-effort field finder - adjust here if WCCA changes) --
  const labelText = (el) => {
    const parts = [el.id, el.name, el.getAttribute("aria-label"), el.placeholder];
    (el.labels ? [...el.labels] : []).forEach((l) => parts.push(l.textContent));
    const by = el.getAttribute("aria-labelledby");
    if (by) by.split(/\s+/).forEach((id) => parts.push(document.getElementById(id)?.textContent));
    return parts.filter(Boolean).join(" ");
  };
  const textInputs = (root) =>
    [...root.querySelectorAll("input")].filter((i) => !i.type || ["text", "search"].includes(i.type));
  const setValue = (el, v) => { // React/Vue-compatible native setter
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  function findFields() {
    const all = textInputs(document);
    let last = all.find((i) => /last\s*name/i.test(labelText(i)));
    let first = all.find((i) => /first\s*name/i.test(labelText(i)));
    if (!last || !first) { // fallback: first two text inputs in a container mentioning "Party name"
      const box = [...document.querySelectorAll("form")].find((f) => /party name/i.test(f.textContent));
      const ins = box ? textInputs(box) : [];
      last = last || ins[0];
      first = first || ins.find((i) => i !== last);
    }
    return { last, first };
  }
  let filledLast = !L.last, filledFirst = !L.first; // nothing to fill => done
  function tryFill() {
    const f = findFields();
    if (!filledLast && f.last) { setValue(f.last, L.last); filledLast = true; }
    if (!filledFirst && f.first) { setValue(f.first, L.first); filledFirst = true; }
    return filledLast && filledFirst;
  }
  if (!tryFill()) {
    const mo = new MutationObserver(() => { if (tryFill()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 10000); // give up after 10s
  }

  // ---- 3. Panel (shadow DOM) ------------------------------------------------
  const host = document.createElement("div");
  host.id = "df-record-reader";
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      .p{background:#05150E;color:#fff;font:13px system-ui,sans-serif;padding:12px;width:260px;
         border-radius:8px;box-shadow:0 4px 18px rgba(0,0,0,.45)}
      .t{font-weight:600;margin-bottom:8px}
      label{display:block;font-size:11px;opacity:.75;margin:6px 0 2px}
      input{box-sizing:border-box;width:100%;padding:5px 6px;font:inherit;border-radius:4px;
            border:1px solid #3a4a42;background:#0d2419;color:#fff}
      button{margin-top:10px;width:100%;padding:7px;font:inherit;font-weight:600;color:#fff;
             background:#9E0000;border:0;border-radius:4px;cursor:pointer}
      button:disabled{opacity:.5;cursor:default}
      .s{margin-top:8px;min-height:16px;font-size:12px;word-break:break-word}
    </style>
    <div class="p">
      <div class="t">OverlookAI Record Reader</div>
      <label>Property ID</label><input id="pid" placeholder="Paste property ID">
      <label>Searching name</label><div id="nm"></div>
      <button id="go">Save to property</button>
      <div class="s" id="st"></div>
    </div>`;
  document.documentElement.appendChild(host);
  const $ = (id) => root.getElementById(id);
  $("pid").value = L.propertyId;
  $("nm").textContent = L.last || L.first ? `${L.last}, ${L.first}` : "(manual search)";
  const status = (t) => { $("st").textContent = t; };
  status(warn || (L.propertyId ? "Run the search yourself, then click Save." : "Paste the property ID, run your search, then click Save."));

  // ---- 4. Save (user click only; no retries) -----------------------------------
  $("go").addEventListener("click", async () => {
    const propertyId = $("pid").value.trim();
    if (!propertyId) return status("Enter a property ID first.");
    $("go").disabled = true;
    status("Saving...");
    const body = {
      propertyId,
      sourceUrl: location.href,
      pageTitle: document.title,
      pageText: document.body.innerText.slice(0, 200000),
      state: L.state,
      county: null,
      capturedAt: new Date().toISOString(),
      searchedName: { last: L.last, first: L.first },
    };
    try {
      const r = await chrome.runtime.sendMessage({ type: "df:save", appUrl, body });
      const d = r && r.data;
      if (d && d.ok) status(`Saved ${d.liensSaved} record(s) as possible match`);
      else status(`Error: ${(d && (d.error || d.message)) || "HTTP " + (r && r.status)}`);
    } catch (e) {
      status(`Error: ${e.message || e}`);
    }
    $("go").disabled = false; // user may click again deliberately
  });
})();
