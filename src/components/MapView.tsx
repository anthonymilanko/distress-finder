"use client";
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MlMap, Marker } from "maplibre-gl";
import type { Property } from "@/lib/types";
import { scoreTone } from "@/lib/format";

/**
 * Base map: OpenStreetMap raster tiles (no key). Fine for a single user;
 * for production swap `tiles` for MapTiler/Mapbox (see README).
 * Google Maps is NOT used here (display-only embeds live on the card).
 */
const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

// Next.js dev (Turbopack) can't resolve MapLibre's bundled worker URL, so we
// serve a copy from /public. Keep it in sync when maplibre-gl is upgraded:
//   cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs public/
if (typeof window !== "undefined") maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

const TONE_COLOR = { hot: "#e4572e", warm: "#d99a2b", cool: "#3c7a5a", none: "#13161c" } as const;

export default function MapView({
  properties,
  selectedId,
  onSelect,
}: {
  properties: Property[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new maplibregl.Map({ container: el.current, style: STYLE, center: [-87.95, 43.04], zoom: 10, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), "top-right");
    map.current = m;
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

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
      const tone = scoreTone(p.distressScore);
      dot.className = `ol-marker${p.id === selectedId ? " is-selected" : ""}`;
      dot.style.background = TONE_COLOR[tone];
      dot.textContent = p.distressScore != null ? String(p.distressScore) : "";
      dot.onclick = () => onSelect(p.id);
      const mk = new maplibregl.Marker({ element: dot }).setLngLat([p.lng, p.lat]).addTo(m);
      markers.current.set(p.id, mk);
      bounds.extend([p.lng, p.lat]);
      any = true;
    }
    if (any && !selectedId) m.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 400 });
  }, [properties, selectedId, onSelect]);

  useEffect(() => {
    const m = map.current;
    const p = properties.find((x) => x.id === selectedId);
    if (m && p && p.lat != null && p.lng != null) m.easeTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 14), duration: 400 });
  }, [selectedId, properties]);

  return <div ref={el} className="w-full h-full" />;
}
