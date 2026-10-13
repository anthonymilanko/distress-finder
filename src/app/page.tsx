"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Filters from "@/components/Filters";
import PropertyRow from "@/components/PropertyRow";
import PropertyPeek from "@/components/PropertyPeek";
import AddressSearch from "@/components/AddressSearch";
import type { Property, PropertyFilters } from "@/lib/types";
import { encodeRing, type LngLat } from "@/lib/geo";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <div className="h-full grid place-items-center text-muted text-sm">Loading map…</div> });

const LIST_KEY = "ol:listOpen";
const listeners = new Set<() => void>();
const readListOpen = () => { try { return localStorage.getItem(LIST_KEY) !== "0"; } catch { return true; } };
const subscribeListOpen = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
/** Per-browser "list column open" flag, SSR-safe (server renders it open). */
function useListOpen(): [boolean, () => void] {
  const open = useSyncExternalStore(subscribeListOpen, readListOpen, () => true);
  const toggle = useCallback(() => { try { localStorage.setItem(LIST_KEY, open ? "0" : "1"); } catch {} listeners.forEach((cb) => cb()); }, [open]);
  return [open, toggle];
}

export default function HomePage() {
  const [filters, setFilters] = useState<PropertyFilters>({});
  const [rows, setRows] = useState<Property[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("map");
  const [listOpen, toggleList] = useListOpen();
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState<LngLat[] | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== false && v !== "") sp.set(k, v === true ? "1" : String(v)); });
    if (area) sp.set("polygon", encodeRing(area));
    let cancelled = false;
    fetch(`/api/properties?${sp}`).then((r) => r.json()).then((d) => { if (!cancelled) { setRows(d.properties ?? []); setTotal(d.total ?? d.count ?? 0); setLoading(false); } });
    return () => { cancelled = true; };
  }, [filters, area]);

  const onSelect = useCallback((id: string) => setSelected(id), []);
  const onClear = useCallback(() => setSelected(null), []);
  // A looked-up property goes to the top of the list and opens its peek card on the map.
  const onFound = useCallback((p: Property) => {
    setRows((rs) => [p, ...rs.filter((r) => r.id !== p.id)]);
    setSelected(p.id);
    setView("map");
  }, []);
  const onAreaChange = useCallback((ring: LngLat[] | null) => { setArea(ring); setSelected(null); setLoading(true); }, []);
  const sel = rows.find((r) => r.id === selected);
  const scored = rows.filter((r) => r.distressScore != null).length;

  return (
    <div className="flex flex-col h-[calc(100dvh-7.5rem)] md:h-dvh">
      <div className="flex flex-col md:flex-row md:items-center gap-2 px-4 pt-3">
        <AddressSearch onFound={onFound} />
        <div className="min-w-0 flex-1 -mx-4 md:mx-0">
          <Filters value={filters} onChange={(f) => { setFilters(f); setSelected(null); setLoading(true); }} />
        </div>
      </div>
      <div className="px-4 pb-2 flex items-center justify-between text-[13px] text-muted">
        <span>
          {loading ? "Loading…" : total > rows.length ? <>Top <b className="text-ink">{rows.length}</b> of {total.toLocaleString()} · narrow with filters</> : <><b className="text-ink">{rows.length}</b> properties{scored ? `, ${scored} scored` : ""}</>}
          {area && !loading && <> · <span className="text-brand font-semibold">inside drawn area</span> <button type="button" className="underline hover:text-ink" onClick={() => onAreaChange(null)}>clear</button></>}
        </span>
        <div className="inline-flex rounded-full border border-line overflow-hidden md:hidden">
          <button type="button" className={`px-3 py-1 text-sm ${view === "map" ? "bg-ink text-white" : "bg-surface"}`} onClick={() => setView("map")}>Map</button>
          <button type="button" className={`px-3 py-1 text-sm ${view === "list" ? "bg-ink text-white" : "bg-surface"}`} onClick={() => setView("list")}>List</button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Map (always full width on desktop; the list overlays nothing, it sits beside it) */}
        <div className={`${view === "map" ? "block" : "hidden"} md:block relative flex-1 min-w-0 min-h-0`}>
          <MapView properties={rows} selectedId={selected} onSelect={onSelect} onClear={onClear} area={area} onAreaChange={onAreaChange} />

          {/* Pin peek: bottom-left on desktop, bottom sheet on phone */}
          {sel && (
            <div className="absolute inset-x-3 bottom-3 z-10 md:inset-x-auto md:left-3 md:bottom-3">
              <PropertyPeek p={sel} onClose={onClear} />
            </div>
          )}

          {/* Collapse / expand the list column (desktop) */}
          <button
            type="button"
            onClick={toggleList}
            aria-label={listOpen ? "Hide list" : "Show list"}
            title={listOpen ? "Hide list" : "Show list"}
            className="hidden md:grid absolute top-1/2 -translate-y-1/2 right-0 z-10 w-7 h-14 place-items-center rounded-l-md bg-surface border border-r-0 border-line text-ink shadow-[0_2px_8px_rgba(19,22,28,.12)] hover:bg-bg"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {listOpen ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
            </svg>
          </button>
        </div>

        {/* List column on the right; collapsible on desktop */}
        <div className={`${view === "list" ? "flex" : "hidden"} ${listOpen ? "md:flex" : "md:hidden"} w-full md:w-[25rem] shrink-0 flex-col md:border-l border-line overflow-y-auto px-3 pb-4 gap-1.5`}>
          {rows.map((p) => (
            <PropertyRow key={p.id} p={p} active={p.id === selected} onClick={() => { setSelected(p.id); setView("map"); }} />
          ))}
          {!loading && rows.length === 0 && (
            <div className="text-center py-12 px-6 text-sm text-muted">
              <div className="font-semibold text-ink mb-1">Nothing here yet</div>
              Import a list or search an address to put houses on the map.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
