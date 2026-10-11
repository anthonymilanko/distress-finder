import type {
  ImportLog,
  Lien,
  Note,
  Property,
  PropertyFilters,
  ScoreResult,
} from "@/lib/types";

export interface SpendDay {
  day: string; // YYYY-MM-DD
  scans: number;
  costUsd: number;
}

/**
 * Storage contract. Two implementations:
 *  - LocalRepo: JSON file on disk (zero setup, dev / single machine)
 *  - SupabaseRepo: Postgres + PostGIS (deployed)
 * Pick with env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY present → Supabase.
 */
export interface Repo {
  // properties
  listProperties(filters: PropertyFilters): Promise<Property[]>;
  getProperty(id: string): Promise<Property | null>;
  findByDedupeKey(key: string): Promise<Property | null>;
  upsertProperty(p: Property): Promise<Property>;
  updateProperty(id: string, patch: Partial<Property>): Promise<Property | null>;
  // liens
  listLiens(propertyId: string): Promise<Lien[]>;
  addLiens(liens: Lien[]): Promise<Lien[]>;
  // notes
  listNotes(propertyId: string): Promise<Note[]>;
  addNote(note: Note): Promise<Note>;
  // imports
  addImportLog(log: ImportLog): Promise<ImportLog>;
  listImportLogs(): Promise<ImportLog[]>;
  // scoring
  getScore(cacheKey: string): Promise<ScoreResult | null>;
  putScore(cacheKey: string, result: ScoreResult): Promise<void>;
  getSpend(day: string): Promise<SpendDay>;
  addSpend(day: string, scans: number, costUsd: number): Promise<SpendDay>;
  // lookup cache (BatchData)
  getLookup<T>(cacheKey: string): Promise<T | null>;
  putLookup<T>(cacheKey: string, payload: T): Promise<void>;
}

export function applyFilters(all: Property[], f: PropertyFilters): Property[] {
  const q = f.q?.trim().toLowerCase();
  let rows = all.filter((p) => {
    if (f.state && p.state !== f.state.toUpperCase()) return false;
    if (f.county && (p.county ?? "").toLowerCase() !== f.county.toLowerCase()) return false;
    if (f.minEquityPct != null && (p.estEquityPct ?? -1) < f.minEquityPct) return false;
    if (f.minYearsOwned != null && (p.yearsOwned ?? -1) < f.minYearsOwned) return false;
    if (f.absentee && !p.absentee) return false;
    if (f.distressType && !p.distressTypes.includes(f.distressType)) return false;
    if (f.leadStatus && p.leadStatus !== f.leadStatus) return false;
    if (f.minScore != null && (p.distressScore ?? -1) < f.minScore) return false;
    if (q) {
      const hay = `${p.address} ${p.city} ${p.zip} ${p.ownerName ?? ""} ${p.parcel ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  rows = rows.sort((a, b) => (b.distressScore ?? 0) - (a.distressScore ?? 0) || (b.estEquityPct ?? 0) - (a.estEquityPct ?? 0));
  return rows.slice(0, f.limit ?? 500);
}
