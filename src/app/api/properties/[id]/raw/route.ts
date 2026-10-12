import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";

/** The untouched BatchData response for a looked-up property (for checking what the API actually returned). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = await getRepo().getLookup<unknown>(`bd:raw:${id}`);
  if (!raw) return NextResponse.json({ ok: false, error: "No raw lookup data saved for this property (only address-search results keep it)." }, { status: 404 });
  return NextResponse.json(raw, { headers: { "Cache-Control": "no-store" } });
}
