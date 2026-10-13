import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeRing, encodeRing, pointInPolygon, type LngLat } from "./geo.ts";

// Rough box around downtown Milwaukee
const box: LngLat[] = [[-87.95, 43.02], [-87.88, 43.02], [-87.88, 43.06], [-87.95, 43.06]];

test("pointInPolygon inside / outside", () => {
  assert.equal(pointInPolygon(-87.91, 43.04, box), true);
  assert.equal(pointInPolygon(-87.80, 43.04, box), false);
  assert.equal(pointInPolygon(-87.91, 43.10, box), false);
});

test("concave shape excludes the notch", () => {
  const u: LngLat[] = [[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3]];
  assert.equal(pointInPolygon(1.5, 2, u), false);
  assert.equal(pointInPolygon(0.5, 2, u), true);
});

test("encode/decode round trip and rejects junk", () => {
  assert.deepEqual(decodeRing(encodeRing(box)), box);
  assert.equal(decodeRing("1,2;3,4"), undefined);
  assert.equal(decodeRing(""), undefined);
});
