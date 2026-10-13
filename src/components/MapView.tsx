"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MlMap, Marker, MapMouseEvent } from "maplibre-gl";
import type { Property } from "@/lib/types";
import type { LngLat } from "@/lib/geo";
import { scoreTone } from "@/lib/format";

/**
 * Base maps:
 *  - Streets: OpenStreetMap raster tiles (no key).
 *  - Satellite: Esri World Imagery (no key; attribution required). Display only —
 *    imagery shown here is never sent to the AI scorer. For heavier/commercial use,
 *    swap for MapTiler or Mapbox satellite with a key (see README).
 * Google Maps is NOT used here (display-only embeds live on the card).
 */
const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap contributors" },
    sat: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
    labels: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
    },
    area: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
  },
  layers: [
    { id: "osm", type: "raster", source: "osm" },
    { id: "sat", type: "raster", source: "sat", layout: { visibility: "none" } },
    { id: "labels", type: "raster", source: "labels", layout: { visibility: "none" } },
    { id: "area-fill", type: "fill", source: "area", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#e4572e", "fill-opacity": 0.12 } },
    { id: "area-line", type: "line", source: "area", paint: { "line-color": "#e4572e", "line-width": 2.5, "line-dasharray": [2, 1.2] } },
    { id: "area-pts", type: "circle", source: "area", filter: ["==", "$type", "Point"], paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": "#e4572e", "circle-stroke-width": 2.5 } },
  ],
};

// Next.js dev (Turbopack) can't resolve MapLibre's bundled worker URL, so we
// serve a copy from /public. Keep it in sync when maplibre-gl is upgraded:
//   cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs public/
if (typeof window !== "undefined") maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

const TONE_COLOR = { hot: "#e4572e", warm: "#d99a2b", cool: "#3c7a5a", none: "#13161c" } as const;
const BASE_KEY = "ol:basemap";

function areaGeoJSON(ring: LngLat[], closed: boolean): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = ring.map((c) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: c } }));
  if (closed && ring.length >= 3) features.push({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] } });
  else if (ring.length >= 2) features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } });
  return { type: "FeatureCollection", features };
}

export default function MapView({
  properties,
  selectedId,
  onSelect,
  onClear,
  area,
  onAreaChange,
}: {
  properties: Property[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onClear?: () => void;
  /** The applied target area (closed ring) or null. */
  area?: LngLat[] | null;
  onAreaChange?: (ring: LngLat[] | null) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  const [ready, setReady] = useState(false);
  const [base, setBase] = useState<"streets" | "satellite">(() => { try { return localStorage.getItem(BASE_KEY) === "satellite" ? "satellite" : "streets"; } catch { return "streets"; } });
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<LngLat[]>([]);
  // Refs so map event handlers (bound once) see current values.
  const drawingRef = useRef(drawing);
  const onClearRef = useRef(onClear);
  useEffect(() => { drawingRef.current = drawing; onClearRef.current = onClear; });

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new maplibregl.Map({ container: el.current, style: STYLE, center: [-87.95, 43.04], zoom: 10, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), "top-right");
    m.on("load", () => setReady(true));
    m.on("click", (e: MapMouseEvent) => {
      if (drawingRef.current) setDraft((d) => [...d, [e.lngLat.lng, e.lngLat.lat]]);
      else onClearRef.current?.();
    });
    m.on("dblclick", (e) => { if (drawingRef.current) e.preventDefault(); });
    map.current = m;
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  // Basemap toggle
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const sat = base === "satellite";
    m.setLayoutProperty("osm", "visibility", sat ? "none" : "visible");
    m.setLayoutProperty("sat", "visibility", sat ? "visible" : "none");
    m.setLayoutProperty("labels", "visibility", sat ? "visible" : "none");
    try { localStorage.setItem(BASE_KEY, base); } catch {}
  }, [base, ready]);

  // Draw the draft while drawing, otherwise the applied area.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource("area") as GeoJSONSource | undefined)?.setData(drawing ? areaGeoJSON(draft, false) : areaGeoJSON(area ?? [], true));
    m.getCanvas().style.cursor = drawing ? "crosshair" : "";
  }, [drawing, draft, area, ready]);

  // Markers rebuild only when the set of properties changes.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    for (const mk of markers.current.values()) mk.remove();
    markers.current.clear();
    const bounds = new maplibregl.LngLatBounds();
    let any = false;
    for (const p of properties) {
      if (p.lat == null || p.lng == null) continue;
      const dot = document.createElement("button");
      dot.type = "button";
      dot.title = `${p.address}${p.distressScore != null ? ` · score ${p.distressScore}` : ""}`;
      dot.className = "ol-marker";
      dot.style.background = TONE_COLOR[scoreTone(p.distressScore)];
      dot.textContent = p.distressScore != null ? String(p.distressScore) : "";
      dot.onclick = (e) => { e.stopPropagation(); if (!drawingRef.current) onSelect(p.id); };
      const mk = new maplibregl.Marker({ element: dot }).setLngLat([p.lng, p.lat]).addTo(m);
      markers.current.set(p.id, mk);
      bounds.extend([p.lng, p.lat]);
      any = true;
    }
    // Keep the view on a drawn area instead of jumping to fit all pins.
    if (any && !area) m.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 400 });
  }, [properties, onSelect, area]);

  // Highlight + center the selected pin without rebuilding the others.
  useEffect(() => {
    const m = map.current;
    for (const [id, mk] of markers.current) mk.getElement().classList.toggle("is-selected", id === selectedId);
    const p = properties.find((x) => x.id === selectedId);
    if (m && p && p.lat != null && p.lng != null) m.easeTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 12), duration: 400 });
  }, [selectedId, properties]);

  const startDraw = () => { onClear?.(); setDraft([]); setDrawing(true); };
  const cancelDraw = () => { setDrawing(false); setDraft([]); };
  const finishDraw = () => {
    if (draft.length < 3) return;
    setDrawing(false);
    onAreaChange?.(draft);
    setDraft([]);
  };

  // Keyboard: Enter finishes, Esc cancels, Backspace removes the last point.
  useEffect(() => {
    if (!drawing) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDraw();
      else if (e.key === "Enter") finishDraw();
      else if (e.key === "Backspace") { e.preventDefault(); setDraft((d) => d.slice(0, -1)); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const seg = "px-3 py-1.5 text-[13px] font-semibold transition-colors";
  const lift = "shadow-[0_2px_8px_rgba(19,22,28,.12)]";
  return (
    <div className="relative w-full h-full">
      <div ref={el} className="w-full h-full" />

      <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-2">
        <div className={`inline-flex rounded-md border border-line bg-surface overflow-hidden ${lift}`}>
          <button type="button" className={`${seg} ${base === "streets" ? "bg-ink text-white" : "text-ink hover:bg-bg"}`} onClick={() => setBase("streets")}>Map</button>
          <button type="button" className={`${seg} ${base === "satellite" ? "bg-ink text-white" : "text-ink hover:bg-bg"}`} onClick={() => setBase("satellite")}>Satellite</button>
        </div>

        {!drawing && (
          <div className="inline-flex gap-1.5">
            <button type="button" className={`btn py-1.5 ${lift}`} onClick={startDraw}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M4 7l6-3 8 4 2 9-9 3-7-6z" /></svg>
              {area ? "Redraw area" : "Draw area"}
            </button>
            {area && <button type="button" className={`btn py-1.5 ${lift}`} onClick={() => onAreaChange?.(null)}>Clear area</button>}
          </div>
        )}

        {drawing && (
          <div className="card p-3 w-64 shadow-[0_8px_30px_rgba(19,22,28,.14)]">
            <div className="font-bold text-sm">Draw a target area</div>
            <div className="text-[12px] text-muted mt-0.5">
              Click the map to drop corners. {draft.length < 3 ? `${3 - draft.length} more to close.` : `${draft.length} corners.`} Enter to finish · Backspace undo · Esc cancel.
            </div>
            <div className="flex gap-1.5 mt-2.5">
              <button type="button" className="btn btn-brand flex-1 py-1.5" disabled={draft.length < 3} onClick={finishDraw}>Apply</button>
              <button type="button" className="btn py-1.5" disabled={!draft.length} onClick={() => setDraft((d) => d.slice(0, -1))}>Undo</button>
              <button type="button" className="btn py-1.5" onClick={cancelDraw}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
