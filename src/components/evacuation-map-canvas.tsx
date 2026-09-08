/**
 * EvacuationMapCanvas — client-only Leaflet component.
 * Shows real OpenStreetMap tiles with evacuation routes, shelters and hospitals.
 * Never import from SSR-evaluated modules.
 */
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from "react-leaflet";
import L from "leaflet";

// Fix Leaflet icon paths broken by bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)["_getIconUrl"];
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom icons
function makeIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:32px;height:32px;border-radius:50% 50% 50% 0;
      background:${color};border:2px solid white;
      transform:rotate(-45deg);
      box-shadow:0 2px 8px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
    ">
      <span style="transform:rotate(45deg);font-size:13px;">${label}</span>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  });
}

const ICONS = {
  origin: makeIcon("oklch(0.53 0.17 255)", "📍"),
  shelter: makeIcon("oklch(0.55 0.13 155)", "⛺"),
  hospital: makeIcon("oklch(0.55 0.13 155)", "🏥"),
  route0: makeIcon("oklch(0.53 0.17 255)", "✅"),
  route1: makeIcon("oklch(0.63 0.17 44)", "↗"),
};

// Node coordinates for Nepal evacuation scenario
const NODE_COORDS: Record<string, [number, number]> = {
  Kathmandu: [27.7172, 85.324], Lalitpur: [27.6644, 85.3188], Bhaktapur: [27.671, 85.4298],
  Thankot: [27.6939, 85.2075], Chabahil: [27.7189, 85.3455], Dhulikhel: [27.6193, 85.539],
  Chitwan: [27.5291, 84.3542], Morang: [26.66, 87.28], Koshi: [26.51, 87.15],
};

interface EvacRoute {
  nodes: string[];
  totalKm: number;
  etaMinutes: number;
  maxRisk: string;
}

interface Shelter { id: string; name: string; lat: number; lng: number; district: string; capacity: number; occupancy: number; dist: number }
interface Hospital { id: string; name: string; lat: number; lng: number; district: string; beds_available: number; dist: number }

interface Props {
  originCoords: [number, number] | null;
  routes: EvacRoute[];
  shelters: Shelter[];
  hospitals: Hospital[];
}

const ROUTE_COLORS = ["#3b82f6", "#f59e0b", "#6366f1"];

export default function EvacuationMapCanvas({ originCoords, routes, shelters, hospitals }: Props) {
  const center: [number, number] = originCoords ?? [27.7, 85.32];

  // Build polyline for each route
  const routeLines = routes.map((route) => {
    const coords: [number, number][] = route.nodes
      .map((n) => NODE_COORDS[n])
      .filter((c): c is [number, number] => !!c);
    return coords;
  });

  return (
    <MapContainer center={center} zoom={9} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Origin marker */}
      {originCoords && (
        <Marker position={originCoords} icon={ICONS.origin}>
          <Popup>
            <p className="font-semibold text-sm">Your location</p>
            <p className="text-xs text-muted-foreground">{center[0].toFixed(4)}, {center[1].toFixed(4)}</p>
          </Popup>
        </Marker>
      )}

      {/* Hazard zone radius */}
      {originCoords && (
        <Circle
          center={originCoords}
          radius={8000}
          pathOptions={{ color: "oklch(0.55 0.22 26)", fillColor: "oklch(0.55 0.22 26)", fillOpacity: 0.08, weight: 1.5, dashArray: "6 4" }}
        />
      )}

      {/* Route polylines */}
      {routeLines.map((line, i) => (
        <Polyline
          key={i}
          positions={line}
          pathOptions={{
            color: ROUTE_COLORS[i % ROUTE_COLORS.length],
            weight: i === 0 ? 5 : 3,
            opacity: i === 0 ? 0.9 : 0.6,
            dashArray: i === 0 ? undefined : "8 5",
          }}
        />
      ))}

      {/* Destination markers */}
      {routes.map((route, i) => {
        const lastNode = route.nodes[route.nodes.length - 1];
        const coords = lastNode ? NODE_COORDS[lastNode] : null;
        if (!coords) return null;
        return (
          <Marker key={i} position={coords} icon={i === 0 ? ICONS.route0 : ICONS.route1}>
            <Popup>
              <p className="font-semibold text-sm">{lastNode}</p>
              <p className="text-xs">{route.etaMinutes} min · {route.totalKm} km · Risk: {route.maxRisk}</p>
              {i === 0 && <p className="text-xs font-semibold text-primary mt-1">✅ Recommended corridor</p>}
            </Popup>
          </Marker>
        );
      })}

      {/* Shelter markers */}
      {shelters.map((s) => (
        <Marker key={s.id} position={[s.lat, s.lng]} icon={ICONS.shelter}>
          <Popup>
            <p className="font-semibold text-sm">{s.name}</p>
            <p className="text-xs">{s.district} · {s.capacity - s.occupancy} spaces free</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">DEMO DATA</p>
          </Popup>
        </Marker>
      ))}

      {/* Hospital markers */}
      {hospitals.map((h) => (
        <Marker key={h.id} position={[h.lat, h.lng]} icon={ICONS.hospital}>
          <Popup>
            <p className="font-semibold text-sm">{h.name}</p>
            <p className="text-xs">{h.district} · {h.beds_available} beds available</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">DEMO DATA</p>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
