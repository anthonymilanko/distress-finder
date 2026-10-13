/** [lng, lat] pairs. A ring need not repeat its first point. */
export type LngLat = [number, number];

/** Ray-casting point-in-polygon. Good for county/neighborhood-sized shapes (planar approximation). */
export function pointInPolygon(lng: number, lat: number, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** "lng,lat;lng,lat;..." ⇄ ring. Compact enough for a query string; 5 decimals ≈ 1 m. */
export function encodeRing(ring: LngLat[]): string {
  return ring.map(([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`).join(";");
}
export function decodeRing(s: string | null | undefined): LngLat[] | undefined {
  if (!s) return undefined;
  const ring = s.split(";").map((pair) => pair.split(",").map(Number) as LngLat).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  return ring.length >= 3 ? ring : undefined;
}
