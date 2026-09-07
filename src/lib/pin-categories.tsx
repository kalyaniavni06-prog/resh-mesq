import { MapPin, Users, Droplets, Cross, Package } from "lucide-react";

/** Community-pin categories. Browser-safe (no map library imports). */
export type PinCategory =
  | "trapped"
  | "medical"
  | "food_water"
  | "flood_rescue"
  | "evacuation";

export interface PinMeta {
  label: string;
  color: string;
  hex: string;
  icon: React.ReactNode;
}

export const PIN_CATEGORIES: Record<PinCategory, PinMeta> = {
  trapped: {
    label: "People trapped",
    color: "bg-critical text-white",
    hex: "#dc2626",
    icon: <Users className="h-3.5 w-3.5" />,
  },
  medical: {
    label: "Medical needed",
    color: "bg-safe text-white",
    hex: "#16a34a",
    icon: <Cross className="h-3.5 w-3.5" />,
  },
  food_water: {
    label: "Food / Water needed",
    color: "bg-primary text-white",
    hex: "#2563eb",
    icon: <Package className="h-3.5 w-3.5" />,
  },
  flood_rescue: {
    label: "Flood rescue",
    color: "bg-blue-500 text-white",
    hex: "#3b82f6",
    icon: <Droplets className="h-3.5 w-3.5" />,
  },
  evacuation: {
    label: "Evacuation needed",
    color: "bg-amber-500 text-white",
    hex: "#f59e0b",
    icon: <MapPin className="h-3.5 w-3.5" />,
  },
};

export const PIN_INCIDENT_TYPES = Object.keys(PIN_CATEGORIES) as PinCategory[];
