import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Navigation,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ruler,
  ShieldAlert,
  ArrowRight,
  Info,
  Truck,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SeverityBadge } from "@/components/SeverityBadge";
import { RoadStateBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRoads, useVehicles, type Road } from "@/hooks/useSupabaseData";
import type { Database } from "@/integrations/supabase/types";

type Severity = Database["public"]["Enums"]["severity_level"];
type RoadState = Database["public"]["Enums"]["road_state"];

export const Route = createFileRoute("/routes")({
  component: RoutePlannerPage,
});

// Known nodes extracted from seed data
const NODES = [
  "Kathmandu",
  "Lalitpur",
  "Chitwan",
  "Dhulikhel",
  "Morang",
  "Bhaktapur",
  "Thankot",
  "Chabahil",
  "Koshi",
  "Itahari",
];

const VEHICLE_TYPES = ["ambulance", "rescue_truck", "fire_engine", "rescue_boat", "air_ambulance"];
const EMERGENCY_TYPES = [
  "flood_rescue",
  "road_accident",
  "landslide",
  "medical_emergency",
  "fire",
  "evacuation",
];

// Risk multiplier: higher risk = longer effective travel time
const RISK_MULTIPLIER: Record<RoadState, number> = {
  open: 1.0,
  high_risk: 1.4,
  flooded: 9999, // impassable (light vehicle)
  landslide: 9999,
  bridge_damaged: 9999,
  blocked: 9999,
};

const SEV_ORDER: Record<Severity, number> = {
  critical: 3,
  high: 2,
  moderate: 1,
  safe: 0,
};

interface RouteResult {
  label: string;
  path: Road[];
  totalKm: number;
  etaMinutes: number;
  maxRisk: Severity;
  recommended: boolean;
  reason: string;
  avoidedRoads: Road[];
}

// Simple graph: find all paths via DFS then score them
function findRoutes(
  roads: Road[],
  origin: string,
  dest: string,
  vehicleType: string,
): RouteResult[] {
  // Heavy vehicles (rescue boats / helicopters) can handle flooded roads
  const canHandleFlooded = vehicleType === "rescue_boat" || vehicleType === "air_ambulance";

  const effectiveCost = (road: Road): number => {
    if (!canHandleFlooded && (road.state === "flooded" || road.state === "bridge_damaged")) {
      return 9999;
    }
    if (road.state === "landslide" || road.state === "blocked") return 9999;
    return road.base_minutes * RISK_MULTIPLIER[road.state];
  };

  // Build adjacency list (bidirectional)
  type Edge = { road: Road; to: string };
  const graph: Record<string, Edge[]> = {};
  for (const r of roads) {
    if (!graph[r.from_node]) graph[r.from_node] = [];
    if (!graph[r.to_node]) graph[r.to_node] = [];
    graph[r.from_node]!.push({ road: r, to: r.to_node });
    graph[r.to_node]!.push({ road: r, to: r.from_node });
  }

  // DFS – collect all simple paths up to depth 5
  const allPaths: Road[][] = [];
  const dfs = (node: string, path: Road[], visited: Set<string>) => {
    if (node === dest) {
      allPaths.push([...path]);
      return;
    }
    if (path.length >= 5) return;
    for (const edge of graph[node] ?? []) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        path.push(edge.road);
        dfs(edge.to, path, visited);
        path.pop();
        visited.delete(edge.to);
      }
    }
  };
  dfs(origin, [], new Set([origin]));

  if (allPaths.length === 0) return [];

  // Score each path
  const scored = allPaths.map((path) => {
    const totalCost = path.reduce((s, r) => s + effectiveCost(r), 0);
    const totalKm = path.reduce((s, r) => s + Number(r.distance_km), 0);
    const etaMinutes = path.reduce((s, r) => s + r.base_minutes, 0);
    const maxRiskNum = Math.max(...path.map((r) => SEV_ORDER[r.risk]));
    const maxRisk = (["safe", "moderate", "high", "critical"][maxRiskNum] as Severity) ?? "safe";
    const passable = totalCost < 9000;
    const avoidedRoads = roads.filter(
      (r) =>
        (r.state !== "open") &&
        !path.find((p) => p.id === r.id),
    );
    return { path, totalKm, etaMinutes, maxRisk, maxRiskNum, totalCost, passable, avoidedRoads };
  });

  const passable = scored.filter((s) => s.passable);
  if (passable.length === 0) return [];

  // Sort by cost
  passable.sort((a, b) => a.totalCost - b.totalCost);

  // Pick 2 best distinct routes
  const results: RouteResult[] = [];

  passable.slice(0, 4).forEach((s, i) => {
    if (results.length >= 2) return;
    const isFirst = results.length === 0;
    // Deduplicate: skip if path shares all segments with already-added result
    const alreadyAdded = results.some(
      (r) => JSON.stringify(r.path.map((x) => x.id).sort()) === JSON.stringify(s.path.map((x) => x.id).sort()),
    );
    if (alreadyAdded) return;

    const reason = isFirst
      ? s.maxRiskNum === 0
        ? "All road segments are currently open and passable. Fastest safe option."
        : `Best available route. Avoids ${s.avoidedRoads.length} blocked/high-risk segment${s.avoidedRoads.length !== 1 ? "s" : ""}.`
      : `Alternative path with ${s.avoidedRoads.length} avoided hazard${s.avoidedRoads.length !== 1 ? "s" : ""}. Longer but passable.`;

    results.push({
      label: isFirst ? "Recommended Route" : "Alternative Route",
      path: s.path,
      totalKm: Math.round(s.totalKm * 10) / 10,
      etaMinutes: s.etaMinutes,
      maxRisk: s.maxRisk,
      recommended: isFirst,
      reason,
      avoidedRoads: s.avoidedRoads.slice(0, 5),
    });
  });

  return results;
}

function RouteCard({ result }: { result: RouteResult }) {
  return (
    <Card className={result.recommended ? "border-primary/50 shadow-md" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {result.recommended ? (
              <CheckCircle2 className="h-4 w-4 text-safe" />
            ) : (
              <Navigation className="h-4 w-4 text-muted-foreground" />
            )}
            <CardTitle className="text-sm">{result.label}</CardTitle>
            {result.recommended && (
              <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                Recommended
              </Badge>
            )}
          </div>
          <SeverityBadge severity={result.maxRisk} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="label-caps mb-1">Distance</p>
            <p className="text-lg font-bold flex items-center justify-center gap-1">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
              {result.totalKm} km
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="label-caps mb-1">ETA</p>
            <p className="text-lg font-bold flex items-center justify-center gap-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {result.etaMinutes} min
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="label-caps mb-1">Segments</p>
            <p className="text-lg font-bold">{result.path.length}</p>
          </div>
        </div>

        {/* Route path */}
        <div>
          <p className="label-caps mb-2">Route Path</p>
          <div className="flex flex-wrap items-center gap-1">
            {result.path.map((road, idx) => (
              <span key={road.id} className="flex items-center gap-1">
                {idx === 0 && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                    {road.from_node}
                  </span>
                )}
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  {road.to_node}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Road segments */}
        <div>
          <p className="label-caps mb-2">Road Segments</p>
          <ul className="space-y-1.5">
            {result.path.map((road) => (
              <li key={road.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-foreground">{road.road_name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground">{road.distance_km} km</span>
                  <RoadStateBadge state={road.state} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Avoided roads */}
        {result.avoidedRoads.length > 0 && (
          <div className="rounded-lg border border-border p-3">
            <p className="label-caps mb-2 flex items-center gap-1.5">
              <ShieldAlert className="h-3 w-3" />
              Hazards Avoided
            </p>
            <ul className="space-y-1">
              {result.avoidedRoads.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-muted-foreground">{r.road_name}</span>
                  <RoadStateBadge state={r.state} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Explanation */}
        <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{result.reason}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function RoutePlannerPage() {
  const { data: roads, isLoading } = useRoads();
  const { data: vehicles } = useVehicles();

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [vehicleType, setVehicleType] = useState("ambulance");
  const [emergencyType, setEmergencyType] = useState("medical_emergency");
  const [computed, setComputed] = useState(false);

  const routes = useMemo(() => {
    if (!computed || !roads || !origin || !destination || origin === destination) return [];
    return findRoutes(roads, origin, destination, vehicleType);
  }, [computed, roads, origin, destination, vehicleType]);

  function handleCompute() {
    setComputed(false);
    setTimeout(() => setComputed(true), 50);
  }

  const availableVehicles = vehicles?.filter((v) => v.status === "available") ?? [];

  return (
    <AppShell>
      <PageHeader
        title="Safe Route Planner"
        description="Hazard-aware routing using live road condition data"
      />

      <div className="p-6 space-y-6">
        {/* Disclaimer */}
        <div className="flex items-start gap-2 rounded-lg border border-moderate/40 bg-moderate-soft px-4 py-3 text-sm text-moderate-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Demo system.</strong> Routes are computed from the Nepal flood scenario road
            condition data. Always verify conditions with field teams before deployment.
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
          {/* Planner controls */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Route Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="origin">Origin</Label>
                  <Select value={origin} onValueChange={setOrigin}>
                    <SelectTrigger id="origin">
                      <SelectValue placeholder="Select origin node" />
                    </SelectTrigger>
                    <SelectContent>
                      {NODES.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="destination">Destination</Label>
                  <Select value={destination} onValueChange={setDestination}>
                    <SelectTrigger id="destination">
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {NODES.filter((n) => n !== origin).map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="veh-type">Vehicle Type</Label>
                  <Select value={vehicleType} onValueChange={setVehicleType}>
                    <SelectTrigger id="veh-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {t.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="em-type">Emergency Type</Label>
                  <Select value={emergencyType} onValueChange={setEmergencyType}>
                    <SelectTrigger id="em-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMERGENCY_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {t.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  onClick={handleCompute}
                  disabled={!origin || !destination || origin === destination || isLoading}
                >
                  <Navigation className="h-4 w-4" />
                  {isLoading ? "Loading road data…" : "Compute Safe Route"}
                </Button>
              </CardContent>
            </Card>

            {/* Available vehicles */}
            {availableVehicles.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Available Vehicles ({availableVehicles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {availableVehicles.slice(0, 5).map((v) => (
                      <li key={v.id} className="flex items-center justify-between px-4 py-2">
                        <div>
                          <p className="text-sm font-semibold">{v.code}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {v.kind.replace(/_/g, " ")} · {v.home_base ?? "—"}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs bg-safe-soft text-safe-foreground border-safe/20">
                          Available
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Road condition legend */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Road Condition Legend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  { state: "open" as const, desc: "Fully passable — no restrictions" },
                  { state: "high_risk" as const, desc: "Passable with caution — slope risk" },
                  { state: "flooded" as const, desc: "Impassable for light vehicles" },
                  { state: "landslide" as const, desc: "Blocked by debris — avoid" },
                  { state: "bridge_damaged" as const, desc: "Closed — structural damage" },
                  { state: "blocked" as const, desc: "Closed — all traffic" },
                ].map(({ state, desc }) => (
                  <div key={state} className="flex items-center justify-between gap-3">
                    <RoadStateBadge state={state} />
                    <span className="text-xs text-muted-foreground text-right">{desc}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Route results */}
          <div className="space-y-4">
            {!computed ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
                <Navigation className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Select origin and destination</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The planner will evaluate road conditions and recommend the safest route
                </p>
              </div>
            ) : isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
              </div>
            ) : routes.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-critical/30 bg-critical-soft text-center px-6">
                <AlertTriangle className="mb-3 h-8 w-8 text-critical" />
                <p className="text-sm font-semibold text-critical">No passable route found</p>
                <p className="mt-1 text-xs text-critical/80">
                  All known road segments between {origin} and {destination} are currently blocked,
                  flooded, or have landslide damage. Consider air evacuation or waiting for
                  clearance.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setComputed(false)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try different parameters
                </Button>
              </div>
            ) : (
              routes.map((r) => <RouteCard key={r.label} result={r} />)
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
