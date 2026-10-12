import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { CENSUS_BATCH_LIMIT, geocodeBatch } from "@/lib/geocode";
import type { Property } from "@/lib/types";

/**
 * POST /api/geocode { limit? }  → geocodes up to `limit` rows that have no
 * coordinates (default 2,000 per call; the UI keeps calling until `remaining`
 * is 0). Uses the free Census batch geocoder. Rows the Census can't match are
 * marked no_match so they aren't retried forever (BatchData lookup can fill
 * them later).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.min(Math.max(1, body.limit ?? 2000), CENSUS_BATCH_LIMIT);
  const repo = getRepo();
  const rows = await repo.listUngeocoded(limit);
  if (!rows.length) return NextResponse.json({ ok: true, processed: 0, matched: 0, noMatch: 0, remaining: 0 });

  // Rows with no usable address components go straight to no_match.
  const usable = rows.filter((r) => r.address && (r.zip || (r.city && r.state)));
  const unusable = rows.filter((r) => !usable.includes(r));

  let hits: Awaited<ReturnType<typeof geocodeBatch>> = [];
  try {
    hits = await geocodeBatch(usable);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Geocoder unavailable: ${(e as Error).message}` }, { status: 502 });
  }

  const patches: Array<{ id: string; patch: Partial<Property> }> = [];
  let matched = 0, noMatch = 0;
  for (const h of hits) {
    if (h.matched && h.lat != null && h.lng != null) {
      patches.push({ id: h.id, patch: { lat: h.lat, lng: h.lng, geocodeStatus: "matched" } });
      matched++;
    } else {
      patches.push({ id: h.id, patch: { geocodeStatus: "no_match" } });
      noMatch++;
    }
  }
  // Rows the Census didn't echo back at all, plus unusable ones.
  const echoed = new Set(hits.map((h) => h.id));
  for (const r of usable) if (!echoed.has(r.id)) { patches.push({ id: r.id, patch: { geocodeStatus: "no_match" } }); noMatch++; }
  for (const r of unusable) { patches.push({ id: r.id, patch: { geocodeStatus: "no_match" } }); noMatch++; }

  await repo.updateMany(patches);
  const remaining = await repo.countUngeocoded();
  return NextResponse.json({ ok: true, processed: rows.length, matched, noMatch, remaining });
}

export async function GET() {
  return NextResponse.json({ ok: true, remaining: await getRepo().countUngeocoded() });
}
