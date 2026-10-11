import Link from "next/link";
import type { Property } from "@/lib/types";
import { DISTRESS_LABEL, LEAD_LABEL, money, pct, scoreTone } from "@/lib/format";

export function ScoreBadge({ score }: { score?: number }) {
  const tone = scoreTone(score);
  const cls = { hot: "bg-hot text-white", warm: "bg-warm text-white", cool: "bg-cool text-white", none: "bg-line text-muted" }[tone];
  return <span className={`chip ${cls}`}>{score == null ? "no score" : `Score ${score}`}</span>;
}

export default function PropertyRow({ p, active, onClick }: { p: Property; active?: boolean; onClick?: () => void }) {
  return (
    <div className={`card ${active ? "border-brand" : ""} flex flex-col gap-2`} onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold leading-tight">{p.address}</div>
          <div className="text-sm text-muted">{p.city}, {p.state} {p.zip}{p.isSample ? " · SAMPLE" : ""}</div>
        </div>
        <ScoreBadge score={p.distressScore} />
      </div>
      <div className="flex flex-wrap gap-1">
        {p.distressTypes.map((t) => (
          <span key={t} className="chip bg-bg border border-line">{DISTRESS_LABEL[t]}</span>
        ))}
        {p.absentee && <span className="chip bg-bg border border-line">Absentee</span>}
        {p.leadStatus !== "new" && <span className="chip bg-dark text-white">{LEAD_LABEL[p.leadStatus]}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div><div className="label">Est. value</div>{money(p.estValue)}</div>
        <div><div className="label">Equity</div>{money(p.estEquity)} <span className="text-muted">({pct(p.estEquityPct)})</span></div>
        <div><div className="label">Owned</div>{p.yearsOwned != null ? `${p.yearsOwned} yrs` : "—"}</div>
      </div>
      <Link href={`/property/${p.id}`} className="btn btn-brand mt-1 self-start" onClick={(e) => e.stopPropagation()}>Open card</Link>
    </div>
  );
}
