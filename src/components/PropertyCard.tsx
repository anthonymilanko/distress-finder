"use client";
import { useState } from "react";
import Link from "next/link";
import type { CourtLink } from "@/lib/court-links";
import type { LeadStatus, Lien, Note, Property } from "@/lib/types";
import { DISTRESS_LABEL, LEAD_LABEL, caseTypeLabel, money, num, pct } from "@/lib/format";
import ScoreRing from "./ScoreRing";
import SendToGhlDialog from "./SendToGhlDialog";

const Fact = ({ k, v, children }: { k: string; v?: React.ReactNode; children?: React.ReactNode }) => (
  <div className="min-w-0">
    <div className="label">{k}</div>
    <div className="text-[15px] font-semibold leading-snug break-words">{v ?? children ?? "—"}</div>
  </div>
);

export default function PropertyCard({
  property: initial, liens, notes: initialNotes, courtLinks, listingLinks, streetViewKey,
}: {
  property: Property; liens: Lien[]; notes: Note[]; courtLinks: CourtLink[]; listingLinks: CourtLink[]; streetViewKey: string;
}) {
  const [p, setP] = useState(initial);
  const [notes, setNotes] = useState(initialNotes);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ghlOpen, setGhlOpen] = useState(false);

  async function setStatus(leadStatus: LeadStatus) {
    const r = await fetch(`/api/properties/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadStatus }) });
    const d = await r.json();
    if (d.ok) setP(d.property);
  }
  async function addNote() {
    if (!note.trim()) return;
    const r = await fetch(`/api/properties/${p.id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: note }) });
    const d = await r.json();
    if (d.ok) { setNotes([d.note, ...notes]); setNote(""); if (d.syncedToGhl) setMsg("Note added here and on the GHL contact."); }
  }
  async function sendGhl(choice: { pipelineId?: string; stageId?: string; remember?: boolean }) {
    setGhlOpen(false);
    setBusy(true);
    const r = await fetch(`/api/properties/${p.id}/ghl`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(choice) });
    const d = await r.json();
    setBusy(false);
    setMsg(d.ok ? (d.stubbed ? "GHL not connected yet — logged locally (add GHL_API_KEY to go live)." : d.warning ?? (d.opportunityId ? "Sent to GoHighLevel: contact + pipeline opportunity." : "Sent to GoHighLevel.")) : `GHL error: ${d.error}`);
    if (d.ok && p.leadStatus === "new") setP({ ...p, leadStatus: "lead" });
  }
  async function rescore() {
    setBusy(true);
    const r = await fetch(`/api/properties/${p.id}/score`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await r.json();
    setBusy(false);
    if (d.ok) { setP({ ...p, distressScore: d.result.distressScore }); setMsg(`Records score ${d.result.recordsPoints}/50 (image scoring arrives in Phase 2). AI spend today: $${d.spend.costUsd} of $${d.spend.capUsd}.`); }
    else setMsg(d.error);
  }

  const hasLoc = p.lat != null && p.lng != null;
  const svEmbed = hasLoc && streetViewKey ? `https://www.google.com/maps/embed/v1/streetview?key=${streetViewKey}&location=${p.lat},${p.lng}&heading=0&pitch=0&fov=90` : null;
  const svLink = hasLoc ? `https://www.google.com/maps?q=&layer=c&cbll=${p.lat},${p.lng}` : null;
  const foreclosureCase = p.distressTypes.includes("pre_foreclosure") || p.distressTypes.includes("foreclosure");

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 md:px-8 md:py-6">
      {p.isSample && <div className="mb-3 rounded-md bg-warm/10 border border-warm/60 text-sm px-3 py-2">Sample / mock data — not a real lead.</div>}

      {/* Header band */}
      <header className="flex flex-col gap-4 pb-5 mb-5 border-b border-line md:flex-row md:items-start">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          <ScoreRing score={p.distressScore} size={72} stroke={6} animate label="score" />
          <div className="min-w-0">
            <Link href="/" className="text-[13px] text-muted hover:text-ink">← Map</Link>
            <h1 className="text-2xl md:text-[28px] font-extrabold leading-tight tracking-tight mt-0.5">{p.address}</h1>
            <div className="text-muted mt-0.5">{p.city}, {p.state} {p.zip}{p.county ? ` · ${p.county} County` : ""}{p.parcel ? <> · <span className="font-mono text-[13px]">Parcel {p.parcel}</span></> : null}</div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {p.distressTypes.map((t) => <span key={t} className="chip bg-brand/10 text-brand">{DISTRESS_LABEL[t]}</span>)}
              {p.absentee && <span className="chip bg-bg border border-line text-ink/80">Absentee owner</span>}
              {p.ownerIsBusiness && <span className="chip bg-bg border border-line text-ink/80">Business owner</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 md:items-end shrink-0">
          <div className="inline-flex rounded-full border border-line bg-surface p-0.5">
            {(Object.keys(LEAD_LABEL) as LeadStatus[]).map((s) => (
              <button key={s} type="button" className={`rounded-full px-3 py-1 text-[13px] font-semibold transition-colors ${p.leadStatus === s ? "bg-ink text-white" : "text-muted hover:text-ink"}`} onClick={() => setStatus(s)}>{LEAD_LABEL[s]}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-brand" disabled={busy || p.isSample} onClick={() => setGhlOpen(true)}>Send to GoHighLevel</button>
            <button type="button" className="btn" disabled={busy} onClick={rescore}>Re-score</button>
          </div>
          {msg && <div className="text-[13px] text-muted md:text-right max-w-sm">{msg}</div>}
        </div>
      </header>
      {ghlOpen && <SendToGhlDialog address={`${p.address}, ${p.city}`} onCancel={() => setGhlOpen(false)} onSend={sendGhl} />}

      {/* Headline facts */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-3 mb-5">
        <Fact k="Est. value" v={money(p.estValue)} />
        <Fact k="Est. equity" v={p.estEquityPct != null ? `${money(p.estEquity)} · ${pct(p.estEquityPct)}` : money(p.estEquity)} />
        <Fact k="Owned" v={p.yearsOwned != null ? `${p.yearsOwned} yrs` : undefined} />
        <Fact k="Beds / baths" v={p.beds != null || p.baths != null ? `${num(p.beds)} / ${num(p.baths)}` : undefined} />
        <Fact k="Sq ft" v={p.sqft != null ? num(p.sqft) : undefined} />
        <Fact k="Built" v={p.yearBuilt ?? undefined} />
      </div>
      {p.ltvPct === 0 && p.estEquityPct == null && (
        <div className="mb-5 text-[13px] rounded-md bg-warm/10 border border-warm/60 px-3 py-2">LTV reported as 0 but a mortgage is implied (foreclosure list) — equity unknown until a lien check.</div>
      )}

      <div className="grid gap-4 md:grid-cols-2 [&>section]:self-start">
        <section className="card">
          <div className="font-bold mb-2">Street View <span className="label font-normal">Google · view only</span></div>
          {svEmbed ? (
            <iframe title="Street View" src={svEmbed} className="w-full aspect-[4/3] rounded-md border-0" loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
          ) : (
            <div className="rounded-md bg-bg border border-dashed border-line p-4 text-sm text-muted">
              {hasLoc ? "Add NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY to show Street View here." : "No coordinates for this property yet."}
              {svLink && <div className="mt-2"><a className="btn" href={svLink} target="_blank" rel="noreferrer">Open Street View in Google Maps</a></div>}
            </div>
          )}
          {p.photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {p.photos.slice(0, 9).map((ph) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={ph.url} src={ph.url} alt={ph.caption ?? "Property photo"} className="aspect-square object-cover rounded-md" />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {listingLinks.map((l) => <a key={l.url} className="btn" href={l.url} target="_blank" rel="noreferrer">{l.label}</a>)}
          </div>
        </section>

        <section className="card">
          <div className="font-bold mb-3">Owner & equity</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Fact k="Owner" v={p.ownerName ? `${p.ownerName}${p.ownerIsBusiness ? " (business)" : ""}` : undefined} />
            <Fact k="Mailing" v={p.mailingAddress ? `${p.mailingAddress}, ${p.mailingCity ?? ""} ${p.mailingState ?? ""}` : undefined} />
            <Fact k="Last sale" v={p.lastSaleDate ? `${p.lastSaleDate}${p.lastSalePrice ? ` · ${money(p.lastSalePrice)}` : ""}` : undefined} />
            <Fact k="Mortgage balance" v={money(p.mortgageBalance)} />
            <Fact k="LTV" v={p.ltvPct != null ? `${Math.round(p.ltvPct)}%` : undefined} />
            <Fact k="Lot" v={p.lotSqft ? `${num(p.lotSqft)} sf` : undefined} />
            <Fact k="Type" v={p.propertyType ?? undefined} />
            <Fact k="Source" v={`${p.source} · ${p.sourceDate}`} />
          </div>
          {p.source === "batchdata_lookup" && <a className="text-xs text-muted hover:text-ink underline mt-2 inline-block" href={`/api/properties/${p.id}/raw`} target="_blank" rel="noreferrer">View raw BatchData response</a>}
          <div className="text-xs text-muted mt-3">Values are estimates until confirmed with title / Register of Deeds.</div>
          {(p.phones?.length || p.emails?.length) ? (
            <div className="mt-3 border-t border-line pt-3">
              <div className="label mb-1.5">Contact (from skip trace)</div>
              <div className="flex flex-wrap gap-2 text-sm">
                {p.phones?.map((ph) => <a key={ph} className="btn" href={`tel:${ph}`}>{ph.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}</a>)}
                {p.emails?.map((em) => <a key={em} className="btn" href={`mailto:${em}`}>{em}</a>)}
              </div>
              <div className="text-xs text-muted mt-2">Scrub against the National DNC list and your internal DNC before calling or texting (TCPA).</div>
            </div>
          ) : null}
          {p.tags?.length ? (
            <div className="flex flex-wrap gap-1 mt-3">
              {p.tags.map((t) => <span key={t} className="chip bg-bg border border-line text-ink/80">{t}</span>)}
            </div>
          ) : null}
        </section>

        <section className="card md:col-span-2">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <div className="font-bold">Court & lien records</div>
            {liens.length > 0 && <div className="text-xs text-muted">Open = still owed. Closed usually means paid or dismissed.</div>}
          </div>
          {liens.length === 0 ? <div className="text-sm text-muted">None saved yet. Run a check below, then use the extension&apos;s “Save to property”.</div> : (
            <table className="w-full text-sm [&_td]:py-1.5 [&_td]:pr-3 [&_th]:pr-3 [&_th]:pb-1 [&_th]:font-medium">
              <thead><tr className="text-left text-muted"><th>Case</th><th>Type</th><th>Status</th><th>Filed</th><th>Match</th></tr></thead>
              <tbody>
                {liens.map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <td className="whitespace-nowrap font-mono text-[13px]">{l.caseNumber ?? "—"}</td>
                    <td>{caseTypeLabel(l.caseType, l.kind)}{l.caseType ? <span className="text-muted text-xs"> ({l.caseType})</span> : null}{l.plaintiff ? <div className="text-xs text-muted">{l.plaintiff}</div> : null}</td>
                    <td>{/open|pending|active/i.test(l.status ?? "") ? <span className="chip bg-hot text-white">{l.status}</span> : <span className="text-muted">{l.status ?? "—"}</span>}</td>
                    <td className="whitespace-nowrap">{l.filedDate ?? "—"}{l.amount ? <div className="text-xs text-muted">{money(l.amount)}</div> : null}</td>
                    <td><span className={`chip ${l.confidence === "confirmed" ? "bg-cool text-white" : "bg-warm/15 border border-warm/60"}`}>{l.confidence.replace("_", " ")}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {courtLinks.map((l) => (
              <div key={l.url} className="min-w-0">
                <a className="btn btn-dark" href={l.url} target="_blank" rel="noreferrer">{l.label}</a>
                {l.note && <div className="text-xs text-muted mt-1 max-w-xs">{l.note}</div>}
              </div>
            ))}
            {courtLinks.length === 0 && <div className="text-sm text-muted">No court links for state “{p.state || "?"}” yet.</div>}
          </div>
          {foreclosureCase && (
            <div className="mt-3 text-xs rounded-md bg-warm/10 border border-warm/60 px-3 py-2">
              Owner may be in foreclosure: Wisconsin foreclosure-consultant / equity-purchaser rules (and FL/TX equivalents) apply to how you contact and contract. Confirm with your attorney before offering.
            </div>
          )}
        </section>

        <section className="card md:col-span-2">
          <div className="font-bold mb-2">Notes <span className="label font-normal">synced to the GHL contact when connected</span></div>
          <div className="flex gap-2">
            <input className="input" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} />
            <button type="button" className="btn btn-brand" onClick={addNote}>Add</button>
          </div>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {notes.map((n) => <li key={n.id} className="border-t border-line pt-2"><div className="text-xs text-muted">{new Date(n.createdAt).toLocaleString()}</div>{n.body}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
