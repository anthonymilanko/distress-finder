"use client";
import { useEffect, useState } from "react";
import type { ImportLog } from "@/lib/types";

export default function ImportPage() {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = () => fetch("/api/import").then((r) => r.json()).then((d) => setLogs(d.logs ?? []));
  useEffect(() => { load(); }, []);

  async function upload(file: File) {
    setBusy(true); setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/import", { method: "POST", body: fd });
    const d = await r.json();
    setBusy(false);
    if (d.ok) {
      const l: ImportLog = d.log;
      setResult(`${l.rowsIn} rows in → ${l.rowsNew} new, ${l.rowsUpdated} updated, ${l.rowsDeduped} duplicates, ${l.rowsSkipped} skipped (no address).${l.unmappedColumns.length ? ` Unmapped columns: ${l.unmappedColumns.join(", ")}` : ""}`);
      load();
    } else setResult(`Import failed: ${d.error}${d.headers ? ` — headers seen: ${d.headers.join(", ")}` : ""}`);
  }

  return (
    <div className="px-4 py-4 md:px-8 md:py-6 max-w-2xl md:mx-0 flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Import a list</h1>
      <p className="text-sm text-muted">Upload a BatchLeads CSV export (or any lead list with an address column). Rows are normalized and deduped on parcel + address; existing properties are updated, not duplicated. Desktop recommended.</p>
      <label className={`card border-dashed text-center cursor-pointer ${busy ? "opacity-50" : ""}`}>
        <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <div className="text-2xl">📥</div>
        <div className="font-medium">{busy ? "Importing…" : "Tap to choose a CSV"}</div>
      </label>
      {result && <div className="text-sm card">{result}</div>}
      <section>
        <div className="label mb-2">Import history</div>
        {logs.length === 0 ? <div className="text-sm text-muted">No imports yet.</div> : (
          <ul className="flex flex-col gap-2">
            {logs.map((l) => (
              <li key={l.id} className="card text-sm">
                <div className="font-medium">{l.fileName}</div>
                <div className="text-muted text-xs">{new Date(l.importedAt).toLocaleString()}</div>
                <div className="mt-1">{l.rowsIn} in · {l.rowsNew} new · {l.rowsUpdated} updated · {l.rowsDeduped} dupes · {l.rowsSkipped} skipped</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
