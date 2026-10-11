"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Suggestion { label: string; street: string; city: string; state: string; zip: string }

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [live, setLive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (q.trim().length < 3) { setSugs([]); return; }
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      if (d.ok) { setSugs(d.suggestions); setLive(d.live); }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  async function lookup(body: Record<string, string>) {
    setBusy(true); setErr(null);
    const r = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    setBusy(false);
    if (d.ok) router.push(`/property/${d.property.id}`);
    else setErr(d.error ?? "Lookup failed");
  }

  return (
    <div className="px-4 py-4 md:px-8 md:py-6 max-w-2xl md:mx-0 flex flex-col gap-3">
      <h1 className="text-lg font-semibold">Search an address</h1>
      <p className="text-sm text-muted">Type any address. The app pulls the property live (beds, baths, sq ft, lot, year built, owner, equity, distress flags) and saves it — no list import needed.</p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) lookup({ address: q }); }}>
        <input className="input" placeholder="123 Main St, Milwaukee, WI 53202" value={q} onChange={(e) => setQ(e.target.value)} autoFocus inputMode="text" />
        <button type="submit" className="btn btn-brand" disabled={busy}>{busy ? "…" : "Look up"}</button>
      </form>
      {live === false && <div className="text-xs rounded-lg bg-warm/10 border border-warm px-3 py-2">BatchData key not set — results are mock data. Add BATCHDATA_API_KEY in .env.local to go live.</div>}
      {err && <div className="text-sm text-brand">{err}</div>}
      <ul className="flex flex-col gap-2">
        {sugs.map((s) => (
          <li key={s.label}>
            <button type="button" className="card w-full text-left hover:border-brand" disabled={busy} onClick={() => lookup({ street: s.street, city: s.city, state: s.state, zip: s.zip })}>
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
