import type { Database } from "@/integrations/supabase/types";

export type Severity = Database["public"]["Enums"]["severity_level"];
export type RoadState = Database["public"]["Enums"]["road_state"];
export type IncidentStatus = Database["public"]["Enums"]["incident_status"];
export type VehicleStatus = Database["public"]["Enums"]["vehicle_status"];

export const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  moderate: "Moderate",
  safe: "Safe",
};

/** Tailwind classes built from semantic severity tokens (see src/styles.css). */
export const severityChip: Record<Severity, string> = {
  critical: "bg-critical-soft text-critical border-critical/40",
  high: "bg-high-soft text-high border-high/40",
  moderate: "bg-moderate-soft text-moderate border-moderate/40",
  safe: "bg-safe-soft text-safe border-safe/40",
};

export const severityDot: Record<Severity, string> = {
  critical: "bg-critical",
  high: "bg-high",
  moderate: "bg-moderate",
  safe: "bg-safe",
};

export const severityOrder: Record<Severity, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  safe: 3,
};

export const roadStateLabel: Record<RoadState, string> = {
  open: "Open",
  flooded: "Flooded",
  landslide: "Landslide",
  bridge_damaged: "Bridge damaged",
  blocked: "Blocked",
  high_risk: "High risk",
};

export const incidentStatusLabel: Record<IncidentStatus, string> = {
  new: "New report",
  assigned: "Responder assigned",
  in_progress: "In progress",
  resolved: "Resolved",
};

export const vehicleStatusLabel: Record<VehicleStatus, string> = {
  available: "Available",
  en_route: "En route",
  on_scene: "On scene",
  returning: "Returning",
  offline: "Offline",
};

export const incidentTypes = [
  "Building collapse",
  "Flooding",
  "Landslide",
  "Road accident",
  "Fire",
  "Medical emergency",
  "Trapped persons",
  "Gas leak",
] as const;

export const requiredServices = [
  "Ambulance",
  "Fire brigade",
  "Rescue team",
  "Police",
  "Evacuation bus",
] as const;

/** Extra travel penalty (minutes) applied per road state during routing. */
const statePenalty: Record<RoadState, number> = {
  open: 0,
  high_risk: 14,
  flooded: 45,
  landslide: 70,
  bridge_damaged: Number.POSITIVE_INFINITY,
  blocked: Number.POSITIVE_INFINITY,
};

const riskPenalty: Record<Severity, number> = {
  safe: 0,
  moderate: 6,
  high: 20,
  critical: 55,
};

export type Edge = {
  from_node: string;
  to_node: string;
  road_name: string;
  state: RoadState;
  risk: Severity;
  distance_km: number;
  base_minutes: number;
  note: string | null;
};

export type RouteLeg = Edge & { cost: number };

export type RouteResult = {
  path: string[];
  legs: RouteLeg[];
  minutes: number;
  distanceKm: number;
  risk: Severity;
  avoided: Edge[];
};

export function edgeCost(edge: Edge, avoidHazards: boolean): number {
  const hazard = statePenalty[edge.state] + riskPenalty[edge.risk];
  if (!Number.isFinite(hazard)) return Number.POSITIVE_INFINITY;
  return edge.base_minutes + (avoidHazards ? hazard : Math.min(hazard, 4));
}

/**
 * Dijkstra over the live road graph. Blocked and bridge-damaged links are
 * never traversable; risky links cost extra minutes so the safest usable
 * corridor wins even when it is physically longer.
 */
export function optimizeRoute(
  edges: Edge[],
  origin: string,
  destination: string,
  avoidHazards = true,
): RouteResult | null {
  const graph = new Map<string, RouteLeg[]>();
  const avoided: Edge[] = [];

  const push = (from: string, to: string, edge: Edge) => {
    const cost = edgeCost(edge, avoidHazards);
    if (!Number.isFinite(cost)) return;
    const list = graph.get(from) ?? [];
    list.push({ ...edge, from_node: from, to_node: to, cost });
    graph.set(from, list);
  };

  for (const edge of edges) {
    if (!Number.isFinite(edgeCost(edge, avoidHazards))) avoided.push(edge);
    push(edge.from_node, edge.to_node, edge);
    push(edge.to_node, edge.from_node, edge);
  }

  const dist = new Map<string, number>([[origin, 0]]);
  const prev = new Map<string, RouteLeg>();
  const visited = new Set<string>();

  for (;;) {
    let current: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const [node, value] of dist) {
      if (!visited.has(node) && value < best) {
        best = value;
        current = node;
      }
    }
    if (current === null) break;
    if (current === destination) break;
    visited.add(current);
    for (const leg of graph.get(current) ?? []) {
      const next = best + leg.cost;
      if (next < (dist.get(leg.to_node) ?? Number.POSITIVE_INFINITY)) {
        dist.set(leg.to_node, next);
        prev.set(leg.to_node, leg);
      }
    }
  }

  if (!dist.has(destination) || origin === destination) return null;

  const legs: RouteLeg[] = [];
  let cursor = destination;
  while (cursor !== origin) {
    const leg = prev.get(cursor);
    if (!leg) return null;
    legs.unshift(leg);
    cursor = leg.from_node;
  }

  const minutes = Math.round(legs.reduce((sum, leg) => sum + leg.base_minutes, 0));
  const distanceKm = Number(legs.reduce((sum, leg) => sum + Number(leg.distance_km), 0).toFixed(1));
  const risk = legs.reduce<Severity>(
    (worst, leg) => (severityOrder[leg.risk] < severityOrder[worst] ? leg.risk : worst),
    "safe",
  );

  return { path: [origin, ...legs.map((leg) => leg.to_node)], legs, minutes, distanceKm, risk, avoided };
}

export function nodesFromEdges(edges: Edge[]): string[] {
  const set = new Set<string>();
  for (const edge of edges) {
    set.add(edge.from_node);
    set.add(edge.to_node);
  }
  return [...set].sort();
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
