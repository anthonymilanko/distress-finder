// Run: node --experimental-strip-types --test src/lib/normalize.test.ts
import { test } from "node:test";
import assert from "node:assert";
// @ts-expect-error -- .ts import extension is needed for node --test - .ts extension is required for Node's native type stripping
import { mapHeaders, normalizeRow, mergeProperty, normalizeParcel, normalizeAddressKey } from "./normalize.ts";

const META = { source: "batchleads_csv", sourceDate: "2026-10-11", importBatchId: "batch-1" };

const HEADERS = [
  "Property Address",
  "Property City",
  "Property State",
  "Property Zip",
  "County",
  "APN",
  "Owner Name",
  "Mailing Address",
  "Mailing City",
  "Mailing State",
  "Mailing Zip",
  "Bedrooms",
  "Bathrooms",
  "Square Feet",
  "Year Built",
  "Last Sale Date",
  "Last Sale Price",
  "Estimated Value",
  "Estimated Mortgage Balance",
  "Equity Percent",
  "Lead Type",
  "Email Address",
  "Random Column",
];

function rowFrom(values: Record<string, string>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const h of HEADERS) r[h] = values[h] ?? "";
  return r;
}

test("mapHeaders maps BatchLeads-style headers and reports unmapped", () => {
  const { mapping, unmapped } = mapHeaders(HEADERS);
  assert.strictEqual(mapping.address, "Property Address");
  assert.strictEqual(mapping.city, "Property City");
  assert.strictEqual(mapping.state, "Property State");
  assert.strictEqual(mapping.zip, "Property Zip");
  assert.strictEqual(mapping.parcel, "APN");
  assert.strictEqual(mapping.ownerName, "Owner Name");
  assert.strictEqual(mapping.mailingAddress, "Mailing Address");
  assert.strictEqual(mapping.mailingCity, "Mailing City");
  assert.strictEqual(mapping.mailingZip, "Mailing Zip");
  assert.strictEqual(mapping.beds, "Bedrooms");
  assert.strictEqual(mapping.sqft, "Square Feet");
  assert.strictEqual(mapping.estValue, "Estimated Value");
  assert.strictEqual(mapping.mortgageBalance, "Estimated Mortgage Balance");
  assert.strictEqual(mapping.estEquityPct, "Equity Percent");
  assert.strictEqual(mapping.distress, "Lead Type");
  assert.ok(unmapped.includes("Random Column"));
  assert.deepEqual(mapping.emails, ["Email Address"]);
  assert.ok(!unmapped.includes("APN"));
});

test("contains-matching works for non-exact headers", () => {
  const { mapping } = mapHeaders(["Prop. Address (Situs)", "Owner 1 Last Name"]);
  assert.strictEqual(mapping.ownerLast, "Owner 1 Last Name");
  assert.strictEqual(mapping.address, "Prop. Address (Situs)");
});

test("LAST, FIRST owner is split; numbers/dates/state/zip normalized", () => {
  const { mapping } = mapHeaders(HEADERS);
  const p = normalizeRow(
    rowFrom({
      "Property Address": "123 Main St.",
      "Property City": "Milwaukee",
      "Property State": "wi",
      "Property Zip": "53202-1234",
      "Owner Name": "SMITH, JOHN",
      "Last Sale Date": "2010-06-15",
      "Estimated Value": "$200,000",
      "Estimated Mortgage Balance": "$50,000",
      "Lead Type": "Pre-Foreclosure, Tax Delinquent",
    }),
    mapping,
    META,
  );
  assert.ok(p);
  assert.strictEqual(p.state, "WI");
  assert.strictEqual(p.zip, "53202");
  assert.strictEqual(p.ownerFirst, "JOHN");
  assert.strictEqual(p.ownerLast, "SMITH");
  assert.strictEqual(p.ownerIsBusiness, false);
  assert.strictEqual(p.lastSaleDate, "2010-06-15");
  assert.ok(p.yearsOwned !== undefined && p.yearsOwned >= 16);
  assert.strictEqual(p.estValue, 200000);
  assert.strictEqual(p.estEquity, 150000);
  assert.strictEqual(p.estEquityPct, 75);
  assert.deepStrictEqual(p.distressTypes.sort(), ["pre_foreclosure", "tax_delinquent"]);
  assert.strictEqual(p.leadStatus, "new");
  assert.deepStrictEqual(p.photos, []);
});

test("FIRST LAST owner is split", () => {
  const { mapping } = mapHeaders(HEADERS);
  const p = normalizeRow(rowFrom({ "Property Address": "1 A St", "Owner Name": "Jane Q Public" }), mapping, META);
  assert.ok(p);
  assert.strictEqual(p.ownerFirst, "Jane Q");
  assert.strictEqual(p.ownerLast, "Public");
});

test("business owner is detected and not split", () => {
  const { mapping } = mapHeaders(HEADERS);
  const p = normalizeRow(rowFrom({ "Property Address": "9 Biz Rd", "Owner Name": "Acme Holdings LLC" }), mapping, META);
  assert.ok(p);
  assert.strictEqual(p.ownerIsBusiness, true);
  assert.strictEqual(p.ownerFirst, undefined);
  assert.strictEqual(p.ownerLast, undefined);
});

test("absentee derived from mailing vs situs address", () => {
  const { mapping } = mapHeaders(HEADERS);
  const same = normalizeRow(
    rowFrom({ "Property Address": "123 Main St.", "Mailing Address": "123 MAIN ST" }),
    mapping,
    META,
  );
  const diff = normalizeRow(
    rowFrom({ "Property Address": "123 Main St", "Mailing Address": "PO Box 5", "Mailing State": "fl" }),
    mapping,
    META,
  );
  assert.ok(same && diff);
  assert.strictEqual(same.absentee, false);
  assert.strictEqual(diff.absentee, true);
  assert.strictEqual(diff.mailingState, "FL");
});

test("no address returns null", () => {
  const { mapping } = mapHeaders(HEADERS);
  assert.strictEqual(normalizeRow(rowFrom({ "Owner Name": "Nobody" }), mapping, META), null);
});

test("dedupeKey uses parcel when present, else address+zip", () => {
  const { mapping } = mapHeaders(HEADERS);
  const withParcel = normalizeRow(
    rowFrom({ "Property Address": "1 A St", "Property Zip": "53202", APN: "sample-0001-000" }),
    mapping,
    META,
  );
  const noParcel = normalizeRow(
    rowFrom({ "Property Address": "123  Main St.", "Property Zip": "53202" }),
    mapping,
    META,
  );
  assert.ok(withParcel && noParcel);
  assert.strictEqual(withParcel.dedupeKey, "SAMPLE0001000");
  assert.strictEqual(withParcel.dedupeKey, normalizeParcel("SAMPLE-0001-000"));
  assert.strictEqual(noParcel.dedupeKey, "123 MAIN ST|53202");
  assert.strictEqual(noParcel.dedupeKey, normalizeAddressKey("123 main st", "53202"));
});

test("mergeProperty keeps leadStatus/id/photos, fills gaps, unions distress", () => {
  const { mapping } = mapHeaders(HEADERS);
  const a = normalizeRow(
    rowFrom({ "Property Address": "123 Main St", "Property Zip": "53202", "Lead Type": "Vacant" }),
    mapping,
    META,
  );
  const b = normalizeRow(
    rowFrom({
      "Property Address": "123 Main St",
      "Property Zip": "53202",
      "Lead Type": "Probate",
      "Estimated Value": "100000",
    }),
    mapping,
    { ...META, sourceDate: "2026-11-01" },
  );
  assert.ok(a && b);
  a.leadStatus = "watch";
  a.distressScore = 55;
  const m = mergeProperty(a, b);
  assert.strictEqual(m.id, a.id);
  assert.strictEqual(m.leadStatus, "watch");
  assert.strictEqual(m.distressScore, 55);
  assert.strictEqual(m.estValue, 100000);
  assert.deepStrictEqual([...m.distressTypes].sort(), ["probate", "vacant"]);
  assert.strictEqual(m.sourceDate, "2026-11-01");
  assert.strictEqual(m.updatedAt, b.updatedAt);
});
