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

const TONE_COLOR = { hot: "#9e0000", warm: "#b86e00", cool: "#2f6f4e", none: "#05150e" } as const;

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
      dot.title = p.address;
      const tone = scoreTone(p.distressScore);
      const size = p.id === selectedId ? 22 : 16;
      dot.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${TONE_COLOR[tone]};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer;`;
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
