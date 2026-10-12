import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import type { Lien, Note, Property } from "@/lib/types";

/** GET → download everything as JSON. POST multipart { file } → restore/merge it. */
export async function GET() {
  const data = await getRepo().exportAll();
  return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), ...data }), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="distress-finder-backup-${new Date().toISOString().slice(0, 10)}.json"` },
  });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "Attach a backup .json as `file`." }, { status: 400 });
  let parsed: { properties?: Property[]; liens?: Lien[]; notes?: Note[] };
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return NextResponse.json({ ok: false, error: "That file isn't valid JSON." }, { status: 400 });
  }
  const repo = getRepo();
  const properties = (parsed.properties ?? []).filter((p) => p && p.dedupeKey && p.address);
  const n = await repo.upsertMany(properties);
  // Re-key liens/notes to the stored property ids (ids may differ after upsert by dedupe key).
  const idByKey = new Map<string, string>();
  for (const p of properties) { const stored = await repo.findByDedupeKey(p.dedupeKey); if (stored) idByKey.set(p.id, stored.id); }
  const liens = (parsed.liens ?? []).map((l) => ({ ...l, propertyId: idByKey.get(l.propertyId) ?? l.propertyId }));
  const notes = (parsed.notes ?? []).map((x) => ({ ...x, propertyId: idByKey.get(x.propertyId) ?? x.propertyId }));
  let liensAdded = 0, notesAdded = 0;
  for (const pid of new Set(liens.map((l) => l.propertyId))) {
    const existing = new Set((await repo.listLiens(pid)).map((l) => l.caseNumber));
    const fresh = liens.filter((l) => l.propertyId === pid && !existing.has(l.caseNumber));
    await repo.addLiens(fresh); liensAdded += fresh.length;
  }
  for (const pid of new Set(notes.map((x) => x.propertyId))) {
    const existing = new Set((await repo.listNotes(pid)).map((x) => x.body + x.createdAt));
    for (const x of notes.filter((x) => x.propertyId === pid && !existing.has(x.body + x.createdAt))) { await repo.addNote(x); notesAdded++; }
  }
  return NextResponse.json({ ok: true, properties: n, liens: liensAdded, notes: notesAdded });
}
