"use client";
import { useEffect, useState } from "react";

interface Status {
  storage: "local" | "supabase"; batchData: boolean; ghl: boolean; claude: boolean; streetView: boolean; extensionToken: boolean;
  spend: { day: string; scans: number; costUsd: number; capUsd: number };
}

function Row({ label, on, hint }: { label: string; on: boolean; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-t border-line first:border-t-0">
      <div><div className="font-medium text-sm">{label}</div><div className="text-xs text-muted">{hint}</div></div>
      <span className={`chip ${on ? "bg-cool text-white" : "bg-line text-muted"}`}>{on ? "Live" : "Not set"}</span>
    </div>
  );
}

export default function SettingsPage() {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => { fetch("/api/status").then((r) => r.json()).then(setS); }, []);
  if (!s) return <div className="p-4 text-muted">Loading…</div>;
  const capPct = Math.min(100, Math.round((s.spend.costUsd / s.spend.capUsd) * 100));
  return (
    <div className="px-4 py-4 max-w-2xl mx-auto flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Settings & status</h1>

      <section className="card">
        <div className="label mb-1">AI spend today ({s.spend.day})</div>
        <div className="text-2xl font-semibold">${s.spend.costUsd.toFixed(2)} <span className="text-sm text-muted font-normal">of ${s.spend.capUsd.toFixed(2)} cap · {s.spend.scans} scanned today</span></div>
        <div className="h-2 rounded-full bg-line mt-2 overflow-hidden"><div className={`h-full ${capPct >= 90 ? "bg-hot" : "bg-cool"}`} style={{ width: `${capPct}%` }} /></div>
        <div className="text-xs text-muted mt-2">Scoring stops at the cap and never retries on its own. Change it with DF_DAILY_AI_CAP_USD.</div>
      </section>

      <section className="card">
        <div className="label mb-1">Integrations (set in .env.local, then restart)</div>
        <Row label={`Storage: ${s.storage}`} on={s.storage === "supabase"} hint="Local JSON file until SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set." />
        <Row label="BatchData property lookup" on={s.batchData} hint="BATCHDATA_API_KEY — address search uses mock data without it." />
        <Row label="GoHighLevel" on={s.ghl} hint="GHL_API_KEY + GHL_LOCATION_ID — Send to GHL is stubbed without them." />
        <Row label="Claude (court-page parsing)" on={s.claude} hint="ANTHROPIC_API_KEY — falls back to a regex case-number reader." />
        <Row label="Google Street View embed" on={s.streetView} hint="NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY — display only; never sent to AI." />
        <Row label="Extension token" on={s.extensionToken} hint="DF_EXTENSION_TOKEN — must match the TJ Record Reader options." />
      </section>

      <section className="card text-sm">
        <div className="label mb-1">Add to iPhone home screen</div>
        Open this site in Safari → Share → “Add to Home Screen”. It launches full-screen like an app.
      </section>

      <section className="card text-sm">
        <div className="label mb-1">TJ Record Reader (Chrome, desktop)</div>
        Load <code>extension/</code> in chrome://extensions (Developer mode → Load unpacked), then set the App URL and token in its options. Court-check buttons on a property card open the search; the extension prefills the name and adds “Save to property”. One human-run search at a time — no automation.
      </section>

      <section className="card text-xs text-muted">
        Compliance reminders: scrub contacts against DNC/TCPA before calling or texting; foreclosure-consultant / equity-purchaser rules apply to owners in foreclosure; never use demographics in scoring; every lien/foreclosure line shows its source and date.
      </section>
    </div>
  );
}
