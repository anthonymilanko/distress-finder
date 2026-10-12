import type { Property } from "@/lib/types";

/**
 * Free geocoding via the US Census Bureau batch geocoder (no key, no cost,
 * up to 10,000 addresses per request). Used after import for rows that
 * arrive without coordinates.
 *
 * Docs: https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html
 * Response is CSV: id, input address, match ("Match"/"No_Match"/"Tie"),
 * match type ("Exact"/"Non_Exact"), matched address, "lon,lat", tigerline id, side.
 */

const CENSUS_BATCH_URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch";
export const CENSUS_BATCH_LIMIT = 10_000;

export interface GeocodeHit {
  id: string;
  lat?: number;
  lng?: number;
  matched: boolean;
  matchedAddress?: string;
}

function csvCell(s: string): string {
  // Census output quotes every field; escape embedded quotes.
  return `"${(s ?? "").replace(/"/g, '""')}"`;
}

export function buildBatchCsv(rows: Array<Pick<Property, "id" | "address" | "city" | "state" | "zip">>): string {
  // No header row for the Census batch format.
  return rows.map((r) => [r.id, r.address, r.city, r.state, r.zip].map(csvCell).join(",")).join("\n");
}

/** Minimal CSV line parser (handles quoted fields with commas / escaped quotes). */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function parseBatchResponse(text: string): GeocodeHit[] {
  const hits: GeocodeHit[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    const id = f[0];
    const matched = (f[2] ?? "").toLowerCase() === "match";
    if (!matched) { hits.push({ id, matched: false }); continue; }
    const [lngS, latS] = (f[5] ?? "").split(",");
    const lng = Number(lngS), lat = Number(latS);
    hits.push({ id, matched: Number.isFinite(lat) && Number.isFinite(lng), lat, lng, matchedAddress: f[4] });
  }
  return hits;
}

export async function geocodeBatch(rows: Array<Pick<Property, "id" | "address" | "city" | "state" | "zip">>): Promise<GeocodeHit[]> {
  if (!rows.length) return [];
  if (rows.length > CENSUS_BATCH_LIMIT) throw new Error(`Census batch limit is ${CENSUS_BATCH_LIMIT} rows`);
  const form = new FormData();
  form.append("addressFile", new Blob([buildBatchCsv(rows)], { type: "text/csv" }), "addresses.csv");
  form.append("benchmark", "Public_AR_Current");
  const res = await fetch(CENSUS_BATCH_URL, { method: "POST", body: form, signal: AbortSignal.timeout(10 * 60_000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Census geocoder HTTP ${res.status}: ${text.slice(0, 300)}`);
  const hits = parseBatchResponse(text);
  // A non-empty batch that comes back with nothing recognizable is a failure
  // (HTML error page, proxy interstitial, format change), never "no match".
  if (hits.length === 0 || !text.includes('"')) {
    throw new Error(`Census geocoder returned no usable rows. Response began: ${text.slice(0, 300).replace(/\s+/g, " ")}`);
  }
  return hits;
}
