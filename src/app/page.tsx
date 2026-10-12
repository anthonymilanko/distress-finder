"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Filters from "@/components/Filters";
import PropertyRow from "@/components/PropertyRow";
import type { Property, PropertyFilters } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <div className="h-full grid place-items-center text-muted text-sm">Loading map…</div> });

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
  const scored = rows.filter((r) => r.distressScore != null).length;

  return (
    <div className="flex flex-col h-[calc(100dvh-7.5rem)] md:h-dvh">
      <Filters value={filters} onChange={(f) => { setFilters(f); setSelected(null); setLoading(true); }} />
      <div className="px-4 pb-2 flex items-center justify-between text-[13px] text-muted">
        <span>
          {loading ? "Loading…" : total > rows.length ? <>Top <b className="text-ink">{rows.length}</b> of {total.toLocaleString()} · narrow with filters</> : <><b className="text-ink">{rows.length}</b> properties{scored ? `, ${scored} scored` : ""}</>}
        </span>
        <div className="inline-flex rounded-full border border-line overflow-hidden md:hidden">
          <button type="button" className={`px-3 py-1 text-sm ${view === "map" ? "bg-ink text-white" : "bg-surface"}`} onClick={() => setView("map")}>Map</button>
          <button type="button" className={`px-3 py-1 text-sm ${view === "list" ? "bg-ink text-white" : "bg-surface"}`} onClick={() => setView("list")}>List</button>
        </div>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className={`${view === "list" ? "flex" : "hidden"} md:flex w-full md:w-[25rem] shrink-0 flex-col md:border-r border-line overflow-y-auto px-3 pb-4 gap-1.5`}>
          {rows.map((p) => (
            <PropertyRow key={p.id} p={p} active={p.id === selected} onClick={() => setSelected(p.id)} />
          ))}
          {!loading && rows.length === 0 && (
            <div className="text-center py-12 px-6 text-sm text-muted">
              <div className="font-semibold text-ink mb-1">Nothing here yet</div>
              Import a list or search an address to put houses on the map.
            </div>
          )}
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
