import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ImportLog, Lien, Note, Property, PropertyFilters, ScoreResult } from "@/lib/types";
import { applyFilters, type Repo, type SpendDay } from "./repo";

// ---- row <-> domain mapping (snake_case in Postgres, camelCase in app) ----
type Row = Record<string, unknown>;

const PROP_COLS: Array<[keyof Property, string]> = [
  ["id", "id"], ["parcel", "parcel"], ["dedupeKey", "dedupe_key"], ["address", "address"],
  ["city", "city"], ["state", "state"], ["zip", "zip"], ["county", "county"], ["lat", "lat"], ["lng", "lng"],
  ["ownerName", "owner_name"], ["ownerFirst", "owner_first"], ["ownerLast", "owner_last"],
  ["ownerIsBusiness", "owner_is_business"], ["mailingAddress", "mailing_address"], ["mailingCity", "mailing_city"],
  ["mailingState", "mailing_state"], ["mailingZip", "mailing_zip"], ["absentee", "absentee"], ["beds", "beds"],
  ["baths", "baths"], ["sqft", "sqft"], ["lotSqft", "lot_sqft"], ["yearBuilt", "year_built"],
  ["propertyType", "property_type"], ["lastSaleDate", "last_sale_date"], ["lastSalePrice", "last_sale_price"],
  ["estValue", "est_value"], ["mortgageBalance", "mortgage_balance"], ["estEquity", "est_equity"],
  ["estEquityPct", "est_equity_pct"], ["yearsOwned", "years_owned"], ["distressTypes", "distress_types"],
  ["leadStatus", "lead_status"], ["distressScore", "distress_score"], ["imageFlags", "image_flags"],
  ["needsReview", "needs_review"], ["photos", "photos"], ["source", "source"], ["sourceDate", "source_date"],
  ["importBatchId", "import_batch_id"], ["isSample", "is_sample"], ["createdAt", "created_at"], ["updatedAt", "updated_at"],
];

function toRow(p: Partial<Property>): Row {
  const r: Row = {};
  for (const [k, col] of PROP_COLS) if (p[k] !== undefined) r[col] = p[k];
  if (p.lat != null && p.lng != null) r.geom = `SRID=4326;POINT(${p.lng} ${p.lat})`;
  return r;
}
function fromRow(r: Row): Property {
  const p: Record<string, unknown> = {};
  for (const [k, col] of PROP_COLS) if (r[col] !== null && r[col] !== undefined) p[k] = r[col];
  p.distressTypes ??= [];
  p.photos ??= [];
  return p as unknown as Property;
}
const LIEN_COLS: Array<[keyof Lien, string]> = [
  ["id", "id"], ["propertyId", "property_id"], ["kind", "kind"], ["caseNumber", "case_number"], ["caseType", "case_type"],
  ["status", "status"], ["filedDate", "filed_date"], ["amount", "amount"], ["plaintiff", "plaintiff"], ["county", "county"],
  ["state", "state"], ["source", "source"], ["sourceDate", "source_date"], ["confidence", "confidence"], ["rawText", "raw_text"],
];
function lienToRow(l: Lien): Row {
  const r: Row = {};
  for (const [k, col] of LIEN_COLS) if (l[k] !== undefined) r[col] = l[k];
  return r;
}
function lienFromRow(r: Row): Lien {
  const l: Record<string, unknown> = {};
  for (const [k, col] of LIEN_COLS) if (r[col] !== null && r[col] !== undefined) l[k] = r[col];
  return l as unknown as Lien;
}

export class SupabaseRepo implements Repo {
  private sb: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.sb = createClient(url, serviceKey, { auth: { persistSession: false } });
  }
  private throwIf(error: { message: string } | null) {
    if (error) throw new Error(error.message);
  }

  async listProperties(filters: PropertyFilters) {
    // Push the cheap filters to SQL, finish with the shared in-memory filter.
    let q = this.sb.from("properties").select("*").limit(filters.limit ?? 500);
    if (filters.state) q = q.eq("state", filters.state.toUpperCase());
    if (filters.leadStatus) q = q.eq("lead_status", filters.leadStatus);
    if (filters.absentee) q = q.eq("absentee", true);
    if (filters.distressType) q = q.contains("distress_types", [filters.distressType]);
    const { data, error } = await q;
    this.throwIf(error);
    return applyFilters((data ?? []).map(fromRow), filters);
  }
  async getProperty(id: string) {
    const { data, error } = await this.sb.from("properties").select("*").eq("id", id).maybeSingle();
    this.throwIf(error);
    return data ? fromRow(data) : null;
  }
  async findByDedupeKey(key: string) {
    const { data, error } = await this.sb.from("properties").select("*").eq("dedupe_key", key).maybeSingle();
    this.throwIf(error);
    return data ? fromRow(data) : null;
  }
  async upsertProperty(p: Property) {
    const { data, error } = await this.sb.from("properties").upsert(toRow(p), { onConflict: "dedupe_key" }).select().single();
    this.throwIf(error);
    return fromRow(data);
  }
  async updateProperty(id: string, patch: Partial<Property>) {
    const { data, error } = await this.sb.from("properties").update({ ...toRow(patch), updated_at: new Date().toISOString() }).eq("id", id).select().maybeSingle();
    this.throwIf(error);
    return data ? fromRow(data) : null;
  }
  async listLiens(propertyId: string) {
    const { data, error } = await this.sb.from("liens").select("*").eq("property_id", propertyId).order("filed_date", { ascending: false });
    this.throwIf(error);
    return (data ?? []).map(lienFromRow);
  }
  async addLiens(liens: Lien[]) {
    if (!liens.length) return [];
    const { data, error } = await this.sb.from("liens").insert(liens.map(lienToRow)).select();
    this.throwIf(error);
    return (data ?? []).map(lienFromRow);
  }
  async listNotes(propertyId: string) {
    const { data, error } = await this.sb.from("notes").select("*").eq("property_id", propertyId).order("created_at", { ascending: false });
    this.throwIf(error);
    return (data ?? []).map((r) => ({ id: r.id, propertyId: r.property_id, body: r.body, createdAt: r.created_at }));
  }
  async addNote(note: Note) {
    const { error } = await this.sb.from("notes").insert({ id: note.id, property_id: note.propertyId, body: note.body, created_at: note.createdAt });
    this.throwIf(error);
    return note;
  }
  async addImportLog(log: ImportLog) {
    const { error } = await this.sb.from("import_logs").insert({
      id: log.id, file_name: log.fileName, imported_at: log.importedAt, rows_in: log.rowsIn, rows_new: log.rowsNew,
      rows_updated: log.rowsUpdated, rows_deduped: log.rowsDeduped, rows_skipped: log.rowsSkipped, unmapped_columns: log.unmappedColumns,
    });
    this.throwIf(error);
    return log;
  }
  async listImportLogs() {
    const { data, error } = await this.sb.from("import_logs").select("*").order("imported_at", { ascending: false }).limit(50);
    this.throwIf(error);
    return (data ?? []).map((r) => ({
      id: r.id, fileName: r.file_name, importedAt: r.imported_at, rowsIn: r.rows_in, rowsNew: r.rows_new,
      rowsUpdated: r.rows_updated, rowsDeduped: r.rows_deduped, rowsSkipped: r.rows_skipped, unmappedColumns: r.unmapped_columns ?? [],
    }));
  }
  async getScore(cacheKey: string) {
    const { data, error } = await this.sb.from("score_cache").select("result").eq("cache_key", cacheKey).maybeSingle();
    this.throwIf(error);
    return (data?.result as ScoreResult) ?? null;
  }
  async putScore(cacheKey: string, result: ScoreResult) {
    const { error } = await this.sb.from("score_cache").upsert({ cache_key: cacheKey, property_id: result.propertyId, result, model: result.model, cost_usd: result.costUsd, scored_at: result.scoredAt });
    this.throwIf(error);
  }
  async getSpend(day: string): Promise<SpendDay> {
    const { data, error } = await this.sb.from("ai_spend").select("*").eq("day", day).maybeSingle();
    this.throwIf(error);
    return data ? { day, scans: data.scans, costUsd: Number(data.cost_usd) } : { day, scans: 0, costUsd: 0 };
  }
  async addSpend(day: string, scans: number, costUsd: number) {
    const cur = await this.getSpend(day);
    const next = { day, scans: cur.scans + scans, costUsd: Math.round((cur.costUsd + costUsd) * 1e6) / 1e6 };
    const { error } = await this.sb.from("ai_spend").upsert({ day, scans: next.scans, cost_usd: next.costUsd });
    this.throwIf(error);
    return next;
  }
  async getLookup<T>(cacheKey: string) {
    const { data, error } = await this.sb.from("lookup_cache").select("payload").eq("cache_key", cacheKey).maybeSingle();
    this.throwIf(error);
    return (data?.payload as T) ?? null;
  }
  async putLookup<T>(cacheKey: string, payload: T) {
    const { error } = await this.sb.from("lookup_cache").upsert({ cache_key: cacheKey, payload, fetched_at: new Date().toISOString() });
    this.throwIf(error);
  }
}
