import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { casesToLiens, parseCourtPage } from "@/lib/parse-court-page";

/**
 * Called by the TJ Record Reader extension with the visible text of ONE
 * results page the user is looking at. Parses it, saves rows under the
 * property as "possible match", returns the count. Protected by a shared
 * token (DF_EXTENSION_TOKEN) because the route is reachable from any tab.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: Request) {
  const expected = process.env.DF_EXTENSION_TOKEN;
  if (expected && req.headers.get("x-df-token") !== expected) {
    return NextResponse.json({ ok: false, error: "Bad token (set it in the extension options to match DF_EXTENSION_TOKEN)." }, { status: 401 });
  }
  const body = (await req.json()) as {
    propertyId?: string; sourceUrl?: string; pageTitle?: string; pageText?: string; state?: string; county?: string | null; capturedAt?: string;
  };
  if (!body.propertyId || !body.pageText) return NextResponse.json({ ok: false, error: "propertyId and pageText required" }, { status: 400 });
  const repo = getRepo();
  const p = await repo.getProperty(body.propertyId);
  if (!p) return NextResponse.json({ ok: false, error: "Property not found" }, { status: 404 });

  const state = (body.state ?? p.state ?? "").toUpperCase();
  try {
    const { cases, model } = await parseCourtPage(body.pageText, { state, county: body.county ?? p.county });
    const liens = casesToLiens(cases, p.id, { source: body.sourceUrl ?? "extension", state, county: body.county ?? p.county, rawText: body.pageText });
    // Skip case numbers already on file for this property.
    const existing = new Set((await repo.listLiens(p.id)).map((l) => l.caseNumber));
    const fresh = liens.filter((l) => !existing.has(l.caseNumber));
    await repo.addLiens(fresh);
    // Only OPEN cases change the distress profile; closed usually means paid/dismissed.
    const kinds = new Set(p.distressTypes);
    for (const l of fresh) if (l.kind !== "other" && /open|pending|active/i.test(l.status ?? "")) kinds.add(l.kind);
    await repo.updateProperty(p.id, { distressTypes: [...kinds] });
    return NextResponse.json({ ok: true, liensSaved: fresh.length, skippedDuplicates: liens.length - fresh.length, model, liens: fresh });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
