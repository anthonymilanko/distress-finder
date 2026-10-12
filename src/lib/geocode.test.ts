import { test } from "node:test";
import assert from "node:assert";
// @ts-expect-error -- .ts import extension is needed for node --test
import { buildBatchCsv, parseBatchResponse } from "./geocode.ts";

test("buildBatchCsv quotes fields and omits header", () => {
  const csv = buildBatchCsv([{ id: "a1", address: '12 "Oak" St, Unit 2', city: "Racine", state: "WI", zip: "53403" }]);
  assert.equal(csv, '"a1","12 ""Oak"" St, Unit 2","Racine","WI","53403"');
});

test("parseBatchResponse reads matches and no-matches", () => {
  const body = [
    '"a1","2513 Coolidge Ave, Racine, WI, 53403","Match","Exact","2513 COOLIDGE AVE, RACINE, WI, 53403","-87.806123,42.713456","12345","L"',
    '"b2","1 Nowhere Rd, Racine, WI, 53403","No_Match"',
    '"c3","5 Tie St, Racine, WI, 53403","Tie"',
    "",
  ].join("\n");
  const hits = parseBatchResponse(body);
  assert.equal(hits.length, 3);
  assert.deepEqual(hits[0], { id: "a1", matched: true, lat: 42.713456, lng: -87.806123, matchedAddress: "2513 COOLIDGE AVE, RACINE, WI, 53403" });
  assert.equal(hits[1].matched, false);
  assert.equal(hits[2].matched, false);
});
