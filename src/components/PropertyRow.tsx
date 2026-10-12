import Link from "next/link";
import type { Property } from "@/lib/types";
import { DISTRESS_LABEL, LEAD_LABEL, money, pct } from "@/lib/format";
import ScoreRing from "./ScoreRing";

/** Compact list row: address, three facts, score ring. Click selects; the address opens the card. */
export default function PropertyRow({ p, active, onClick }: { p: Property; active?: boolean; onClick?: () => void }) {
  return (
    <div
      className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 bg-surface cursor-pointer transition-colors ${active ? "border-brand" : "border-line hover:border-ink/40"}`}
      onClick={onClick}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <Link href={`/property/${p.id}`} className="font-bold text-[15px] leading-tight truncate hover:underline" onClick={(e) => e.stopPropagation()}>{p.address}</Link>
          {p.leadStatus !== "new" && <span className="chip bg-ink text-white">{LEAD_LABEL[p.leadStatus]}</span>}
          {p.isSample && <span className="chip bg-line text-muted">sample</span>}
        </div>
        <div className="text-[13px] text-muted truncate">{p.city}, {p.state} {p.zip}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]">
          <span><span className="text-muted">Value </span><span className="font-semibold">{money(p.estValue)}</span></span>
          <span><span className="text-muted">Equity </span><span className="font-semibold">{p.estEquityPct != null ? pct(p.estEquityPct) : "—"}</span></span>
          <span><span className="text-muted">Owned </span><span className="font-semibold">{p.yearsOwned != null ? `${p.yearsOwned}y` : "—"}</span></span>
          {p.absentee && <span className="text-muted">Absentee</span>}
        </div>
        {p.distressTypes.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {p.distressTypes.map((t) => <span key={t} className="chip bg-bg border border-line text-ink/80">{DISTRESS_LABEL[t]}</span>)}
          </div>
        )}
      </div>
      <ScoreRing score={p.distressScore} size={44} />
    </div>
  );
}
