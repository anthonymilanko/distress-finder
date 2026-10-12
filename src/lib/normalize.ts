// Pure helpers that turn rows from a BatchLeads-style CSV export (and similar
// lead-list exports) into Property objects. No I/O, no React.

import type { ColumnMapping, DistressType, Property } from "./types";

// ---------------------------------------------------------------------------
// Column aliases
// ---------------------------------------------------------------------------

/** Canonical field name -> lowercase header aliases. */
export const COLUMN_ALIASES: Record<string, string[]> = {
  parcel: ["apn", "parcel", "parcel number", "parcel id", "assessor parcel number", "pin"],
  address: ["property address", "situs address", "address", "street address", "property street"],
  city: ["property city", "city"],
  state: ["property state", "state"],
  zip: ["property zip", "zip", "zip code", "postal code"],
  county: ["county", "property county"],
  ownerName: ["owner name", "owner", "owner 1 name", "owner full name"],
  ownerFirst: ["owner first name", "owner 1 first name", "first name"],
  ownerLast: ["owner last name", "owner 1 last name", "last name"],
  mailingAddress: ["mailing address", "mail address", "owner mailing address", "mailing street"],
  mailingCity: ["mailing city", "mail city", "owner mailing city"],
  mailingState: ["mailing state", "mail state", "owner mailing state"],
  mailingZip: ["mailing zip", "mail zip", "mailing zip code", "owner mailing zip"],
  beds: ["bedrooms", "beds", "bed"],
  baths: ["bathrooms", "baths", "bath"],
  sqft: ["square feet", "sqft", "sq ft", "building sqft", "living area"],
  lotSqft: ["lot size", "lot sqft", "lot size sqft", "lot square feet"],
  yearBuilt: ["year built", "yr built"],
  propertyType: ["property type", "use code", "land use"],
  lastSaleDate: ["last sale date", "sale date", "last sold date"],
  lastSalePrice: ["last sale price", "sale price", "last sold price", "sale amount"],
  estValue: [
    "estimated value",
    "est value",
    "avm",
    "estimated market value",
    "market value",
    "zestimate",
  ],
  mortgageBalance: [
    "estimated mortgage balance",
    "mortgage balance",
    "open mortgage balance",
    "loan balance",
    "est loan balance",
  ],
  estEquity: ["estimated equity", "equity", "est equity"],
  estEquityPct: [
    "equity percent",
    "equity %",
    "estimated equity percent",
    "equity pct",
    "equity percentage",
  ],
  lat: ["latitude", "lat"],
  lng: ["longitude", "lng", "lon"],
  distress: ["distress", "lead type", "list type", "tags", "tag names", "tag", "flags", "list name", "lists", "list", "motivation", "lead source", "campaign"],
  ltvPct: ["ltv", "loan to value", "ltv pct", "ltv current estimated combined", "ltv current estimated", "combined ltv", "estimated ltv", "cltv"],
  preForeclosure: ["pre-foreclosure", "preforeclosure", "pre foreclosure"],
  taxDelinquent: ["tax delinquent", "tax delinquency", "delinquent taxes"],
  vacant: ["vacant", "vacancy"],
  absentee: ["absentee", "absentee owner", "owner occupied"],
};

/** Headers that hold one of many phone / email values ("Phone 1", "Mobile 2", "Email"). */
export const MULTI_FIELDS: Record<"phones" | "emails", RegExp> = {
  phones: /^(phone|phones|mobile|cell|landline|tel|telephone|wireless|contact phone|owner phone)(\s*\d+)?$/,
  emails: /^(email|emails|e mail|email address|owner email|contact email)(\s*\d+)?$/,
};

/** Lowercase, strip punctuation, collapse whitespace. "%" becomes " pct". */
function headerKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/%/g, " pct ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function camelToWords(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

interface AliasEntry {
  field: string;
  key: string; // normalized alias
  tokens: string[];
}

const ALIAS_ENTRIES: AliasEntry[] = (() => {
  const out: AliasEntry[] = [];
  for (const field of Object.keys(COLUMN_ALIASES)) {
    const seen = new Set<string>();
    const all = [...COLUMN_ALIASES[field], camelToWords(field)];
    for (const a of all) {
      const key = headerKey(a);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ field, key, tokens: key.split(" ") });
    }
  }
  return out;
})();

function containsTokens(hay: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > hay.length) return false;
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Map raw CSV headers to canonical field names.
 * Exact (normalized) alias matches win; remaining headers are matched by
 * "contains" (whole-word, longest alias first).
 * Returns canonical -> original header, plus headers that matched nothing.
 */
export function mapHeaders(headers: string[]): {
  mapping: ColumnMapping;
  unmapped: string[];
} {
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  const keys = headers.map((h) => headerKey(h ?? ""));

  // Pass 0: multi-value columns (phones, emails) — collect every match, in order.
  for (const field of Object.keys(MULTI_FIELDS) as Array<keyof typeof MULTI_FIELDS>) {
    const hits: string[] = [];
    headers.forEach((h, i) => {
      if (used.has(i) || !keys[i]) return;
      if (MULTI_FIELDS[field].test(keys[i])) {
        hits.push(h);
        used.add(i);
      }
    });
    if (hits.length) mapping[field] = hits;
  }

  // Pass 1: exact
  headers.forEach((h, i) => {
    const key = keys[i];
    if (!key) return;
    for (const e of ALIAS_ENTRIES) {
      if (e.key === key && mapping[e.field] === undefined) {
        mapping[e.field] = h;
        used.add(i);
        return;
      }
    }
  });

  // Pass 2: contains, longest alias first
  const candidates = [...ALIAS_ENTRIES].sort(
    (a, b) => b.tokens.length - a.tokens.length || b.key.length - a.key.length,
  );
  for (const e of candidates) {
    if (mapping[e.field] !== undefined) continue;
    for (let i = 0; i < headers.length; i++) {
      if (used.has(i) || !keys[i]) continue;
      const tokens = keys[i].split(" ");
      if (!containsTokens(tokens, e.tokens)) continue;
      // Guards against obviously wrong matches.
      if (tokens.some((t) => t === "email" || t === "phone" || t === "url" || t === "link")) continue;
      const isMailingField = e.field.startsWith("mailing");
      if (!isMailingField && tokens.some((t) => t === "mail" || t === "mailing")) continue;
      if (
        e.field === "estEquity" &&
        tokens.some((t) => t === "pct" || t === "percent" || t === "percentage")
      ) {
        continue;
      }
      mapping[e.field] = headers[i];
      used.add(i);
      break;
    }
  }

  const unmapped = headers.filter((_, i) => !used.has(i));
  return { mapping, unmapped };
}

/** Stable id for a header layout, so a confirmed mapping can be reused next time. */
export function headerSignature(headers: string[]): string {
  const norm = headers.map((h) => headerKey(h ?? "")).filter(Boolean).sort().join("|");
  let h = 2166136261;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0") + "-" + headers.length;
}

/** Fields the mapping-review screen can assign a column to. */
export const MAPPABLE_FIELDS: Array<{ field: string; label: string }> = [
  { field: "address", label: "Property address (street)" },
  { field: "city", label: "Property city" },
  { field: "state", label: "Property state" },
  { field: "zip", label: "Property ZIP" },
  { field: "county", label: "County" },
  { field: "parcel", label: "Parcel / APN" },
  { field: "ownerName", label: "Owner full name" },
  { field: "ownerFirst", label: "Owner first name" },
  { field: "ownerLast", label: "Owner last name" },
  { field: "mailingAddress", label: "Mailing address" },
  { field: "mailingCity", label: "Mailing city" },
  { field: "mailingState", label: "Mailing state" },
  { field: "mailingZip", label: "Mailing ZIP" },
  { field: "phones", label: "Phone (one of several)" },
  { field: "emails", label: "Email (one of several)" },
  { field: "beds", label: "Beds" },
  { field: "baths", label: "Baths" },
  { field: "sqft", label: "Square feet" },
  { field: "lotSqft", label: "Lot size (sq ft)" },
  { field: "yearBuilt", label: "Year built" },
  { field: "propertyType", label: "Property type" },
  { field: "lastSaleDate", label: "Last sale date" },
  { field: "lastSalePrice", label: "Last sale price" },
  { field: "estValue", label: "Estimated value" },
  { field: "mortgageBalance", label: "Mortgage balance" },
  { field: "estEquity", label: "Estimated equity ($)" },
  { field: "estEquityPct", label: "Equity %" },
  { field: "ltvPct", label: "LTV %" },
  { field: "lat", label: "Latitude" },
  { field: "lng", label: "Longitude" },
  { field: "distress", label: "Tags / list names / distress" },
  { field: "preForeclosure", label: "Pre-foreclosure flag" },
  { field: "taxDelinquent", label: "Tax delinquent flag" },
  { field: "vacant", label: "Vacant flag" },
  { field: "absentee", label: "Absentee flag" },
];

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

/** Uppercase, strip non-alphanumerics. */
export function normalizeParcel(p: string): string {
  return (p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeAddressText(address: string): string {
  return (address ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** `${normalized address}|${zip5}` — uppercase, punctuation stripped, spaces collapsed. */
export function normalizeAddressKey(address: string, zip?: string): string {
  const z = (zip ?? "").replace(/\D/g, "").slice(0, 5);
  return `${normalizeAddressText(address)}|${z}`;
}

function clean(v: string | undefined | null): string | undefined {
  if (v === undefined || v === null) return undefined;
  const t = String(v).trim();
  return t === "" ? undefined : t;
}

function parseNum(v: string | undefined): number | undefined {
  const t = clean(v);
  if (t === undefined) return undefined;
  const s = t.replace(/[$,%\s]/g, "");
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseDateISO(v: string | undefined): string | undefined {
  const t = clean(v);
  if (t === undefined) return undefined;
  let iso: string | undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(t);
  if (m) {
    // Already ISO: keep the calendar date as written (avoid timezone shifts).
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) iso = `${m[1]}-${m[2]}-${m[3]}`;
  } else {
    const d = new Date(t);
    if (!Number.isNaN(d.getTime())) {
      iso = `${String(d.getFullYear()).padStart(4, "0")}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }
  }
  if (!iso) return undefined;
  const year = Number(iso.slice(0, 4));
  return year >= 1800 && year <= 2200 ? iso : undefined;
}

function isTruthy(v: string | undefined): boolean {
  const t = clean(v);
  if (t === undefined) return false;
  return ["yes", "true", "1", "y"].includes(t.toLowerCase());
}

function isFalsy(v: string | undefined): boolean {
  const t = clean(v);
  if (t === undefined) return false;
  return ["no", "false", "0", "n"].includes(t.toLowerCase());
}

const BUSINESS_TOKENS = new Set([
  "LLC",
  "INC",
  "CORP",
  "CORPORATION",
  "TRUST",
  "TRUSTEE",
  "LP",
  "LLP",
  "LTD",
  "CO",
  "COMPANY",
  "BANK",
  "ASSOCIATION",
  "HOLDINGS",
  "PROPERTIES",
  "INVESTMENTS",
  "PARTNERS",
]);

function isBusinessName(name: string): boolean {
  const tokens = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(" ");
  return tokens.some((t) => BUSINESS_TOKENS.has(t));
}

function splitPersonName(name: string): { first?: string; last?: string } {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.includes(",")) {
    const idx = n.indexOf(",");
    const last = n.slice(0, idx).trim();
    const first = n.slice(idx + 1).trim();
    return { first: first || undefined, last: last || undefined };
  }
  const parts = n.split(" ");
  if (parts.length === 1) return { last: parts[0] };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function distressFromText(text: string): DistressType[] {
  const out: DistressType[] = [];
  let t = text.toLowerCase();
  const preRe = /pre[-\s]?fore(?:closure|clos)?|lis pendens|notice of default/g;
  const stripped = t.replace(preRe, " ");
  if (stripped !== t) {
    out.push("pre_foreclosure");
    t = stripped;
  }
  if (/foreclos|sheriff/.test(t)) out.push("foreclosure");
  if (/tax/.test(t)) out.push("tax_delinquent");
  if (/lien/.test(t)) out.push("lien");
  if (/judgment/.test(t)) out.push("judgment");
  if (/probate|deceased/.test(t) || /(^|[^a-z])estate/.test(t.replace(/real\s+estate/g, " "))) {
    out.push("probate");
  }
  if (/vacant/.test(t)) out.push("vacant");
  if (/\bcode\b|violation/.test(t)) out.push("code_violation");
  if (/tired\s*landlord|landlord|eviction/.test(t)) out.push("tired_landlord");
  if (/expired|withdrawn|cancell?ed\s*listing/.test(t)) out.push("expired_listing");
  return out;
}

/** Digits only; US 10-digit (or 11 starting with 1) → "2625551234". */
function normalizePhone(v: string): string | undefined {
  const d = v.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  if (d.length === 10) return d;
  return undefined;
}

function fullYearsBetween(isoDate: string, now: Date): number {
  const y = Number(isoDate.slice(0, 4));
  const m = Number(isoDate.slice(5, 7));
  const d = Number(isoDate.slice(8, 10));
  let years = now.getFullYear() - y;
  const nm = now.getMonth() + 1;
  if (nm < m || (nm === m && now.getDate() < d)) years -= 1;
  return Math.max(0, years);
}

function stripUndefined<T extends object>(o: T): T {
  const out = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

// ---------------------------------------------------------------------------
// normalizeRow
// ---------------------------------------------------------------------------

export function normalizeRow(
  row: Record<string, string>,
  mapping: ColumnMapping,
  meta: { source: string; sourceDate: string; importBatchId: string },
): Property | null {
  const raw = (field: string): string | undefined => {
    const h = mapping[field];
    if (h === undefined) return undefined;
    if (Array.isArray(h)) return clean(row[h[0]]);
    return clean(row[h]);
  };
  const rawList = (field: string): string[] => {
    const h = mapping[field];
    if (h === undefined) return [];
    const hs = Array.isArray(h) ? h : [h];
    return hs.map((x) => clean(row[x])).filter((v): v is string => Boolean(v));
  };

  const address = raw("address");
  if (!address) return null;

  const city = raw("city") ?? "";
  const stateRaw = raw("state") ?? "";
  const state = stateRaw.toUpperCase().slice(0, 2);
  const zipDigits = (raw("zip") ?? "").replace(/\D/g, "").slice(0, 5);
  const parcel = raw("parcel");

  // Owner
  let ownerName = raw("ownerName");
  let ownerFirst = raw("ownerFirst");
  let ownerLast = raw("ownerLast");
  if (!ownerName && (ownerFirst || ownerLast)) {
    ownerName = [ownerFirst, ownerLast].filter(Boolean).join(" ");
  }
  let ownerIsBusiness: boolean | undefined;
  if (ownerName) {
    ownerIsBusiness = isBusinessName(ownerName);
    if (!ownerIsBusiness && !ownerFirst && !ownerLast) {
      const parts = splitPersonName(ownerName);
      ownerFirst = parts.first;
      ownerLast = parts.last;
    }
  }

  // Mailing / absentee
  const mailingAddress = raw("mailingAddress");
  const mailingCity = raw("mailingCity");
  const mailingState = raw("mailingState")?.toUpperCase().slice(0, 2);
  const mailingZipDigits = (raw("mailingZip") ?? "").replace(/\D/g, "").slice(0, 5);
  const mailingZip = mailingZipDigits || undefined;

  let absentee: boolean | undefined;
  const absHeader = mapping["absentee"];
  const absValue = raw("absentee");
  let explicitAbsentee = false;
  if (absValue !== undefined) {
    const inverted = absHeader !== undefined && /occupied/i.test(Array.isArray(absHeader) ? absHeader[0] : absHeader);
    explicitAbsentee = inverted ? isFalsy(absValue) : isTruthy(absValue);
  }
  const derivedAbsentee =
    !!mailingAddress &&
    normalizeAddressText(mailingAddress) !== normalizeAddressText(address);
  if (absValue !== undefined || mailingAddress) {
    absentee = explicitAbsentee || derivedAbsentee;
  }

  // Money
  const lastSaleDate = parseDateISO(raw("lastSaleDate"));
  const estValue = parseNum(raw("estValue"));
  const mortgageBalance = parseNum(raw("mortgageBalance"));
  let estEquity = parseNum(raw("estEquity"));
  if (estEquity === undefined && estValue !== undefined && mortgageBalance !== undefined) {
    estEquity = estValue - mortgageBalance;
  }
  let estEquityPct = parseNum(raw("estEquityPct"));
  if (estEquityPct === undefined && estEquity !== undefined && estValue !== undefined && estValue > 0) {
    estEquityPct = Math.round((estEquity / estValue) * 1000) / 10;
  }
  // LTV is the only equity signal in skip-trace exports: equity % ≈ 100 − LTV.
  // An LTV of exactly 0 usually means "no loan found", not "no loan" — so it is
  // only trusted when nothing says a mortgage exists (no foreclosure flag, no balance).
  let ltvPct = parseNum(raw("ltvPct"));
  if (ltvPct !== undefined && ltvPct > 0 && ltvPct <= 1) ltvPct = ltvPct * 100; // 0.25 → 25%
  const distressHint = rawList("distress").join(" ").toLowerCase() + (isTruthy(raw("preForeclosure")) ? " foreclosure" : "");
  const mortgageImplied = /foreclos|pre-fore|lis pendens|notice of default|auction/.test(distressHint) || (mortgageBalance !== undefined && mortgageBalance > 0);
  const ltvUsable = ltvPct !== undefined && ltvPct >= 0 && ltvPct <= 100 && !(ltvPct === 0 && mortgageImplied);
  if (estEquityPct === undefined && ltvUsable) {
    estEquityPct = Math.round((100 - (ltvPct as number)) * 10) / 10;
  }
  if (estEquity === undefined && estEquityPct !== undefined && estValue !== undefined) {
    estEquity = Math.round(estValue * (estEquityPct / 100));
  }

  // Contact + tags
  const phones = Array.from(new Set(rawList("phones").map(normalizePhone).filter((v): v is string => Boolean(v))));
  const emails = Array.from(new Set(rawList("emails").map((e) => e.toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))));
  const tags = Array.from(new Set(rawList("distress").flatMap((t) => t.split(/[,;|]/)).map((t) => t.trim()).filter(Boolean)));
  const now = new Date();
  const yearsOwned = lastSaleDate ? fullYearsBetween(lastSaleDate, now) : undefined;

  // Distress
  const types: DistressType[] = [];
  const distressText = rawList("distress").join(", ");
  if (distressText) types.push(...distressFromText(distressText));
  if (isTruthy(raw("preForeclosure"))) types.push("pre_foreclosure");
  if (isTruthy(raw("taxDelinquent"))) types.push("tax_delinquent");
  if (isTruthy(raw("vacant"))) types.push("vacant");
  const distressTypes = Array.from(new Set(types));

  const addressKey = normalizeAddressKey(address, zipDigits);
  const parcelKey = parcel ? normalizeParcel(parcel) : "";
  const dedupeKey = parcelKey.length >= 4 ? parcelKey : addressKey;

  const nowIso = now.toISOString();
  const yearBuilt = parseNum(raw("yearBuilt"));

  const prop: Property = {
    id: globalThis.crypto.randomUUID(),
    parcel,
    dedupeKey,
    address,
    city,
    state,
    zip: zipDigits,
    county: raw("county"),
    lat: parseNum(raw("lat")),
    lng: parseNum(raw("lng")),
    ownerName,
    ownerFirst,
    ownerLast,
    ownerIsBusiness,
    mailingAddress,
    mailingCity,
    mailingState,
    mailingZip,
    absentee,
    beds: parseNum(raw("beds")),
    baths: parseNum(raw("baths")),
    sqft: parseNum(raw("sqft")),
    lotSqft: parseNum(raw("lotSqft")),
    yearBuilt: yearBuilt !== undefined ? Math.trunc(yearBuilt) : undefined,
    propertyType: raw("propertyType"),
    lastSaleDate,
    lastSalePrice: parseNum(raw("lastSalePrice")),
    estValue,
    mortgageBalance,
    estEquity,
    estEquityPct,
    ltvPct,
    yearsOwned,
    phones: phones.length ? phones : undefined,
    emails: emails.length ? emails : undefined,
    tags: tags.length ? tags : undefined,
    distressTypes,
    leadStatus: "new",
    photos: [],
    source: meta.source,
    sourceDate: meta.sourceDate,
    importBatchId: meta.importBatchId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return stripUndefined(prop);
}

// ---------------------------------------------------------------------------
// mergeProperty
// ---------------------------------------------------------------------------

// Fields that always come from the existing record.
const KEEP_EXISTING: ReadonlySet<string> = new Set([
  "id",
  "leadStatus",
  "distressScore",
  "photos",
  "imageFlags",
  "needsReview",
  "createdAt",
]);

/**
 * Merge a freshly-imported record into an existing one. The existing record's
 * identity and app state (id, leadStatus, score, photos, review flags) win;
 * undefined/blank fields are filled from the incoming record.
 */
export function mergeProperty(existing: Property, incoming: Property): Property {
  const merged: Record<string, unknown> = { ...existing };
  const inc = incoming as unknown as Record<string, unknown>;

  for (const key of Object.keys(inc)) {
    if (KEEP_EXISTING.has(key)) continue;
    const cur = merged[key];
    const val = inc[key];
    if (val === undefined) continue;
    const curMissing = cur === undefined || (typeof cur === "string" && cur.trim() === "");
    if (curMissing) merged[key] = val;
  }

  merged.distressTypes = Array.from(new Set([...existing.distressTypes, ...incoming.distressTypes]));
  const union = (a?: string[], b?: string[]) => { const u = Array.from(new Set([...(a ?? []), ...(b ?? [])])); return u.length ? u : undefined; };
  merged.phones = union(existing.phones, incoming.phones);
  merged.emails = union(existing.emails, incoming.emails);
  merged.tags = union(existing.tags, incoming.tags);
  merged.updatedAt = incoming.updatedAt;
  merged.sourceDate = incoming.sourceDate;

  // A real record replaces sample provenance; otherwise keep isSample only if both are samples.
  const bothSample = existing.isSample === true && incoming.isSample === true;
  if (bothSample) {
    merged.isSample = true;
  } else {
    merged.isSample = false;
    if (existing.isSample === true) {
      merged.source = incoming.source;
      if (incoming.importBatchId !== undefined) merged.importBatchId = incoming.importBatchId;
    }
  }

  return merged as unknown as Property;
}
