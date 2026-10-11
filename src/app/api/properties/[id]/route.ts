import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import type { LeadStatus, Property } from "@/lib/types";

const LEAD_STATUSES: LeadStatus[] = ["new", "lead", "skip", "watch"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepo();
  const property = await repo.getProperty(id);
  if (!property) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const [liens, notes] = await Promise.all([repo.listLiens(id), repo.listNotes(id)]);
  return NextResponse.json({ ok: true, property, liens, notes });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as Partial<Property>;
  const patch: Partial<Property> = {};
  if (body.leadStatus !== undefined) {
    if (!LEAD_STATUSES.includes(body.leadStatus)) return NextResponse.json({ ok: false, error: "Bad leadStatus" }, { status: 400 });
    patch.leadStatus = body.leadStatus;
  }
  const updated = await getRepo().updateProperty(id, patch);
  if (!updated) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, property: updated });
}
