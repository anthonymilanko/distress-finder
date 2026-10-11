import type { DistressType, Property, PropertyPhoto } from "@/lib/types";
import { normalizeAddressKey, normalizeParcel } from "@/lib/normalize";
import { getRepo } from "@/lib/db";

/**
 * BatchData client (api.batchdata.com).
 *
 * MOCK MODE: with no BATCHDATA_API_KEY the client returns clearly-labeled fake
 * data so the UI works end to end. Set the key to go live.
 *
 * VERIFY BEFORE GOING LIVE: the endpoint paths and response field names below
 * follow BatchData's public v1 docs as best known at build time; confirm them
 * against https://developer.batchdata.com and adjust `mapLookup()` if a field
 * is named differently on your plan. Nothing here scrapes a listing site.
 */

const BASE = process.env.BATCHDATA_BASE_URL ?? "https://api.batchdata.com/api/v1";
const KEY = process.env.BATCHDATA_API_KEY;
const EST_COST_PER_LOOKUP = Number(process.env.BATCHDATA_COST_PER_LOOKUP ?? "0.01");

export const batchDataLive = () => Boolean(KEY);

export interface AddressSuggestion {
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface ParsedAddress {
  street: string;
  city?: string;
  state?: string;
  zip?: string;
}

/** Very small parser for "123 Main St, Milwaukee, WI 53202". */
export function parseAddress(input: string): ParsedAddress {
  const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
  const street = parts[0] ?? input.trim();
  let city: string | undefined;
  let state: string | undefined;
  let zip: string | undefined;
  const tail = parts.slice(1).join(" ");
  const m = tail.match(/^(.*?)\s*\b([A-Za-z]{2})\b\s*(\d{5})?/);
  if (m) {
    city = m[1]?.trim() || parts[1];
    state = m[2]?.toUpperCase();
    zip = m[3];
  } else if (parts[1]) city = parts[1];
  return { street, city, state, zip };
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`BatchData ${path} → HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

// ---------- Autocomplete ----------
export async function autocomplete(query: string): Promise<AddressSuggestion[]> {
  if (query.trim().length < 3) return [];
  if (!KEY) return mockAutocomplete(query);
  type Resp = { results?: { addresses?: Array<{ street?: string; city?: string; state?: string; zip?: string }> } };
  const data = await call<Resp>("/address/autocomplete", { searchCriteria: { query }, options: { take: 8 } });
  return (data.results?.addresses ?? []).map((a) => ({
    street: a.street ?? "", city: a.city ?? "", state: a.state ?? "", zip: a.zip ?? "",
    label: `${a.street ?? ""}, ${a.city ?? ""}, ${a.state ?? ""} ${a.zip ?? ""}`.replace(/\s+/g, " ").trim(),
  }));
}

// ---------- Lookup ----------
export interface LookupResult {
  property: Property;
  cached: boolean;
  live: boolean; // false = mock
  costUsd: number;
}

export async function lookupByAddress(addr: ParsedAddress): Promise<LookupResult> {
  const repo = getRepo();
  const cacheKey = "bd:" + normalizeAddressKey(addr.street, addr.zip) + "|" + (addr.city ?? "").toUpperCase();
  const cached = await repo.getLookup<Property>(cacheKey);
  if (cached) return { property: cached, cached: true, live: Boolean(KEY), costUsd: 0 };

  let property: Property;
  if (!KEY) {
    property = mockLookup(addr);
  } else {
    type Resp = { results?: { properties?: Array<Record<string, unknown>> } };
    const data = await call<Resp>("/property/lookup", {
      requests: [{ address: { street: addr.street, city: addr.city, state: addr.state, zip: addr.zip } }],
      options: { skipTrace: false },
    });
    const raw = data.results?.properties?.[0];
    if (!raw) throw new Error("No property found for that address.");
    property = mapLookup(raw, addr);
  }
  await repo.putLookup(cacheKey, property);
  return { property, cached: false, live: Boolean(KEY), costUsd: KEY ? EST_COST_PER_LOOKUP : 0 };
}

// ---------- Mapping (defensive: every field optional) ----------
type Any = Record<string, unknown>;
const g = (o: unknown, ...path: string[]): unknown => path.reduce<unknown>((cur, k) => (cur && typeof cur === "object" ? (cur as Any)[k] : undefined), o);
const num = (v: unknown): number | undefined => (v == null || v === "" ? undefined : Number.isFinite(Number(v)) ? Number(v) : undefined);
const str = (v: unknown): string | undefined => (v == null ? undefined : String(v));
const isoDate = (v: unknown): string | undefined => { const s = str(v); if (!s) return undefined; const d = new Date(s); return isNaN(+d) ? undefined : d.toISOString().slice(0, 10); };

export function mapLookup(raw: Any, addr: ParsedAddress): Property {
  const now = new Date().toISOString();
  const address = str(g(raw, "address", "street")) ?? addr.street;
  const city = str(g(raw, "address", "city")) ?? addr.city ?? "";
  const state = (str(g(raw, "address", "state")) ?? addr.state ?? "").toUpperCase();
  const zip = (str(g(raw, "address", "zip")) ?? addr.zip ?? "").slice(0, 5);
  const parcel = str(g(raw, "ids", "apn")) ?? str(g(raw, "assessment", "apn")) ?? str(raw.apn);
  const mailingAddress = str(g(raw, "owner", "mailingAddress", "street"));
  const ownerFirst = str(g(raw, "owner", "names", "0", "first")) ?? str(g(raw, "owner", "firstName"));
  const ownerLast = str(g(raw, "owner", "names", "0", "last")) ?? str(g(raw, "owner", "lastName"));
  const ownerName = str(g(raw, "owner", "fullName")) ?? ([ownerFirst, ownerLast].filter(Boolean).join(" ") || undefined);
  const estValue = num(g(raw, "valuation", "estimatedValue"));
  const mortgageBalance = num(g(raw, "openLien", "totalOpenLienBalance")) ?? num(g(raw, "valuation", "loanBalance"));
  const estEquity = num(g(raw, "valuation", "equityCurrentEstimatedBalance")) ?? (estValue != null && mortgageBalance != null ? estValue - mortgageBalance : undefined);
  const estEquityPct = num(g(raw, "valuation", "equityPercent")) ?? (estValue && estEquity != null ? Math.round((estEquity / estValue) * 1000) / 10 : undefined);
  const lastSaleDate = isoDate(g(raw, "sale", "lastSale", "saleDate"));
  const yearsOwned = lastSaleDate ? Math.floor((Date.now() - +new Date(lastSaleDate)) / (365.25 * 864e5)) : undefined;

  const distressTypes: DistressType[] = [];
  if (g(raw, "foreclosure", "status") || g(raw, "quickLists", "preforeclosure")) distressTypes.push("pre_foreclosure");
  if (g(raw, "quickLists", "auction")) distressTypes.push("foreclosure");
  if (g(raw, "quickLists", "taxDefault") || g(raw, "tax", "delinquent")) distressTypes.push("tax_delinquent");
  if (g(raw, "quickLists", "involuntaryLien") || num(g(raw, "involuntaryLien", "count"))) distressTypes.push("lien");
  if (g(raw, "quickLists", "vacant")) distressTypes.push("vacant");
  if (g(raw, "quickLists", "inherited") || g(raw, "quickLists", "probate")) distressTypes.push("probate");

  const photos: PropertyPhoto[] = ((g(raw, "images") as Array<Any> | undefined) ?? [])
    .map((im) => str(im.url))
    .filter((u): u is string => Boolean(u))
    .map((url) => ({ url, source: "batchdata" as const }));

  const mailingMismatch = mailingAddress ? normalizeAddressKey(mailingAddress) !== normalizeAddressKey(address) : undefined;
  return {
    id: crypto.randomUUID(),
    parcel,
    dedupeKey: parcel ? normalizeParcel(parcel) : normalizeAddressKey(address, zip),
    address, city, state, zip,
    county: str(g(raw, "address", "county")),
    lat: num(g(raw, "address", "geoLocation", "latitude")) ?? num(g(raw, "geoLocation", "latitude")),
    lng: num(g(raw, "address", "geoLocation", "longitude")) ?? num(g(raw, "geoLocation", "longitude")),
    ownerName, ownerFirst, ownerLast,
    ownerIsBusiness: Boolean(g(raw, "owner", "isCorporate") ?? g(raw, "quickLists", "corporateOwned")),
    mailingAddress,
    mailingCity: str(g(raw, "owner", "mailingAddress", "city")),
    mailingState: str(g(raw, "owner", "mailingAddress", "state")),
    mailingZip: str(g(raw, "owner", "mailingAddress", "zip")),
    absentee: Boolean(g(raw, "quickLists", "absenteeOwner")) || mailingMismatch,
    beds: num(g(raw, "building", "bedroomCount")),
    baths: num(g(raw, "building", "bathroomCount")),
    sqft: num(g(raw, "building", "totalBuildingAreaSquareFeet")),
    lotSqft: num(g(raw, "lot", "lotSizeSquareFeet")),
    yearBuilt: num(g(raw, "building", "yearBuilt")),
    propertyType: str(g(raw, "general", "propertyTypeDetail")) ?? str(g(raw, "general", "propertyType")),
    lastSaleDate,
    lastSalePrice: num(g(raw, "sale", "lastSale", "price")),
    estValue, mortgageBalance, estEquity, estEquityPct, yearsOwned,
    distressTypes,
    leadStatus: "new",
    photos,
    source: "batchdata_lookup",
    sourceDate: now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
    isSample: false,
  };
}

// ---------- Mock mode ----------
function mockAutocomplete(q: string): AddressSuggestion[] {
  const n = q.replace(/\D/g, "").slice(0, 4) || "123";
  const base = q.replace(/^\d+\s*/, "").split(",")[0].trim() || "Sample St";
  return [
    { label: `${n} ${base}, Milwaukee, WI 53202`, street: `${n} ${base}`, city: "Milwaukee", state: "WI", zip: "53202" },
    { label: `${n} ${base}, Tampa, FL 33602`, street: `${n} ${base}`, city: "Tampa", state: "FL", zip: "33602" },
    { label: `${n} ${base}, Houston, TX 77002`, street: `${n} ${base}`, city: "Houston", state: "TX", zip: "77002" },
  ];
}

function mockLookup(addr: ParsedAddress): Property {
  const now = new Date().toISOString();
  // Deterministic fake numbers from the address so the same search repeats.
  let h = 0;
  for (const c of addr.street + (addr.zip ?? "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pick = (mod: number, off = 0) => (h % mod) + off;
  const estValue = 90_000 + pick(260) * 1000;
  const mortgageBalance = pick(3) === 0 ? 0 : Math.round(estValue * (0.2 + pick(60) / 100));
  const estEquity = estValue - mortgageBalance;
  const lastSaleYear = 1996 + pick(27);
  const state = (addr.state ?? "WI").toUpperCase();
  const metro = { WI: { city: "Milwaukee", county: "Milwaukee", lat: 43.04, lng: -87.95, zip: "53202" }, FL: { city: "Tampa", county: "Hillsborough", lat: 27.95, lng: -82.46, zip: "33602" }, TX: { city: "Houston", county: "Harris", lat: 29.76, lng: -95.37, zip: "77002" } }[state] ?? { city: addr.city ?? "Milwaukee", county: "Milwaukee", lat: 43.04, lng: -87.95, zip: "53202" };
  const types: DistressType[][] = [["pre_foreclosure"], ["tax_delinquent"], ["lien"], ["probate", "vacant"], []];
  const address = addr.street;
  const zip = addr.zip ?? metro.zip;
  return {
    id: crypto.randomUUID(),
    parcel: `MOCK-${(h % 9000) + 1000}-000`,
    dedupeKey: normalizeAddressKey(address, zip),
    address, city: addr.city ?? metro.city, state, zip, county: metro.county,
    lat: metro.lat + (pick(200) - 100) / 1000, lng: metro.lng + (pick(200) - 100) / 1000,
    ownerName: "MOCK OWNER (no API key set)", ownerFirst: "Mock", ownerLast: "Owner", ownerIsBusiness: false,
    mailingAddress: pick(2) ? "999 Away Ave" : address, mailingCity: pick(2) ? "Phoenix" : metro.city, mailingState: pick(2) ? "AZ" : state, mailingZip: pick(2) ? "85001" : zip,
    absentee: Boolean(pick(2)),
    beds: 2 + pick(3), baths: 1 + pick(2), sqft: 900 + pick(1400), lotSqft: 4000 + pick(8000), yearBuilt: 1905 + pick(95), propertyType: "Single Family",
    lastSaleDate: `${lastSaleYear}-0${1 + pick(9)}-15`, lastSalePrice: Math.round(estValue * 0.6),
    estValue, mortgageBalance, estEquity, estEquityPct: Math.round((estEquity / estValue) * 1000) / 10,
    yearsOwned: new Date().getFullYear() - lastSaleYear,
    distressTypes: types[pick(types.length)],
    leadStatus: "new", photos: [],
    source: "batchdata_mock", sourceDate: now.slice(0, 10), createdAt: now, updatedAt: now, isSample: true,
  };
}
