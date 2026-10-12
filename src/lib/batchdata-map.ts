import type { DistressType, Lien, Property, PropertyPhoto } from "./types.ts";
import { normalizeAddressKey, normalizeParcel } from "./normalize.ts";
import { money } from "./format.ts";
import type { ParsedAddress } from "./batchdata.ts";

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
  const parcel = str(g(raw, "general", "apn")) ?? str(g(raw, "ids", "apn")) ?? str(g(raw, "assessment", "apn")) ?? str(g(raw, "legal", "apn")) ?? str(raw.apn);
  const mailingAddress = str(g(raw, "owner", "mailingAddress", "street"));
  const ownerFirst = str(g(raw, "owner", "names", "0", "first")) ?? str(g(raw, "owner", "firstName"));
  const ownerLast = str(g(raw, "owner", "names", "0", "last")) ?? str(g(raw, "owner", "lastName"));
  const ownerName = str(g(raw, "owner", "fullName")) ?? str(g(raw, "owner", "names", "0", "full")) ?? str(g(raw, "owner", "name")) ?? ([ownerFirst, ownerLast].filter(Boolean).join(" ") || undefined);
  const ownerOccupied = g(raw, "owner", "ownerOccupied") as boolean | undefined;
  const estValue = num(g(raw, "valuation", "estimatedValue")) ?? num(g(raw, "valuation", "avm")) ?? num(g(raw, "assessment", "totalMarketValue")) ?? num(g(raw, "assessment", "assessedValue"));
  const mortgageBalance = num(g(raw, "openLien", "totalOpenLienBalance")) ?? num(g(raw, "openLien", "totalOpenLienAmount")) ?? num(g(raw, "valuation", "loanBalance")) ?? num(g(raw, "mortgage", "totalBalance"));
  const estEquity = num(g(raw, "valuation", "equityCurrentEstimatedBalance")) ?? (estValue != null && mortgageBalance != null ? estValue - mortgageBalance : undefined);
  const estEquityPct = num(g(raw, "valuation", "equityPercent")) ?? num(g(raw, "valuation", "equityCurrentEstimatedPercent")) ?? (estValue && estEquity != null ? Math.round((estEquity / estValue) * 1000) / 10 : undefined);
  const ql = (k: string) => g(raw, "quickLists", k) === true;
  const lastSaleDate = isoDate(g(raw, "sale", "lastSale", "saleDate")) ?? isoDate(g(raw, "sale", "lastSale", "recordingDate")) ?? isoDate(g(raw, "sale", "lastSaleDate")) ?? isoDate(g(raw, "deed", "lastSaleDate"));
  const ownedSince = isoDate(g(raw, "owner", "ownershipStartDate")) ?? lastSaleDate;
  const yearsOwned = num(g(raw, "intel", "lengthOfResidenceYears")) ?? num(g(raw, "owner", "lengthOfResidenceYears")) ?? (ownedSince ? Math.floor((Date.now() - +new Date(ownedSince)) / (365.25 * 864e5)) : undefined);

  const distressTypes: DistressType[] = [];
  const fcStatus = str(g(raw, "foreclosure", "status")) ?? "";
  const fcFlag = g(raw, "foreclosure", "flag") === "Y" || Boolean(fcStatus);
  if (ql("noticeOfSale") || ql("activeAuction") || /sale|auction/i.test(fcStatus)) distressTypes.push("foreclosure");
  else if (fcFlag || ql("preforeclosure") || ql("noticeOfDefault") || ql("noticeOfLisPendens")) distressTypes.push("pre_foreclosure");
  if (ql("taxDefault") || g(raw, "tax", "delinquent")) distressTypes.push("tax_delinquent");
  if (ql("involuntaryLien") || num(g(raw, "involuntaryLien", "count"))) distressTypes.push("lien");
  if (ql("vacant") || g(raw, "general", "vacant") === true) distressTypes.push("vacant");
  if (ql("inherited") || ql("probate")) distressTypes.push("probate");
  if (ql("tiredLandlord")) distressTypes.push("tired_landlord");
  if (ql("expiredListing") || ql("failedListing") || ql("canceledListing")) distressTypes.push("expired_listing");

  // Informative flags that aren't distress on their own but shape the pitch.
  const tags: string[] = [];
  const TAG_FLAGS: Array<[string, string]> = [
    ["freeAndClear", "free & clear"], ["highEquity", "high equity"], ["lowEquity", "low equity"], ["seniorOwner", "senior owner"],
    ["outOfStateOwner", "out-of-state owner"], ["absenteeOwnerOutOfState", "out-of-state owner"], ["trustOwned", "trust owned"],
    ["corporateOwned", "corporate owned"], ["cashBuyer", "bought with cash"], ["forSaleByOwner", "FSBO"], ["onMarket", "on market"],
    ["listedBelowMarketPrice", "listed below market"], ["hasHoa", "HOA"], ["mailingAddressVacant", "mailing address vacant"],
  ];
  for (const [k, label] of TAG_FLAGS) if (ql(k) && !tags.includes(label)) tags.push(label);
  const firstMortgage = (g(raw, "openLien", "mortgages") as Array<Any> | undefined)?.[0];

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
    lat: num(g(raw, "address", "geoLocation", "latitude")) ?? num(g(raw, "address", "latitude")) ?? num(g(raw, "geoLocation", "latitude")) ?? num(g(raw, "general", "latitude")),
    lng: num(g(raw, "address", "geoLocation", "longitude")) ?? num(g(raw, "address", "longitude")) ?? num(g(raw, "geoLocation", "longitude")) ?? num(g(raw, "general", "longitude")),
    ownerName, ownerFirst, ownerLast,
    ownerIsBusiness: Boolean(g(raw, "owner", "isCorporate")) || ql("corporateOwned") || /company|corporat|llc|trust|business/i.test(str(g(raw, "owner", "ownerStatusType")) ?? ""),
    mailingAddress,
    mailingCity: str(g(raw, "owner", "mailingAddress", "city")),
    mailingState: str(g(raw, "owner", "mailingAddress", "state")),
    mailingZip: str(g(raw, "owner", "mailingAddress", "zip")),
    absentee: ql("absenteeOwner") || (ownerOccupied === false ? true : undefined) || mailingMismatch,
    beds: num(g(raw, "building", "bedroomCount")) ?? num(g(raw, "building", "bedrooms")) ?? num(g(raw, "building", "roomsBedrooms")),
    baths: num(g(raw, "building", "bathroomCount")) ?? num(g(raw, "building", "bathrooms")) ?? num(g(raw, "building", "totalBathroomCount")),
    sqft: num(g(raw, "building", "totalBuildingAreaSquareFeet")) ?? num(g(raw, "building", "livingAreaSquareFeet")) ?? num(g(raw, "building", "squareFeet")) ?? num(g(raw, "building", "buildingAreaSquareFeet")),
    lotSqft: num(g(raw, "lot", "lotSizeSquareFeet")) ?? (num(g(raw, "lot", "lotSizeAcres")) != null ? Math.round(Number(g(raw, "lot", "lotSizeAcres")) * 43560) : undefined),
    yearBuilt: num(g(raw, "building", "yearBuilt")) ?? num(g(raw, "building", "effectiveYearBuilt")),
    propertyType: str(g(raw, "general", "propertyTypeDetail")) ?? str(g(raw, "general", "propertyType")) ?? str(g(raw, "general", "propertyTypeCategory")) ?? str(g(raw, "building", "propertyType")),
    lastSaleDate,
    lastSalePrice: num(g(raw, "sale", "lastSale", "price")) ?? num(g(raw, "sale", "lastSalePrice")) ?? num(g(raw, "deed", "lastSalePrice")),
    estValue, mortgageBalance, estEquity, estEquityPct, yearsOwned,
    ltvPct: num(g(raw, "valuation", "ltv")) ?? (estValue && mortgageBalance != null ? Math.round((mortgageBalance / estValue) * 1000) / 10 : undefined),
    assessedValue: num(g(raw, "assessment", "totalAssessedValue")) ?? num(g(raw, "assessment", "assessedValue")),
    taxAmount: num(g(raw, "tax", "taxAmount")),
    lenderName: str(firstMortgage?.lenderName) ?? str(firstMortgage?.assignedLenderName),
    tags: tags.length ? tags : undefined,
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

/** Foreclosure notice + open mortgages from the response, as rows for the court & lien table. caseNumber is a stable key for dedupe. */
export function extractLiens(raw: Any, propertyId: string): Lien[] {
  const now = new Date().toISOString().slice(0, 10);
  const out: Lien[] = [];
  const fc = raw.foreclosure as Any | undefined;
  const mortgages = (g(raw, "openLien", "mortgages") as Array<Any> | undefined) ?? [];
  if (fc && (fc.flag === "Y" || fc.status)) {
    const status = str(fc.status) ?? "Foreclosure filing";
    const filed = isoDate(fc.filingDate) ?? isoDate(fc.recordingDate);
    const auction = /sale|auction/i.test(status) || Boolean(fc.auctionDate);
    out.push({
      id: crypto.randomUUID(), propertyId,
      kind: auction ? "foreclosure" : "pre_foreclosure",
      caseNumber: `BD-FC-${filed ?? "undated"}`,
      caseType: "Foreclosure",
      status: `Open · ${status}`,
      filedDate: filed,
      amount: num(fc.defaultAmount) ?? num(fc.loanBalance),
      plaintiff: str(fc.trusteeName) ?? str(fc.lenderName) ?? str(mortgages[0]?.lenderName),
      source: "batchdata", sourceDate: now, confidence: "confirmed",
      rawText: [str(fc.documentType), fc.auctionDate ? `Auction ${isoDate(fc.auctionDate)}` : undefined].filter(Boolean).join(" · ") || undefined,
    });
  }
  for (const m of mortgages) {
    const rec = isoDate(m.recordingDate);
    const amt = num(m.currentEstimatedBalance) ?? num(m.loanAmount);
    out.push({
      id: crypto.randomUUID(), propertyId,
      kind: "other",
      caseNumber: `BD-MTG-${rec ?? "undated"}-${num(m.loanAmount) ?? 0}`,
      caseType: "Mortgage",
      status: "Current loan",
      filedDate: rec,
      amount: amt,
      plaintiff: str(m.lenderName) ?? str(m.assignedLenderName),
      source: "batchdata", sourceDate: now, confidence: "confirmed",
      rawText: [str(m.loanType), m.loanTermMonths ? `${m.loanTermMonths} mo` : undefined, m.currentEstimatedInterestRate ? `${m.currentEstimatedInterestRate}%` : undefined, num(m.loanAmount) ? `orig ${money(num(m.loanAmount))}` : undefined].filter(Boolean).join(" · ") || undefined,
    });
  }
  return out;
}

