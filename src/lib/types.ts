// Core domain types for OverlookAI (Phase 1).
// Every lien / foreclosure / tax fact carries a source + date (see SourcedFact).

export type LeadStatus = "new" | "lead" | "skip" | "watch";

export type DistressType =
  | "pre_foreclosure"
  | "foreclosure"
  | "tax_delinquent"
  | "lien"
  | "judgment"
  | "probate"
  | "vacant"
  | "code_violation"
  | "tired_landlord"
  | "divorce"
  | "expired_listing"
  | "other";

export type MatchConfidence = "confirmed" | "possible_match" | "estimate";

export interface SourcedFact<T = string> {
  value: T;
  source: string; // where it came from (URL, "BatchLeads export", "WCCA", ...)
  sourceDate: string; // ISO date the source was read / exported
  confidence: MatchConfidence;
}

export interface Lien {
  id: string;
  propertyId: string;
  kind: DistressType;
  caseNumber?: string;
  caseType?: string; // e.g. CV 30404, TW, CL, ML, SC, TJ, FJ
  status?: string; // Open / Closed / unknown
  filedDate?: string;
  amount?: number;
  plaintiff?: string;
  county?: string;
  state?: string;
  source: string;
  sourceDate: string;
  confidence: MatchConfidence; // name-only matches are always "possible_match"
  rawText?: string;
}

export interface Note {
  id: string;
  propertyId: string;
  body: string;
  createdAt: string;
}

export interface Property {
  id: string; // internal uuid
  parcel?: string; // APN
  dedupeKey: string; // normalized parcel or address key
  // Situs
  address: string;
  city: string;
  state: string; // 2-letter
  zip: string;
  county?: string;
  lat?: number;
  lng?: number;
  // Owner
  ownerName?: string;
  ownerFirst?: string;
  ownerLast?: string;
  ownerIsBusiness?: boolean;
  mailingAddress?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  absentee?: boolean; // mailing != situs
  // Contact info from skip-traced exports (scrub against DNC/TCPA before use)
  phones?: string[];
  emails?: string[];
  // Free-form list tags from the source ("Tired Landlord, High Equity", ...)
  tags?: string[];
  // Characteristics
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSqft?: number;
  yearBuilt?: number;
  propertyType?: string;
  // Money
  lastSaleDate?: string;
  lastSalePrice?: number;
  estValue?: number;
  mortgageBalance?: number;
  estEquity?: number;
  estEquityPct?: number;
  ltvPct?: number; // loan-to-value; equity % = 100 - LTV when nothing better exists
  yearsOwned?: number;
  assessedValue?: number; // county assessor total
  taxAmount?: number; // annual property tax
  lenderName?: string; // first open mortgage lender
  geocodeStatus?: "pending" | "matched" | "no_match" | "has_coords";
  // Distress (from import or lookup; details live in liens[])
  distressTypes: DistressType[];
  // App state
  leadStatus: LeadStatus;
  distressScore?: number; // 0-100, from the scoring module (Phase 2+)
  imageFlags?: string[];
  needsReview?: boolean;
  // Photos (licensed sources only)
  photos: PropertyPhoto[];
  // Provenance
  source: string; // "batchleads_csv" | "batchdata_lookup" | "manual"
  sourceDate: string;
  importBatchId?: string;
  createdAt: string;
  updatedAt: string;
  // Sample-data marker so fake rows never get mistaken for leads
  isSample?: boolean;
}

export interface PropertyPhoto {
  url: string;
  source: "batchdata" | "own_photo" | "nearmap" | "mapillary";
  takenAt?: string;
  caption?: string;
}

export interface ImportLog {
  id: string;
  fileName: string;
  importedAt: string;
  rowsIn: number;
  rowsNew: number;
  rowsUpdated: number;
  rowsDeduped: number;
  rowsSkipped: number;
  unmappedColumns: string[];
}

/** A confirmed column mapping, remembered per header layout. */
export interface ColumnMap {
  signature: string; // hash of the normalized header list
  headers: string[];
  mapping: ColumnMapping;
  savedAt: string;
}

/** canonical field -> source header (string) or headers (string[] for phones/emails). */
export type ColumnMapping = Record<string, string | string[]>;

export interface PropertyFilters {
  q?: string;
  state?: string;
  county?: string;
  minEquityPct?: number;
  minYearsOwned?: number;
  absentee?: boolean;
  distressType?: DistressType;
  leadStatus?: LeadStatus;
  minScore?: number;
  limit?: number;
}

// ---- Scoring (Section 4 of the blueprint) ----

export type ImageFlag =
  | "tall_grass"
  | "overgrown_weeds"
  | "trash_debris"
  | "junk_piles"
  | "junk_vehicles"
  | "roof_damage"
  | "boarded_or_peeling"
  | "green_pool"
  | "worsened_vs_prior"
  | "unclear_image";

export const IMAGE_FLAG_POINTS: Record<ImageFlag, number> = {
  tall_grass: 10,
  overgrown_weeds: 10,
  trash_debris: 12,
  junk_piles: 12,
  junk_vehicles: 6,
  roof_damage: 10,
  boarded_or_peeling: 10,
  green_pool: 5,
  worsened_vs_prior: 10,
  unclear_image: 0,
};

export interface ScoreInput {
  propertyId: string;
  parcel?: string;
  imageUrl?: string; // licensed imagery only — never Google
  imageDate?: string;
  priorImageUrl?: string;
}

export interface ScoreResult {
  propertyId: string;
  imageFlags: ImageFlag[];
  imagePoints: number; // 0-85 raw
  recordsPoints: number; // 0-50
  distressScore: number; // 0-100
  needsReview: boolean;
  model: string;
  costUsd: number;
  cached: boolean;
  scoredAt: string;
}
