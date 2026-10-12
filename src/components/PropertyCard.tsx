"use client";
import { useState } from "react";
import type { CourtLink } from "@/lib/court-links";
import type { LeadStatus, Lien, Note, Property } from "@/lib/types";
import { DISTRESS_LABEL, LEAD_LABEL, caseTypeLabel, money, num, pct } from "@/lib/format";
import { ScoreBadge } from "./PropertyRow";
import SendToGhlDialog from "./SendToGhlDialog";

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
    if (d.ok) { setNotes([d.note, ...notes]); setNote(""); }
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
    <div className="px-4 py-4 md:px-8 md:py-6 grid gap-4 max-w-6xl mx-auto md:grid-cols-2 [&>section]:self-start">
      {p.isSample && <div className="md:col-span-2 rounded-lg bg-warm/10 border border-warm text-sm px-3 py-2">Sample / mock data — not a real lead.</div>}

      <section className="card">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold leading-tight">{p.address}</h1>
            <div className="text-muted text-sm">{p.city}, {p.state} {p.zip}{p.county ? ` · ${p.county} County` : ""}</div>
            <div className="text-muted text-xs mt-1">Parcel {p.parcel ?? "—"}</div>
          </div>
          <ScoreBadge score={p.distressScore} />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3 text-sm">
          <div><div className="label">Beds</div>{num(p.beds)}</div>
          <div><div className="label">Baths</div>{num(p.baths)}</div>
          <div><div className="label">Sq ft</div>{num(p.sqft)}</div>
          <div><div className="label">Built</div>{p.yearBuilt ?? "—"}</div>
          <div><div className="label">Lot</div>{p.lotSqft ? `${num(p.lotSqft)} sf` : "—"}</div>
          <div className="col-span-3"><div className="label">Type</div>{p.propertyType ?? "—"}</div>
        </div>
        <div className="flex flex-wrap gap-1 mt-3">
          {p.distressTypes.map((t) => <span key={t} className="chip bg-bg border border-line">{DISTRESS_LABEL[t]}</span>)}
          {p.absentee && <span className="chip bg-bg border border-line">Absentee owner</span>}
        </div>
      </section>

      <section className="card">
        <div className="label mb-2">Street View (Google, view only)</div>
        {svEmbed ? (
          <iframe title="Street View" src={svEmbed} className="w-full aspect-[4/3] rounded-lg border-0" loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
        ) : (
          <div className="rounded-lg bg-bg border border-dashed border-line p-4 text-sm text-muted">
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
        <div className="label mb-2">Owner & equity</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><div className="label">Owner</div>{p.ownerName ?? "—"}{p.ownerIsBusiness ? " (business)" : ""}</div>
          <div><div className="label">Mailing</div>{p.mailingAddress ? `${p.mailingAddress}, ${p.mailingCity ?? ""} ${p.mailingState ?? ""}` : "—"}</div>
          <div><div className="label">Last sale</div>{p.lastSaleDate ?? "—"} {p.lastSalePrice ? `· ${money(p.lastSalePrice)}` : ""}</div>
          <div><div className="label">Owned</div>{p.yearsOwned != null ? `${p.yearsOwned} yrs` : "—"}</div>
          <div><div className="label">Est. value</div>{money(p.estValue)}</div>
          <div><div className="label">Mortgage bal.</div>{money(p.mortgageBalance)}</div>
          <div><div className="label">Est. equity</div>{money(p.estEquity)} <span className="text-muted">({pct(p.estEquityPct)}{p.ltvPct != null ? `, LTV ${Math.round(p.ltvPct)}%` : ""})</span>{p.ltvPct === 0 && p.estEquityPct == null ? <div className="text-xs text-warm">LTV reported as 0 but a mortgage is implied (foreclosure list) — equity unknown until lien check.</div> : null}</div>
          <div><div className="label">Source</div>{p.source} · {p.sourceDate}</div>
        </div>
        <div className="text-xs text-muted mt-2">Values are estimates until confirmed with title / Register of Deeds.</div>
        {(p.phones?.length || p.emails?.length) ? (
          <div className="mt-3 border-t border-line pt-3">
            <div className="label mb-1">Contact (from skip trace)</div>
            <div className="flex flex-wrap gap-2 text-sm">
              {p.phones?.map((ph) => <a key={ph} className="btn" href={`tel:${ph}`}>{ph.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}</a>)}
              {p.emails?.map((em) => <a key={em} className="btn" href={`mailto:${em}`}>{em}</a>)}
            </div>
            <div className="text-xs text-muted mt-2">Scrub against the National DNC list and your internal DNC before calling or texting (TCPA).</div>
          </div>
        ) : null}
        {p.tags?.length ? (
          <div className="flex flex-wrap gap-1 mt-3">
            {p.tags.map((t) => <span key={t} className="chip bg-dark/5 border border-line">{t}</span>)}
          </div>
        ) : null}
      </section>

      <section className="card">
        <div className="label mb-2">Court & lien records</div>
        {liens.length > 0 && <div className="text-xs text-muted mb-2">Open = still owed / live. Closed usually means paid or dismissed; it&apos;s history, not a current signal.</div>}
        {liens.length === 0 ? <div className="text-sm text-muted">None saved yet. Run a check below, then use the extension&apos;s “Save to property”.</div> : (
          <table className="w-full text-sm [&_td]:py-1 [&_td]:pr-2 [&_th]:pr-2 [&_th]:font-medium">
            <thead><tr className="text-left text-muted"><th>Case</th><th>Type</th><th>Status</th><th>Filed</th><th>Match</th></tr></thead>
            <tbody>
              {liens.map((l) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="whitespace-nowrap">{l.caseNumber ?? "—"}</td>
                  <td>{caseTypeLabel(l.caseType, l.kind)}{l.caseType ? <span className="text-muted text-xs"> ({l.caseType})</span> : null}{l.plaintiff ? <div className="text-xs text-muted">{l.plaintiff}</div> : null}</td>
                  <td>{/open|pending|active/i.test(l.status ?? "") ? <span className="chip bg-hot text-white">{l.status}</span> : <span className="text-muted">{l.status ?? "—"}</span>}</td>
                  <td className="whitespace-nowrap">{l.filedDate ?? "—"}{l.amount ? <div className="text-xs text-muted">{money(l.amount)}</div> : null}</td>
                  <td><span className={`chip ${l.confidence === "confirmed" ? "bg-cool text-white" : "bg-warm/15 border border-warm"}`}>{l.confidence.replace("_", " ")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex flex-col gap-2 mt-3">
          {courtLinks.map((l) => (
            <div key={l.url}>
              <a className="btn btn-dark w-full" href={l.url} target="_blank" rel="noreferrer">{l.label}</a>
              {l.note && <div className="text-xs text-muted mt-1">{l.note}</div>}
            </div>
          ))}
          {courtLinks.length === 0 && <div className="text-sm text-muted">No court links for state “{p.state || "?"}” yet.</div>}
        </div>
        {foreclosureCase && (
          <div className="mt-3 text-xs rounded-lg bg-warm/10 border border-warm px-3 py-2">
            Owner may be in foreclosure: Wisconsin foreclosure-consultant / equity-purchaser rules (and FL/TX equivalents) apply to how you contact and contract. Confirm with your attorney before offering.
          </div>
        )}
      </section>

      <section className="card">
        <div className="label mb-2">Lead status</div>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(LEAD_LABEL) as LeadStatus[]).map((s) => (
            <button key={s} type="button" className={`btn ${p.leadStatus === s ? "btn-brand" : ""}`} onClick={() => setStatus(s)}>{LEAD_LABEL[s]}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button type="button" className="btn btn-dark" disabled={busy || p.isSample} onClick={() => setGhlOpen(true)}>Send to GoHighLevel</button>
          <button type="button" className="btn" disabled={busy} onClick={rescore}>Re-score (records)</button>
        </div>
        {msg && <div className="text-sm mt-2">{msg}</div>}
        {ghlOpen && <SendToGhlDialog address={`${p.address}, ${p.city}`} onCancel={() => setGhlOpen(false)} onSend={sendGhl} />}
      </section>

      <section className="card">
        <div className="label mb-2">Notes</div>
        <div className="flex gap-2">
          <input className="input" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} />
          <button type="button" className="btn btn-brand" onClick={addNote}>Add</button>
        </div>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {notes.map((n) => <li key={n.id} className="border-t border-line pt-2"><div className="text-xs text-muted">{new Date(n.createdAt).toLocaleString()}</div>{n.body}</li>)}
        </ul>
      </section>
    </div>
  );
}
