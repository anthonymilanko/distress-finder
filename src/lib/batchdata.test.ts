import { test } from "node:test";
import assert from "node:assert/strict";
import { extractLiens, mapLookup } from "./batchdata-map.ts";

// Trimmed from a real all-attributes response (core + valuation + owner + mortgage + deed + foreclosure + quicklist datasets).
const raw = {
  ids: { apn: "211-1534-07-000" },
  lot: { lotSizeAcres: 0.745, lotSizeSquareFeet: 32452 },
  tax: { taxYear: 2025, taxAmount: 2242.08 },
  sale: { lastSale: { price: 85000, saleDate: "2015-05-29T00:00:00.000Z" } },
  intel: { lengthOfResidenceYears: 11 },
  owner: { fullName: "James C Jr Gregware", names: [{ full: "James C Jr Gregware", first: "James", last: "Gregware" }], ownerOccupied: true, ownerStatusType: "Individual", ownershipStartDate: "2015-06-01T00:00:00.000Z", mailingAddress: { street: "112 Lake Aire Dr", city: "Chetek", state: "WI", zip: "54728" } },
  address: { street: "112 Lake Aire Dr", city: "Chetek", state: "WI", zip: "54728", county: "Barron", latitude: 45.326432, longitude: -91.672546 },
  general: { vacant: false, propertyTypeDetail: "Single Family" },
  building: { yearBuilt: 1975, bedroomCount: 4, bathroomCount: 2, totalBuildingAreaSquareFeet: 1664 },
  openLien: { mortgages: [{ lenderName: "HUD", loanAmount: 4354, currentEstimatedBalance: 4127, recordingDate: "2024-10-08T00:00:00.000Z", loanTermMonths: 252, currentEstimatedInterestRate: 6.47 }], totalOpenLienBalance: 4127 },
  valuation: { ltv: 1.6, equityPercent: 98.4, estimatedValue: 256603, equityCurrentEstimatedBalance: 252476 },
  assessment: { totalAssessedValue: 130700 },
  quickLists: { highEquity: true, preforeclosure: true, noticeOfDefault: true, cashBuyer: true, absenteeOwner: false, vacant: false },
  foreclosure: { flag: "Y", status: "Notice of Default", filingDate: "2026-07-30T00:00:00.000Z", recordingDate: "2026-08-03T00:00:00.000Z" },
};

test("mapLookup fills the headline fields from a real response", () => {
  const p = mapLookup(raw, { street: "112 Lake Aire Dr" });
  assert.equal(p.parcel, "211-1534-07-000");
  assert.equal(p.county, "Barron");
  assert.equal(p.ownerName, "James C Jr Gregware");
  assert.equal(p.beds, 4); assert.equal(p.baths, 2); assert.equal(p.sqft, 1664); assert.equal(p.yearBuilt, 1975);
  assert.equal(p.lotSqft, 32452);
  assert.equal(p.estValue, 256603); assert.equal(p.estEquity, 252476); assert.equal(p.estEquityPct, 98.4);
  assert.equal(p.ltvPct, 1.6); assert.equal(p.mortgageBalance, 4127); assert.equal(p.lenderName, "HUD");
  assert.equal(p.assessedValue, 130700); assert.equal(p.taxAmount, 2242.08);
  assert.equal(p.lastSaleDate, "2015-05-29"); assert.equal(p.lastSalePrice, 85000); assert.equal(p.yearsOwned, 11);
  assert.equal(p.absentee, false);
  assert.deepEqual(p.distressTypes, ["pre_foreclosure"]);
  assert.ok(p.tags?.includes("high equity") && p.tags?.includes("bought with cash"));
  assert.equal(p.lat, 45.326432);
});

test("extractLiens yields the foreclosure notice and the open mortgage", () => {
  const liens = extractLiens(raw, "pid");
  assert.equal(liens.length, 2);
  assert.equal(liens[0].kind, "pre_foreclosure"); assert.match(liens[0].status!, /Notice of Default/); assert.equal(liens[0].filedDate, "2026-07-30"); assert.equal(liens[0].plaintiff, "HUD");
  assert.equal(liens[1].caseType, "Mortgage"); assert.equal(liens[1].amount, 4127); assert.equal(liens[1].confidence, "confirmed");
});
