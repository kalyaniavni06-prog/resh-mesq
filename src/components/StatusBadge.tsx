import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type IncidentStatus = Database["public"]["Enums"]["incident_status"];
type VehicleStatus = Database["public"]["Enums"]["vehicle_status"];
type RoadState = Database["public"]["Enums"]["road_state"];

// ── Incident status ─────────────────────────────────────────────────────────

const INCIDENT_STATUS: Record<IncidentStatus, { label: string; classes: string }> = {
  new: {
    label: "New",
    classes: "bg-critical-soft text-critical border-critical/20",
  },
  assigned: {
    label: "Assigned",
    classes: "bg-high-soft text-high-foreground border-high/20",
  },
  in_progress: {
    label: "In Progress",
    classes: "bg-moderate-soft text-moderate-foreground border-moderate/20",
  },
  resolved: {
    label: "Resolved",
    classes: "bg-safe-soft text-safe-foreground border-safe/20",
  },
};

export function IncidentStatusBadge({
  status,
  className,
}: {
  status: IncidentStatus;
  className?: string;
}) {
  const cfg = INCIDENT_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
        cfg.classes,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}

// ── Vehicle status ───────────────────────────────────────────────────────────

const VEHICLE_STATUS: Record<VehicleStatus, { label: string; classes: string }> = {
  available: {
    label: "Available",
    classes: "bg-safe-soft text-safe-foreground border-safe/20",
  },
  en_route: {
    label: "En Route",
    classes: "bg-moderate-soft text-moderate-foreground border-moderate/20",
  },
  on_scene: {
    label: "On Scene",
    classes: "bg-high-soft text-high-foreground border-high/20",
  },
  returning: {
    label: "Returning",
    classes: "bg-secondary text-secondary-foreground border-border",
  },
  offline: {
    label: "Offline",
    classes: "bg-muted text-muted-foreground border-border",
  },
};

export function VehicleStatusBadge({
  status,
  className,
}: {
  status: VehicleStatus;
  className?: string;
}) {
  const cfg = VEHICLE_STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
        cfg.classes,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}

// ── Road state ───────────────────────────────────────────────────────────────

const ROAD_STATE: Record<RoadState, { label: string; classes: string }> = {
  open: {
    label: "Open",
    classes: "bg-safe-soft text-safe-foreground border-safe/20",
  },
  flooded: {
    label: "Flooded",
    classes: "bg-critical-soft text-critical border-critical/20",
  },
  landslide: {
    label: "Landslide",
    classes: "bg-critical-soft text-critical border-critical/20",
  },
  bridge_damaged: {
    label: "Bridge Damaged",
    classes: "bg-critical-soft text-critical border-critical/20",
  },
  blocked: {
    label: "Blocked",
    classes: "bg-high-soft text-high-foreground border-high/20",
  },
  high_risk: {
    label: "High Risk",
    classes: "bg-high-soft text-high-foreground border-high/20",
  },
};

export function RoadStateBadge({
  state,
  className,
}: {
  state: RoadState;
  className?: string;
}) {
  const cfg = ROAD_STATE[state];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
        cfg.classes,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
