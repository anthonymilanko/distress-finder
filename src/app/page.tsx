"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Filters from "@/components/Filters";
import PropertyRow from "@/components/PropertyRow";
import type { Property, PropertyFilters } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <div className="h-full grid place-items-center text-muted">Loading map…</div> });

export default function HomePage() {
  const [filters, setFilters] = useState<PropertyFilters>({});
  const [rows, setRows] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("map");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sp = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== false && v !== "") sp.set(k, v === true ? "1" : String(v)); });
    let cancelled = false;
    fetch(`/api/properties?${sp}`).then((r) => r.json()).then((d) => { if (!cancelled) { setRows(d.properties ?? []); setTotal(d.total ?? d.count ?? 0); setLoading(false); } });
    return () => { cancelled = true; };
  }, [filters]);

  const onSelect = useCallback((id: string) => setSelected(id), []);
  const sel = rows.find((r) => r.id === selected);

  return (
    <div className="flex flex-col h-[calc(100dvh-7.5rem)] md:h-dvh">
      <Filters value={filters} onChange={(f) => { setFilters(f); setSelected(null); setLoading(true); }} />
      <div className="px-4 pb-2 flex items-center justify-between text-sm text-muted">
        <span>{loading ? "Loading…" : total > rows.length ? `Showing top ${rows.length} of ${total.toLocaleString()} — add filters to narrow` : `${rows.length} properties`}</span>
        <div className="inline-flex rounded-lg border border-line overflow-hidden md:hidden">
          <button type="button" className={`px-3 py-1 ${view === "map" ? "bg-dark text-white" : "bg-surface"}`} onClick={() => setView("map")}>Map</button>
          <button type="button" className={`px-3 py-1 ${view === "list" ? "bg-dark text-white" : "bg-surface"}`} onClick={() => setView("list")}>List</button>
        </div>
      </div>
      {/* Phone: one view at a time (toggle). Desktop: list beside map. */}
      <div className="flex flex-1 min-h-0">
        <div className={`${view === "list" ? "flex" : "hidden"} md:flex w-full md:w-[26rem] shrink-0 flex-col md:border-r border-line overflow-y-auto px-4 pb-4 gap-3`}>
          {rows.map((p) => (
            <PropertyRow key={p.id} p={p} active={p.id === selected} onClick={() => setSelected(p.id)} />
          ))}
          {!loading && rows.length === 0 && <div className="text-muted text-center py-10">No properties match. Import a list or search an address.</div>}
        </div>
        <div className={`${view === "map" ? "block" : "hidden"} md:block relative flex-1 min-h-0`}>
          <MapView properties={rows} selectedId={selected} onSelect={onSelect} />
          {sel && (
            <div className="absolute inset-x-3 bottom-3 z-10 md:hidden">
              <PropertyRow p={sel} active />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
