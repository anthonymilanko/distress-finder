import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { batchDataLive, lookupByAddress } from "@/lib/batchdata";
import { mergeProperty } from "@/lib/normalize";
import { saveLookupLiens } from "@/lib/lookup-liens";

/**
 * POST /api/properties/[id]/refresh — re-pull this property from BatchData (bypasses the cache; costs one lookup).
 * Fresh data fields overwrite stale ones; app state (status, score, notes, photos) is kept.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepo();
  const existing = await repo.getProperty(id);
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (!batchDataLive()) return NextResponse.json({ ok: false, error: "BatchData key not set — add BATCHDATA_API_KEY in Vercel." }, { status: 400 });
  try {
    const { property: fresh, liens, costUsd } = await lookupByAddress(
      { street: existing.address, city: existing.city, state: existing.state, zip: existing.zip },
      { force: true, propertyId: id },
    );
    // Fresh wins for data; existing fills gaps and keeps identity/app state.
    const merged = mergeProperty(fresh, existing);
    merged.id = existing.id;
    merged.leadStatus = existing.leadStatus;
    merged.distressScore = existing.distressScore;
    merged.imageFlags = existing.imageFlags;
    merged.needsReview = existing.needsReview;
    merged.createdAt = existing.createdAt;
    merged.importBatchId = existing.importBatchId;
    merged.isSample = false;
    merged.source = fresh.source;
    merged.sourceDate = fresh.sourceDate;
    merged.updatedAt = new Date().toISOString();
    if (existing.photos.length && !fresh.photos.length) merged.photos = existing.photos;
    const saved = await repo.upsertProperty(merged);
    await saveLookupLiens(saved.id, liens);
    return NextResponse.json({ ok: true, property: saved, costUsd });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
