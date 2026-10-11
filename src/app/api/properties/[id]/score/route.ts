import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { scoreProperty } from "@/lib/scoring";

/** Records-only score in Phase 1 (image scorer is a no-op until Phase 2). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepo();
  const p = await repo.getProperty(id);
  if (!p) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { imageUrl?: string; imageDate?: string };
  try {
    const outcome = await scoreProperty(p, { propertyId: id, imageUrl: body.imageUrl, imageDate: body.imageDate });
    await repo.updateProperty(id, {
      distressScore: outcome.result.distressScore,
      imageFlags: outcome.result.imageFlags,
      needsReview: outcome.result.needsReview,
    });
    return NextResponse.json({ ok: true, ...outcome });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
