import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { decodeRing } from "@/lib/geo";
import type { DistressType, LeadStatus, PropertyFilters } from "@/lib/types";

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const n = (k: string) => (sp.get(k) ? Number(sp.get(k)) : undefined);
  const filters: PropertyFilters = {
    q: sp.get("q") ?? undefined,
    state: sp.get("state") ?? undefined,
    county: sp.get("county") ?? undefined,
    minEquityPct: n("minEquityPct"),
    minYearsOwned: n("minYearsOwned"),
    absentee: sp.get("absentee") === "1",
    distressType: (sp.get("distressType") as DistressType) || undefined,
    leadStatus: (sp.get("leadStatus") as LeadStatus) || undefined,
    minScore: n("minScore"),
    polygon: decodeRing(sp.get("polygon")),
    limit: n("limit"),
  };
  const repo = getRepo();
  const [rows, total] = await Promise.all([repo.listProperties(filters), repo.countProperties(filters)]);
  return NextResponse.json({ ok: true, count: rows.length, total, properties: rows });
}
