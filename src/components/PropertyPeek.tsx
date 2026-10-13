import Link from "next/link";
import type { Property } from "@/lib/types";
import { DISTRESS_LABEL, LEAD_LABEL, money, pct } from "@/lib/format";
import ScoreRing from "./ScoreRing";

const F = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div><div className="label">{k}</div><div className="font-semibold text-[14px] leading-snug">{v ?? "—"}</div></div>
);

/** Small floating card shown over the map when a pin (or row) is selected. */
export default function PropertyPeek({ p, onClose }: { p: Property; onClose: () => void }) {
  return (
    <div className="card w-full md:w-[22rem] p-3.5 shadow-[0_8px_30px_rgba(19,22,28,.14)]" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-start gap-3">
        <ScoreRing score={p.distressScore} size={48} stroke={4} animate />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-extrabold text-[16px] leading-tight truncate">{p.address}</div>
              <div className="text-[13px] text-muted">{p.city}, {p.state} {p.zip}</div>
            </div>
            <button type="button" aria-label="Close" className="text-muted hover:text-ink -mr-1 -mt-1 px-1 text-lg leading-none" onClick={onClose}>×</button>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {p.leadStatus !== "new" && <span className="chip bg-ink text-white">{LEAD_LABEL[p.leadStatus]}</span>}
            {p.distressTypes.map((t) => <span key={t} className="chip bg-brand/10 text-brand">{DISTRESS_LABEL[t]}</span>)}
            {p.absentee && <span className="chip bg-bg border border-line text-ink/80">Absentee</span>}
            {p.isSample && <span className="chip bg-line text-muted">sample</span>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-x-3 gap-y-2 mt-3">
        <F k="Est. value" v={money(p.estValue)} />
        <F k="Equity" v={p.estEquityPct != null ? pct(p.estEquityPct) : p.estEquity != null ? money(p.estEquity) : "—"} />
        <F k="Owned" v={p.yearsOwned != null ? `${p.yearsOwned} yrs` : "—"} />
        <F k="Beds / baths" v={p.beds != null || p.baths != null ? `${p.beds ?? "—"} / ${p.baths ?? "—"}` : "—"} />
        <F k="Sq ft" v={p.sqft != null ? p.sqft.toLocaleString() : "—"} />
        <F k="Built" v={p.yearBuilt ?? "—"} />
      </div>
      {p.ownerName && <div className="mt-2 text-[13px] text-muted truncate">Owner: <span className="text-ink">{p.ownerName}</span>{p.lenderName ? ` · ${p.lenderName}` : ""}</div>}
      <Link href={`/property/${p.id}`} className="btn btn-dark w-full mt-3">Open property</Link>
    </div>
  );
}
