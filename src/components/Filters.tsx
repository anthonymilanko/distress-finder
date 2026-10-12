"use client";
import type { DistressType, LeadStatus, PropertyFilters } from "@/lib/types";
import { DISTRESS_LABEL, DISTRESS_TYPES, LEAD_LABEL } from "@/lib/format";

/** Pill-shaped select: a visible label + chevron, with the native <select> laid invisibly on top so it still opens the OS picker. */
const Select = ({ value, onChange, children, active, options }: { value: string; onChange: (v: string) => void; children: React.ReactNode; active: boolean; options: Record<string, string> }) => (
  <span className={`pill relative pr-8 whitespace-nowrap ${active ? "pill-on" : ""}`}>
    {options[value] ?? value}
    <svg className="absolute right-3 top-1/2 -translate-y-1/2" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
    <select className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value={value} onChange={(e) => onChange(e.target.value)} aria-label={options[""] ?? "Filter"}>
      {children}
    </select>
  </span>
);

const STATE_OPTS = { "": "All states", WI: "Wisconsin", FL: "Florida", TX: "Texas" };
const EQUITY_OPTS = { "": "Any equity", "30": "Equity 30%+", "50": "Equity 50%+", "75": "Equity 75%+" };
const TENURE_OPTS = { "": "Any tenure", "10": "Owned 10y+", "15": "Owned 15y+", "20": "Owned 20y+" };

export default function Filters({ value, onChange }: { value: PropertyFilters; onChange: (f: PropertyFilters) => void }) {
  const set = (patch: Partial<PropertyFilters>) => onChange({ ...value, ...patch });
  const any = Object.values(value).some((v) => v !== undefined && v !== false && v !== "");
  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
      <Select options={STATE_OPTS} active={Boolean(value.state)} value={value.state ?? ""} onChange={(v) => set({ state: v || undefined })}>
        <option value="">All states</option><option value="WI">Wisconsin</option><option value="FL">Florida</option><option value="TX">Texas</option>
      </Select>
      <Select options={{ "": "Any distress", ...DISTRESS_LABEL }} active={Boolean(value.distressType)} value={value.distressType ?? ""} onChange={(v) => set({ distressType: (v as DistressType) || undefined })}>
        <option value="">Any distress</option>
        {DISTRESS_TYPES.map((t) => <option key={t} value={t}>{DISTRESS_LABEL[t]}</option>)}
      </Select>
      <Select options={EQUITY_OPTS} active={value.minEquityPct != null} value={String(value.minEquityPct ?? "")} onChange={(v) => set({ minEquityPct: v ? Number(v) : undefined })}>
        <option value="">Any equity</option><option value="30">Equity 30%+</option><option value="50">Equity 50%+</option><option value="75">Equity 75%+</option>
      </Select>
      <Select options={TENURE_OPTS} active={value.minYearsOwned != null} value={String(value.minYearsOwned ?? "")} onChange={(v) => set({ minYearsOwned: v ? Number(v) : undefined })}>
        <option value="">Any tenure</option><option value="10">Owned 10y+</option><option value="15">Owned 15y+</option><option value="20">Owned 20y+</option>
      </Select>
      <button type="button" className={`pill ${value.absentee ? "pill-on" : ""}`} onClick={() => set({ absentee: !value.absentee || undefined })}>Absentee</button>
      <Select options={{ "": "Any status", ...LEAD_LABEL }} active={Boolean(value.leadStatus)} value={value.leadStatus ?? ""} onChange={(v) => set({ leadStatus: (v as LeadStatus) || undefined })}>
        <option value="">Any status</option>
        {(Object.keys(LEAD_LABEL) as LeadStatus[]).map((s) => <option key={s} value={s}>{LEAD_LABEL[s]}</option>)}
      </Select>
      {any && <button type="button" className="text-sm text-muted hover:text-ink whitespace-nowrap" onClick={() => onChange({})}>Clear</button>}
    </div>
  );
}
