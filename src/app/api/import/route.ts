import { NextResponse } from "next/server";
import Papa from "papaparse";
import { getRepo } from "@/lib/db";
import { mapHeaders, mergeProperty, normalizeRow } from "@/lib/normalize";
import type { ImportLog } from "@/lib/types";

/**
 * POST multipart/form-data with `file` (BatchLeads CSV export).
 * Normalizes, dedupes on parcel + address, merges into existing rows,
 * and returns a change log.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Attach a CSV as `file`." }, { status: 400 });
  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const headers = parsed.meta.fields ?? [];
  const { mapping, unmapped } = mapHeaders(headers);
  if (!mapping.address) {
    return NextResponse.json({ ok: false, error: "No address column found.", headers, unmapped }, { status: 400 });
  }

  const repo = getRepo();
  const importBatchId = crypto.randomUUID();
  const sourceDate = new Date().toISOString().slice(0, 10);
  const seen = new Map<string, true>();
  let rowsNew = 0, rowsUpdated = 0, rowsDeduped = 0, rowsSkipped = 0;

  for (const row of parsed.data) {
    const p = normalizeRow(row, mapping, { source: "batchleads_csv", sourceDate, importBatchId });
    if (!p) { rowsSkipped++; continue; }
    if (seen.has(p.dedupeKey)) { rowsDeduped++; continue; }
    seen.set(p.dedupeKey, true);
    const existing = await repo.findByDedupeKey(p.dedupeKey);
    if (existing) {
      await repo.upsertProperty(mergeProperty(existing, p));
      rowsUpdated++;
    } else {
      await repo.upsertProperty(p);
      rowsNew++;
    }
  }

  const log: ImportLog = {
    id: importBatchId,
    fileName: file.name,
    importedAt: new Date().toISOString(),
    rowsIn: parsed.data.length,
    rowsNew, rowsUpdated, rowsDeduped, rowsSkipped,
    unmappedColumns: unmapped,
  };
  await repo.addImportLog(log);
  return NextResponse.json({ ok: true, log, mapping });
}

export async function GET() {
  return NextResponse.json({ ok: true, logs: await getRepo().listImportLogs() });
}
