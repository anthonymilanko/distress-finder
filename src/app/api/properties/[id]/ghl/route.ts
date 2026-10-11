import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { sendToGhl } from "@/lib/ghl";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepo();
  const p = await repo.getProperty(id);
  if (!p) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (p.isSample) return NextResponse.json({ ok: false, error: "Sample rows can't be sent to GHL." }, { status: 400 });
  const result = await sendToGhl(p);
  if (result.ok && p.leadStatus === "new") await repo.updateProperty(id, { leadStatus: "lead" });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
