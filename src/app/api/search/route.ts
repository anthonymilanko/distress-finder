import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { autocomplete, batchDataLive, lookupByAddress, parseAddress } from "@/lib/batchdata";
import { mergeProperty } from "@/lib/normalize";
import { saveLookupLiens } from "@/lib/lookup-liens";

/** GET /api/search?q=... → address suggestions (BatchData autocomplete or mock). */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const suggestions = await autocomplete(q);
    return NextResponse.json({ ok: true, live: batchDataLive(), suggestions });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}

/** POST /api/search { address } → live property lookup, saved to the DB (cached per address). */
export async function POST(request: Request) {
  const { address, street, city, state, zip } = (await request.json()) as { address?: string; street?: string; city?: string; state?: string; zip?: string };
  const addr = street ? { street, city, state, zip } : address ? parseAddress(address) : null;
  if (!addr?.street) return NextResponse.json({ ok: false, error: "Enter an address." }, { status: 400 });
  try {
    const { property, liens, cached, live, costUsd } = await lookupByAddress(addr);
    const repo = getRepo();
    const existing = await repo.findByDedupeKey(property.dedupeKey);
    const saved = existing ? await repo.upsertProperty(mergeProperty(existing, property)) : await repo.upsertProperty(property);
    await saveLookupLiens(saved.id, liens);
    return NextResponse.json({ ok: true, property: saved, cached, live, costUsd });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
