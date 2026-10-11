"use client";
import type { DistressType, LeadStatus, PropertyFilters } from "@/lib/types";
import { DISTRESS_LABEL, DISTRESS_TYPES, LEAD_LABEL } from "@/lib/format";

export default function Filters({ value, onChange }: { value: PropertyFilters; onChange: (f: PropertyFilters) => void }) {
  const set = (patch: Partial<PropertyFilters>) => onChange({ ...value, ...patch });
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
      <select className="input !w-auto text-sm" value={value.state ?? ""} onChange={(e) => set({ state: e.target.value || undefined })}>
        <option value="">All states</option>
        <option value="WI">WI</option>
        <option value="FL">FL</option>
        <option value="TX">TX</option>
      </select>
      <select className="input !w-auto text-sm" value={value.distressType ?? ""} onChange={(e) => set({ distressType: (e.target.value as DistressType) || undefined })}>
        <option value="">Any distress</option>
        {DISTRESS_TYPES.map((t) => (
          <option key={t} value={t}>{DISTRESS_LABEL[t]}</option>
        ))}
      </select>
      <select className="input !w-auto text-sm" value={value.minEquityPct ?? ""} onChange={(e) => set({ minEquityPct: e.target.value ? Number(e.target.value) : undefined })}>
        <option value="">Any equity</option>
        <option value="30">Equity ≥ 30%</option>
        <option value="50">Equity ≥ 50%</option>
        <option value="75">Equity ≥ 75%</option>
      </select>
      <select className="input !w-auto text-sm" value={value.minYearsOwned ?? ""} onChange={(e) => set({ minYearsOwned: e.target.value ? Number(e.target.value) : undefined })}>
        <option value="">Any tenure</option>
        <option value="10">Owned 10+ yrs</option>
        <option value="15">Owned 15+ yrs</option>
        <option value="20">Owned 20+ yrs</option>
      </select>
      <button type="button" className={`btn text-sm ${value.absentee ? "btn-dark" : ""}`} onClick={() => set({ absentee: !value.absentee })}>
        Absentee
      </button>
      <select className="input !w-auto text-sm" value={value.leadStatus ?? ""} onChange={(e) => set({ leadStatus: (e.target.value as LeadStatus) || undefined })}>
        <option value="">Any status</option>
        {(Object.keys(LEAD_LABEL) as LeadStatus[]).map((s) => (
          <option key={s} value={s}>{LEAD_LABEL[s]}</option>
        ))}
      </select>
    </div>
  );
}
