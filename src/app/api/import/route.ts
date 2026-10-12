import { NextResponse } from "next/server";
import Papa from "papaparse";
import { getRepo } from "@/lib/db";
import { headerSignature, mapHeaders, MAPPABLE_FIELDS, mergeProperty, normalizeRow } from "@/lib/normalize";
import type { ColumnMapping, ImportLog } from "@/lib/types";

/**
 * Two-step import so any file layout works:
 *   POST multipart { file, mode: "preview" }
 *     → headers, proposed mapping (auto or remembered), sample rows, signature
 *   POST multipart { file, mode: "commit", mapping: <json>, remember: "1"|"0" }
 *     → imports with that mapping, remembers it for this header layout
 * A plain POST with just { file } behaves like commit with the auto mapping.
 */

function parseCsv(text: string) {
  return Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Attach a CSV as `file`." }, { status: 400 });
  const mode = String(form.get("mode") ?? "commit");
  const text = await file.text();
  const parsed = parseCsv(text);
  const headers = (parsed.meta.fields ?? []).filter(Boolean);
  if (!headers.length) return NextResponse.json({ ok: false, error: "Couldn't read a header row from this file." }, { status: 400 });

  const repo = getRepo();
  const signature = headerSignature(headers);
  const remembered = await repo.getColumnMap(signature);
  const auto = mapHeaders(headers);

  if (mode === "preview") {
    const mapping = remembered?.mapping ?? auto.mapping;
    const mapped = new Set(Object.values(mapping).flat());
    return NextResponse.json({
      ok: true,
      signature,
      fileName: file.name,
      rowCount: parsed.data.length,
      headers,
      mapping,
      remembered: Boolean(remembered),
      unmapped: headers.filter((h) => !mapped.has(h)),
      samples: parsed.data.slice(0, 3),
      fields: MAPPABLE_FIELDS,
    });
  }

  // commit
  let mapping: ColumnMapping = remembered?.mapping ?? auto.mapping;
  const mappingJson = form.get("mapping");
  if (typeof mappingJson === "string" && mappingJson.trim()) {
    try {
      mapping = JSON.parse(mappingJson) as ColumnMapping;
    } catch {
      return NextResponse.json({ ok: false, error: "Bad mapping JSON" }, { status: 400 });
    }
  }
  if (!mapping.address) {
    return NextResponse.json({ ok: false, error: "No column is mapped to Property address.", headers }, { status: 400 });
  }
  if (String(form.get("remember") ?? "1") !== "0") await repo.putColumnMap(signature, headers, mapping);

  const importBatchId = crypto.randomUUID();
  const sourceDate = new Date().toISOString().slice(0, 10);
  const seen = new Set<string>();
  let rowsNew = 0, rowsUpdated = 0, rowsDeduped = 0, rowsSkipped = 0;

  for (const row of parsed.data) {
    const p = normalizeRow(row, mapping, { source: "csv_import", sourceDate, importBatchId });
    if (!p) { rowsSkipped++; continue; }
    if (seen.has(p.dedupeKey)) { rowsDeduped++; continue; }
    seen.add(p.dedupeKey);
    const existing = await repo.findByDedupeKey(p.dedupeKey);
    if (existing) {
      await repo.upsertProperty(mergeProperty(existing, p));
      rowsUpdated++;
    } else {
      await repo.upsertProperty(p);
      rowsNew++;
    }
  }

  const mappedHeaders = new Set(Object.values(mapping).flat());
  const log: ImportLog = {
    id: importBatchId,
    fileName: file.name,
    importedAt: new Date().toISOString(),
    rowsIn: parsed.data.length,
    rowsNew, rowsUpdated, rowsDeduped, rowsSkipped,
    unmappedColumns: headers.filter((h) => !mappedHeaders.has(h)),
  };
  await repo.addImportLog(log);
  const needGeocode = await repo.countUngeocoded();
  return NextResponse.json({ ok: true, log, mapping, needGeocode });
}

export async function GET() {
  return NextResponse.json({ ok: true, logs: await getRepo().listImportLogs() });
}
