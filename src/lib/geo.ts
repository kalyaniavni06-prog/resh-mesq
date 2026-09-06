/** Static coordinates for the road-graph nodes used by the demo road network. */
export const NODE_COORDS: Record<string, { lat: number; lng: number }> = {
  Kathmandu: { lat: 27.7172, lng: 85.324 },
  Lalitpur: { lat: 27.6644, lng: 85.3188 },
  Bhaktapur: { lat: 27.671, lng: 85.4298 },
  Thankot: { lat: 27.6939, lng: 85.2075 },
  Chabahil: { lat: 27.7189, lng: 85.3455 },
  Dhulikhel: { lat: 27.6193, lng: 85.539 },
  Chitwan: { lat: 27.5291, lng: 84.3542 },
  Morang: { lat: 26.66, lng: 87.28 },
  Koshi: { lat: 26.51, lng: 87.15 },
};

export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Number((2 * R * Math.asin(Math.sqrt(h))).toFixed(1));
}

/** Rough road ETA: urban average of 26 km/h plus a fixed dispatch allowance. */
export function etaMinutes(distanceKm: number): number {
  return Math.max(3, Math.round((distanceKm / 26) * 60) + 3);
}

export type Bounds = { minLat: number; maxLat: number; minLng: number; maxLng: number };

export function boundsOf(points: LatLng[], pad = 0.02): Bounds {
  if (points.length === 0) return { minLat: 27.6, maxLat: 27.8, minLng: 85.2, maxLng: 85.5 };
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const padLat = Math.max((maxLat - minLat) * 0.12, pad);
  const padLng = Math.max((maxLng - minLng) * 0.12, pad);
  return {
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
    minLng: minLng - padLng,
    maxLng: maxLng + padLng,
  };
}

/** Project a coordinate into a 0-100 viewBox space (y flipped so north is up). */
export function project(point: LatLng, bounds: Bounds): { x: number; y: number } {
  const x = ((point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
  const y = 100 - ((point.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
}
