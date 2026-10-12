import { scoreTone } from "@/lib/format";

const COLOR = { hot: "var(--hot)", warm: "var(--warm)", cool: "var(--cool)", none: "var(--line)" } as const;

/** The score ring: fills clockwise with the distress score and shifts color as it rises. */
export default function ScoreRing({ score, size = 44, stroke = 4, animate = false, label }: { score?: number; size?: number; stroke?: number; animate?: boolean; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = score == null ? 0 : Math.max(0, Math.min(100, score));
  const off = c * (1 - v / 100);
  const tone = scoreTone(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={score == null ? "No score yet" : `Distress score ${score}`} aria-label={score == null ? "No score yet" : `Distress score ${score}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        {score != null && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLOR[tone]} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={off} className={animate ? "ring-arc" : undefined}
            style={{ ["--ring-c" as string]: c, ["--ring-off" as string]: off }} />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center leading-none">
        <span className={`font-bold ${size >= 60 ? "text-xl" : "text-[13px]"} ${score == null ? "text-muted" : "text-ink"}`}>{score ?? "–"}</span>
        {label && <span className="text-[10px] text-muted mt-0.5">{label}</span>}
      </div>
    </div>
  );
}
