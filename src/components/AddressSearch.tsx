"use client";
import { useEffect, useRef, useState } from "react";
import type { Property } from "@/lib/types";

interface Suggestion { label: string; street: string; city: string; state: string; zip: string }

/**
 * Address search bar for the map page. Typing shows suggestions; picking one (or Enter)
 * looks the property up live (BatchData), saves it, and hands it back so the map can drop a pin.
 */
export default function AddressSearch({ onFound }: { onFound: (p: Property) => void }) {
  const [q, setQ] = useState("");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [live, setLive] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (q.trim().length < 3) { setSugs([]); return; }
      try {
        const d = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => r.json());
        if (d.ok) { setSugs(d.suggestions); setLive(d.live); setActive(-1); }
      } catch { /* suggestions are best-effort; Enter still does a full lookup */ }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  // Close the dropdown when clicking elsewhere.
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function lookup(body: Record<string, string>, label: string) {
    setBusy(true); setErr(null); setOpen(false); setQ(label);
    try {
      const d = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      if (d.ok) { onFound(d.property); setQ(""); setSugs([]); }
      else setErr(d.error ?? "Lookup failed");
    } catch (e) { setErr(String(e)); }
    setBusy(false);
  }
  const pick = (s: Suggestion) => lookup({ street: s.street, city: s.city, state: s.state, zip: s.zip }, s.label);

  return (
    <div ref={box} className="relative w-full md:w-[26rem]">
      <form
        onSubmit={(e) => { e.preventDefault(); if (active >= 0 && sugs[active]) pick(sugs[active]); else if (q.trim()) lookup({ address: q }, q); }}
        className="flex items-center gap-2 rounded-full border border-line bg-surface pl-3.5 pr-1 py-1 focus-within:border-ink/50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted shrink-0" aria-hidden="true"><path d="M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-3.5-3.5" /></svg>
        <input
          className="flex-1 min-w-0 bg-transparent py-1 text-[15px] placeholder:text-muted/70 focus:outline-none focus-visible:outline-none"
          placeholder="Search any address…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setErr(null); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(sugs.length - 1, a + 1)); setOpen(true); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
            else if (e.key === "Escape") setOpen(false);
          }}
          aria-label="Search an address"
          autoComplete="off"
        />
        <button type="submit" className="btn btn-brand rounded-full py-1.5" disabled={busy || !q.trim()}>{busy ? "Looking up…" : "Look up"}</button>
      </form>

      {open && (sugs.length > 0 || live === false || err) && (
        <div className="absolute z-30 left-0 right-0 mt-1.5 card p-1 shadow-[0_8px_30px_rgba(19,22,28,.14)]">
          {sugs.map((s, i) => (
            <button key={s.label} type="button" disabled={busy} onMouseEnter={() => setActive(i)} onClick={() => pick(s)}
              className={`block w-full text-left rounded-md px-3 py-2 text-sm ${i === active ? "bg-bg" : ""}`}>{s.label}</button>
          ))}
          {live === false && <div className="px-3 py-2 text-xs text-muted">BatchData key not set — results are mock data.</div>}
          {err && <div className="px-3 py-2 text-sm text-brand">{err}</div>}
        </div>
      )}
    </div>
  );
}
