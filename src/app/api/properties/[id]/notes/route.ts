import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { addGhlNote, getGhlContactId } from "@/lib/ghl";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { body } = (await req.json()) as { body?: string };
  if (!body?.trim()) return NextResponse.json({ ok: false, error: "Empty note" }, { status: 400 });
  const repo = getRepo();
  if (!(await repo.getProperty(id))) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const note = await repo.addNote({ id: crypto.randomUUID(), propertyId: id, body: body.trim(), createdAt: new Date().toISOString() });
  // If this lead is already in GHL, mirror the note there.
  let syncedToGhl = false;
  const contactId = await getGhlContactId(id);
  if (contactId) syncedToGhl = await addGhlNote(contactId, note.body).catch(() => false);
  return NextResponse.json({ ok: true, note, syncedToGhl });
}
