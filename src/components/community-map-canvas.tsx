import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import {
  PIN_CATEGORIES,
  PIN_INCIDENT_TYPES,
  type PinCategory,
} from "@/lib/pin-categories";

// Leaflet's default icon paths break under bundlers — point at the CDN copy.
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)["_getIconUrl"];
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function makeDivIcon(category: PinCategory): L.DivIcon {
  const hex = PIN_CATEGORIES[category].hex;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:28px;height:28px;border-radius:50% 50% 50% 0;
      background:${hex};border:2px solid white;
      transform:rotate(-45deg);
      box-shadow:0 2px 6px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });
}

const ICONS: Record<PinCategory, L.DivIcon> = Object.fromEntries(
  PIN_INCIDENT_TYPES.map((k) => [k, makeDivIcon(k)]),
) as Record<PinCategory, L.DivIcon>;

function ClickHandler({
  active,
  onMapClick,
}: {
  active: boolean;
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (active) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export interface MapPinRow {
  id: string;
  lat: number;
  lng: number;
  incident_type: string;
  summary: string | null;
  created_at: string;
}

export interface CommunityMapCanvasProps {
  pins: MapPinRow[];
  dropMode: boolean;
  pendingLatLng: { lat: number; lng: number } | null;
  pinCategory: PinCategory;
  onMapClick: (lat: number, lng: number) => void;
  onDeletePin: (id: string) => void;
}

/** Client-only Leaflet canvas. Never import this from an SSR-evaluated module. */
export default function CommunityMapCanvas({
  pins,
  dropMode,
  pendingLatLng,
  pinCategory,
  onMapClick,
  onDeletePin,
}: CommunityMapCanvasProps) {
  return (
    <MapContainer
      center={[27.7, 85.32]}
      zoom={10}
      style={{ height: "100%", width: "100%" }}
      className={dropMode && !pendingLatLng ? "cursor-crosshair" : ""}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickHandler active={dropMode && !pendingLatLng} onMapClick={onMapClick} />

      {pins.map((pin) => {
        const cat = pin.incident_type as PinCategory;
        const meta = PIN_CATEGORIES[cat];
        return (
          <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={ICONS[cat] ?? ICONS.trapped}>
            <Popup>
              <div className="min-w-[180px] space-y-1.5 text-sm">
                <div className="flex items-center gap-1.5 font-semibold">
                  {meta?.icon}
                  <span>{meta?.label ?? cat}</span>
                </div>
                {pin.summary && (
                  <p className="text-muted-foreground leading-snug">{pin.summary}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(pin.created_at), { addSuffix: true })}
                </p>
                <button
                  onClick={() => onDeletePin(pin.id)}
                  className="mt-1 flex items-center gap-1 rounded text-xs text-destructive hover:underline"
                >
                  <Trash2 className="h-3 w-3" /> Remove pin
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {pendingLatLng && (
        <Marker
          position={[pendingLatLng.lat, pendingLatLng.lng]}
          icon={ICONS[pinCategory] ?? ICONS.trapped}
        >
          <Popup autoClose={false} closeOnClick={false}>
            <p className="text-xs font-medium">Confirm pin location</p>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
