"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ColumnMapping, ImportLog } from "@/lib/types";

interface Preview {
  signature: string;
  fileName: string;
  rowCount: number;
  headers: string[];
  mapping: ColumnMapping;
  remembered: boolean;
  unmapped: string[];
  samples: Record<string, string>[];
  fields: Array<{ field: string; label: string }>;
}

const MULTI = new Set(["phones", "emails"]);

/** header -> field (inverse of the mapping) for the review table */
function invert(m: ColumnMapping): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, h] of Object.entries(m)) for (const x of Array.isArray(h) ? h : [h]) out[x] = field;
  return out;
}
function rebuild(headers: string[], byHeader: Record<string, string>): ColumnMapping {
  const m: ColumnMapping = {};
  for (const h of headers) {
    const f = byHeader[h];
    if (!f || f === "ignore") continue;
    if (MULTI.has(f)) (m[f] = (m[f] as string[] | undefined) ?? []).push(h);
    else if (!m[f]) m[f] = h; // first header wins for single fields
  }
  return m;
}

export default function ImportPage() {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [byHeader, setByHeader] = useState<Record<string, string>>({});
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [geo, setGeo] = useState<{ remaining: number; matched: number; noMatch: number; running: boolean; error?: string } | null>(null);

  const load = () => fetch("/api/import").then((r) => r.json()).then((d) => setLogs(d.logs ?? []));
  useEffect(() => {
    load();
    fetch("/api/geocode").then((r) => r.json()).then((d) => setGeo({ remaining: d.remaining ?? 0, matched: 0, noMatch: 0, running: false }));
  }, []);

  async function choose(f: File) {
    setFile(f); setResult(null); setPreview(null);
    setBusy("Reading file…");
    const fd = new FormData(); fd.append("file", f); fd.append("mode", "preview");
    const d = await fetch("/api/import", { method: "POST", body: fd }).then((r) => r.json());
    setBusy(null);
    if (!d.ok) { setResult({ ok: false, text: d.error }); return; }
    setPreview(d); setByHeader(invert(d.mapping));
  }

  async function commit() {
    if (!file || !preview) return;
    const mapping = rebuild(preview.headers, byHeader);
    if (!mapping.address) { setResult({ ok: false, text: "Pick which column is the property address first." }); return; }
    setBusy("Importing…");
    const fd = new FormData(); fd.append("file", file); fd.append("mode", "commit"); fd.append("mapping", JSON.stringify(mapping)); fd.append("remember", remember ? "1" : "0");
    const d = await fetch("/api/import", { method: "POST", body: fd }).then((r) => r.json());
    setBusy(null);
    if (!d.ok) { setResult({ ok: false, text: `Import failed: ${d.error}` }); return; }
    const l: ImportLog = d.log;
    setResult({ ok: true, text: `${l.rowsIn} rows in → ${l.rowsNew} new, ${l.rowsUpdated} updated, ${l.rowsDeduped} duplicates, ${l.rowsSkipped} skipped (no address).` });
    setPreview(null); setFile(null); load();
    if (d.needGeocode > 0) runGeocode(d.needGeocode);
  }

  async function runGeocode(initial?: number) {
    const start = initial ?? geo?.remaining ?? 0;
    setGeo({ remaining: start, matched: 0, noMatch: 0, running: true });
    let matched = 0, noMatch = 0;
    for (let i = 0; i < 50; i++) {
      const d = await fetch("/api/geocode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 2000 }) }).then((r) => r.json());
      if (!d.ok) { setGeo({ remaining: start, matched, noMatch, running: false, error: d.error }); return; }
      matched += d.matched; noMatch += d.noMatch;
      setGeo({ remaining: d.remaining, matched, noMatch, running: d.remaining > 0 });
      if (d.remaining === 0 || d.processed === 0) break;
    }
  }

  const fieldLabel = (f: string) => preview?.fields.find((x) => x.field === f)?.label ?? f;

  return (
    <div className="px-4 py-4 md:px-8 md:py-6 max-w-4xl md:mx-0 flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Import a list</h1>
      <p className="text-sm text-muted">Any CSV with an address column: BatchLeads, skip-trace results, county exports. The app guesses what each column is, you confirm once, and it remembers that layout next time. Rows are deduped on parcel + address and merged into existing properties.</p>

      {!preview && (
        <label className={`card border-dashed text-center cursor-pointer ${busy ? "opacity-50" : ""}`}>
          <input type="file" accept=".csv,text/csv" className="hidden" disabled={Boolean(busy)} onChange={(e) => e.target.files?.[0] && choose(e.target.files[0])} />
          <div className="text-2xl">📥</div>
          <div className="font-medium">{busy ?? "Choose a CSV"}</div>
        </label>
      )}

      {preview && (
        <section className="card">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold">{preview.fileName}</div>
              <div className="text-sm text-muted">{preview.rowCount.toLocaleString()} rows · {preview.headers.length} columns{preview.remembered ? " · layout remembered from a previous import" : ""}</div>
            </div>
            <button type="button" className="btn" onClick={() => { setPreview(null); setFile(null); }}>Cancel</button>
          </div>
          <p className="text-sm mt-2">Check the column mapping. Anything marked <em>Ignore</em> is skipped.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm [&_td]:py-1.5 [&_td]:pr-3 [&_th]:pr-3 [&_th]:text-left [&_th]:text-muted [&_th]:font-medium">
              <thead><tr><th>Column in file</th><th>Example values</th><th>Maps to</th></tr></thead>
              <tbody>
                {preview.headers.map((h) => {
                  const v = byHeader[h] ?? "ignore";
                  return (
                    <tr key={h} className="border-t border-line">
                      <td className="font-medium whitespace-nowrap">{h}</td>
                      <td className="text-muted max-w-[22rem] truncate">{preview.samples.map((r) => r[h]).filter(Boolean).slice(0, 2).join(" · ") || "—"}</td>
                      <td>
                        <select className={`input !py-1 text-sm ${v === "ignore" ? "text-muted" : ""}`} value={v} onChange={(e) => setByHeader({ ...byHeader, [h]: e.target.value })}>
                          <option value="ignore">Ignore</option>
                          {preview.fields.map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
            <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember this layout</label>
            <button type="button" className="btn btn-brand" disabled={Boolean(busy)} onClick={commit}>{busy ?? `Import ${preview.rowCount.toLocaleString()} rows`}</button>
          </div>
          {!rebuild(preview.headers, byHeader).address && <div className="text-sm text-brand mt-2">No column is set to “{fieldLabel("address")}” yet.</div>}
        </section>
      )}

      {result && (
        <div className={`card text-sm border-2 ${result.ok ? "border-cool bg-cool/5" : "border-brand bg-brand/5"}`}>
          <div className={`font-semibold ${result.ok ? "text-cool" : "text-brand"}`}>{result.ok ? "✓ Import complete" : "✗ Import failed"}</div>
          <div className="mt-1">{result.text}</div>
          {result.ok && <Link href="/" className="btn btn-brand mt-3">View on map</Link>}
        </div>
      )}

      {geo && (geo.running || geo.remaining > 0 || geo.matched > 0 || geo.error) && (
        <section className="card text-sm">
          <div className="label mb-1">Map pins (geocoding)</div>
          {geo.running ? (
            <div>Finding coordinates… {geo.matched.toLocaleString()} placed so far, {geo.remaining.toLocaleString()} to go. Free US Census geocoder; a few thousand rows takes a couple of minutes.</div>
          ) : geo.error ? (
            <div className="text-brand">{geo.error} <button type="button" className="btn ml-2" onClick={() => runGeocode()}>Retry</button></div>
          ) : geo.remaining > 0 ? (
            <div className="flex items-center gap-3 flex-wrap">{geo.remaining.toLocaleString()} properties have no map pin yet. <button type="button" className="btn btn-dark" onClick={() => runGeocode()}>Find coordinates</button></div>
          ) : (
            <div>Done: {geo.matched.toLocaleString()} placed on the map{geo.noMatch ? `, ${geo.noMatch.toLocaleString()} couldn't be matched (they're still in the list)` : ""}.</div>
          )}
        </section>
      )}

      <section>
        <div className="label mb-2">Import history</div>
        {logs.length === 0 ? <div className="text-sm text-muted">No imports yet.</div> : (
          <ul className="flex flex-col gap-2">
            {logs.map((l) => (
              <li key={l.id} className="card text-sm">
                <div className="font-medium">{l.fileName}</div>
                <div className="text-muted text-xs">{new Date(l.importedAt).toLocaleString()}</div>
                <div className="mt-1">{l.rowsIn} in · {l.rowsNew} new · {l.rowsUpdated} updated · {l.rowsDeduped} dupes · {l.rowsSkipped} skipped{l.unmappedColumns.length ? ` · ignored: ${l.unmappedColumns.join(", ")}` : ""}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
