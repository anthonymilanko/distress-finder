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
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("map");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sp = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== false && v !== "") sp.set(k, v === true ? "1" : String(v)); });
    let cancelled = false;
    fetch(`/api/properties?${sp}`).then((r) => r.json()).then((d) => { if (!cancelled) { setRows(d.properties ?? []); setLoading(false); } });
    return () => { cancelled = true; };
  }, [filters]);

  const onSelect = useCallback((id: string) => setSelected(id), []);
  const sel = rows.find((r) => r.id === selected);

  return (
    <div className="flex flex-col h-[calc(100dvh-7.5rem)]">
      <Filters value={filters} onChange={(f) => { setFilters(f); setSelected(null); setLoading(true); }} />
      <div className="px-4 pb-2 flex items-center justify-between text-sm text-muted">
        <span>{loading ? "Loading…" : `${rows.length} properties`}</span>
        <div className="inline-flex rounded-lg border border-line overflow-hidden">
          <button type="button" className={`px-3 py-1 ${view === "map" ? "bg-dark text-white" : "bg-surface"}`} onClick={() => setView("map")}>Map</button>
          <button type="button" className={`px-3 py-1 ${view === "list" ? "bg-dark text-white" : "bg-surface"}`} onClick={() => setView("list")}>List</button>
        </div>
      </div>
      {view === "map" ? (
        <div className="relative flex-1 min-h-0">
          <MapView properties={rows} selectedId={selected} onSelect={onSelect} />
          {sel && (
            <div className="absolute inset-x-3 bottom-3 z-10">
              <PropertyRow p={sel} active />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3">
          {rows.map((p) => (
            <PropertyRow key={p.id} p={p} active={p.id === selected} onClick={() => setSelected(p.id)} />
          ))}
          {!loading && rows.length === 0 && <div className="text-muted text-center py-10">No properties match. Import a list or search an address.</div>}
        </div>
      )}
    </div>
  );
}
