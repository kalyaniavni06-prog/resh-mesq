import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Navigation,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Ruler,
  ShieldAlert,
  ArrowDown,
  ArrowRight,
  Info,
  Truck,
  RefreshCw,
  Zap,
} from "lucide-react";
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

const NODES = [
  "Kathmandu", "Lalitpur", "Chitwan", "Dhulikhel",
  "Morang", "Bhaktapur", "Thankot", "Chabahil", "Koshi",
];
const VEHICLE_TYPES = ["ambulance", "rescue_truck", "fire_engine", "rescue_boat", "air_ambulance"];
const EMERGENCY_TYPES = [
  "flood_rescue", "road_accident", "landslide",
  "medical_emergency", "fire", "evacuation",
];

const RISK_MULTIPLIER: Record<RoadState, number> = {
  open: 1.0, high_risk: 1.4,
  flooded: 9999, landslide: 9999, bridge_damaged: 9999, blocked: 9999,
};
const SEV_ORDER: Record<Severity, number> = { critical: 3, high: 2, moderate: 1, safe: 0 };

interface RouteResult {
  label: string;
  path: Road[];
  totalKm: number;
  etaMinutes: number;
  maxRisk: Severity;
  recommended: boolean;
  reason: string;
  avoidedRoads: Road[];
  whyReasons: { icon: "check" | "x" | "warn"; text: string }[];
}

function findRoutes(roads: Road[], origin: string, dest: string, vehicleType: string): RouteResult[] {
  const canHandleFlooded = vehicleType === "rescue_boat" || vehicleType === "air_ambulance";
  const effectiveCost = (road: Road) => {
    if (!canHandleFlooded && (road.state === "flooded" || road.state === "bridge_damaged")) return 9999;
    if (road.state === "landslide" || road.state === "blocked") return 9999;
    return road.base_minutes * RISK_MULTIPLIER[road.state];
  };
  type Edge = { road: Road; to: string };
  const graph: Record<string, Edge[]> = {};
  for (const r of roads) {
    if (!graph[r.from_node]) graph[r.from_node] = [];
    if (!graph[r.to_node]) graph[r.to_node] = [];
    graph[r.from_node]!.push({ road: r, to: r.to_node });
    graph[r.to_node]!.push({ road: r, to: r.from_node });
  }
  const allPaths: Road[][] = [];
  const dfs = (node: string, path: Road[], visited: Set<string>) => {
    if (node === dest) { allPaths.push([...path]); return; }
    if (path.length >= 5) return;
    for (const edge of graph[node] ?? []) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to); path.push(edge.road);
        dfs(edge.to, path, visited);
        path.pop(); visited.delete(edge.to);
      }
    }
  };
  dfs(origin, [], new Set([origin]));
  if (allPaths.length === 0) return [];

  const scored = allPaths.map((path) => {
    const totalCost = path.reduce((s, r) => s + effectiveCost(r), 0);
    const totalKm = path.reduce((s, r) => s + Number(r.distance_km), 0);
    const etaMinutes = path.reduce((s, r) => s + r.base_minutes, 0);
    const maxRiskNum = Math.max(...path.map((r) => SEV_ORDER[r.risk]));
    const maxRisk = (["safe", "moderate", "high", "critical"][maxRiskNum] as Severity) ?? "safe";
    const passable = totalCost < 9000;
    const avoidedRoads = roads.filter((r) => r.state !== "open" && !path.find((p) => p.id === r.id));
    return { path, totalKm, etaMinutes, maxRisk, maxRiskNum, totalCost, passable, avoidedRoads };
  });

  const passable = scored.filter((s) => s.passable).sort((a, b) => a.totalCost - b.totalCost);
  if (passable.length === 0) return [];

  const results: RouteResult[] = [];
  passable.slice(0, 4).forEach((s) => {
    if (results.length >= 2) return;
    const alreadyAdded = results.some(
      (r) => JSON.stringify(r.path.map((x) => x.id).sort()) === JSON.stringify(s.path.map((x) => x.id).sort()),
    );
    if (alreadyAdded) return;
    const isFirst = results.length === 0;
    const hasHazard = s.maxRiskNum > 0;
    const whyReasons: RouteResult["whyReasons"] = isFirst
      ? [
          { icon: "check", text: `Lowest hazard exposure (risk: ${s.maxRisk})` },
          { icon: "check", text: `Avoids ${s.avoidedRoads.length} blocked/flooded segment${s.avoidedRoads.length !== 1 ? "s" : ""}` },
          ...(hasHazard ? [] : [{ icon: "check" as const, text: "All segments currently open" }]),
          { icon: "check", text: `${s.etaMinutes} min estimated travel time` },
        ]
      : [
          { icon: "warn", text: `Higher risk exposure than recommended` },
          { icon: "check", text: `Still passable — ${s.avoidedRoads.length} hazard${s.avoidedRoads.length !== 1 ? "s" : ""} avoided` },
          { icon: "warn", text: `Longer ETA: ${s.etaMinutes} min` },
        ];

    results.push({
      label: isFirst ? "Recommended Route" : "Alternative Route",
      path: s.path,
      totalKm: Math.round(s.totalKm * 10) / 10,
      etaMinutes: s.etaMinutes,
      maxRisk: s.maxRisk,
      recommended: isFirst,
      reason: isFirst
        ? s.maxRiskNum === 0
          ? "All segments open — fastest safe corridor."
          : `Best available. Avoids ${s.avoidedRoads.length} hazardous segment${s.avoidedRoads.length !== 1 ? "s" : ""}.`
        : `Alternative path — longer but passable.`,
      avoidedRoads: s.avoidedRoads.slice(0, 4),
      whyReasons,
    });
  });
  return results;
}

// ── Step-by-step route flow diagram ──────────────────────────────────────────
function RouteFlowDiagram({ result }: { result: RouteResult }) {
  const roadStateIcon = (state: RoadState) => {
    if (state === "open") return <CheckCircle2 className="h-3.5 w-3.5 text-safe shrink-0" />;
    if (state === "high_risk") return <AlertTriangle className="h-3.5 w-3.5 text-high-foreground shrink-0" />;
    return <XCircle className="h-3.5 w-3.5 text-critical shrink-0" />;
  };

  const nodes = [result.path[0]?.from_node ?? "", ...result.path.map((r) => r.to_node)];

  return (
    <div className="flex flex-col items-center gap-0 text-xs" role="list" aria-label="Route steps">
      {nodes.map((node, i) => {
        const road = result.path[i];
        const isOrigin = i === 0;
        const isDest = i === nodes.length - 1;
        return (
          <div key={`${node}-${i}`} className="flex flex-col items-center gap-0 w-full" role="listitem">
            {/* Node */}
            <div
              className={`flex items-center justify-center rounded-full px-3 py-1 font-medium text-xs ${
                isOrigin
                  ? "bg-primary text-primary-foreground"
                  : isDest
                    ? "bg-safe text-white"
                    : "bg-secondary text-foreground border border-border"
              }`}
            >
              {isOrigin && <Navigation className="mr-1 h-3 w-3" />}
              {isDest && <CheckCircle2 className="mr-1 h-3 w-3" />}
              {node}
            </div>
            {/* Road segment */}
            {road && (
              <div className="flex flex-col items-center w-full max-w-[220px]">
                <div className="h-3 w-px bg-border" aria-hidden="true" />
                <div
                  className={`w-full rounded-md border px-3 py-1.5 flex items-center gap-2 ${
                    road.state === "open"
                      ? "border-safe/20 bg-safe-soft"
                      : road.state === "high_risk"
                        ? "border-high/20 bg-high-soft"
                        : "border-critical/20 bg-critical-soft"
                  }`}
                >
                  {roadStateIcon(road.state)}
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium truncate text-[11px] ${road.state === "open" ? "text-safe-foreground" : road.state === "high_risk" ? "text-high-foreground" : "text-critical"}`}>
                      {road.road_name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {road.distance_km} km · {road.base_minutes} min
                    </p>
                  </div>
                  <RoadStateBadge state={road.state} />
                </div>
                <div className="h-3 w-px bg-border" aria-hidden="true" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Why this route panel ──────────────────────────────────────────────────────
function WhyThisRoute({ result }: { result: RouteResult }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3 space-y-2">
      <p className="label-caps flex items-center gap-1.5">
        <Zap className="h-3 w-3 text-primary" />
        Why this route?
      </p>
      <ul className="space-y-1.5" aria-label="Route selection reasons">
        {result.whyReasons.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            {r.icon === "check" ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-safe" aria-label="Advantage" />
            ) : r.icon === "x" ? (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-critical" aria-label="Disadvantage" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-high-foreground" aria-label="Caution" />
            )}
            <span className="text-foreground">{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Side-by-side route comparison card ───────────────────────────────────────
function RouteComparisonCard({ result }: { result: RouteResult }) {
  return (
    <Card
      className={`overflow-hidden ${result.recommended ? "border-primary/50 ring-1 ring-primary/20 shadow-md" : ""}`}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {result.recommended ? (
              <CheckCircle2 className="h-4 w-4 text-safe" aria-hidden="true" />
            ) : (
              <Navigation className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
            <CardTitle className="text-sm">{result.label}</CardTitle>
            {result.recommended && (
              <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30">
                Recommended
              </Badge>
            )}
          </div>
          <SeverityBadge severity={result.maxRisk} />
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* 3 headline metrics */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Distance", value: `${result.totalKm} km`, icon: Ruler },
            { label: "ETA", value: `${result.etaMinutes} min`, icon: Clock },
            { label: "Segments", value: result.path.length, icon: ArrowRight },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg bg-secondary p-2 text-center">
              <p className="label-caps mb-0.5">{label}</p>
              <p className="flex items-center justify-center gap-1 text-sm font-bold">
                <Icon className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Step-by-step flow */}
        <div>
          <p className="label-caps mb-2">Route path</p>
          <RouteFlowDiagram result={result} />
        </div>

        {/* Why this route */}
        <WhyThisRoute result={result} />

        {/* Hazards avoided */}
        {result.avoidedRoads.length > 0 && (
          <div>
            <p className="label-caps mb-1.5 flex items-center gap-1.5">
              <ShieldAlert className="h-3 w-3" />
              Hazards avoided ({result.avoidedRoads.length})
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
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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

  const availableVehicles = vehicles?.filter((v) => v.status === "available") ?? [];

  return (
    <div>
      <PageHeader
        title="Safe Route Planner"
        description="Hazard-aware routing — Nepal flood scenario road data"
      >
        <Badge
          variant="outline"
          className="gap-1.5 border-moderate/50 bg-moderate-soft text-moderate-foreground text-[10px]"
        >
          DEMO DATA
        </Badge>
      </PageHeader>

      <div className="p-4 sm:p-6 space-y-5">

        {/* Demo note */}
        <div className="flex items-start gap-2 rounded-lg border border-moderate/40 bg-moderate-soft px-4 py-3 text-sm text-moderate-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Demo system.</strong> Routes computed from the Nepal flood scenario road
            condition data. Verify with field teams before real deployment.
          </span>
        </div>

        <div className="grid gap-5 lg:grid-cols-[300px,1fr]">

          {/* ── Controls panel ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-primary" />
                  Route Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { id: "origin", label: "Origin", value: origin, setter: setOrigin, exclude: destination },
                  { id: "dest", label: "Destination", value: destination, setter: setDestination, exclude: origin },
                ].map(({ id, label, value, setter, exclude }) => (
                  <div key={id} className="space-y-1.5">
                    <Label htmlFor={id}>{label}</Label>
                    <Select value={value} onValueChange={setter}>
                      <SelectTrigger id={id}>
                        <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {NODES.filter((n) => n !== exclude).map((n) => (
                          <SelectItem key={n} value={n}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label htmlFor="veh-type">Vehicle type</Label>
                  <Select value={vehicleType} onValueChange={setVehicleType}>
                    <SelectTrigger id="veh-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="em-type">Emergency type</Label>
                  <Select value={emergencyType} onValueChange={setEmergencyType}>
                    <SelectTrigger id="em-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EMERGENCY_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => { setComputed(false); setTimeout(() => setComputed(true), 50); }}
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
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Available ({availableVehicles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {availableVehicles.slice(0, 4).map((v) => (
                      <li key={v.id} className="flex items-center justify-between px-4 py-2">
                        <div>
                          <p className="text-xs font-semibold">{v.code}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{v.kind.replace(/_/g, " ")} · {v.home_base ?? "—"}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-safe-soft text-safe-foreground border-safe/20">Ready</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Legend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Road state legend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                {(
                  [
                    { state: "open" as RoadState, icon: CheckCircle2, color: "text-safe", desc: "Fully passable" },
                    { state: "high_risk" as RoadState, icon: AlertTriangle, color: "text-high-foreground", desc: "Passable — slope risk" },
                    { state: "flooded" as RoadState, icon: XCircle, color: "text-critical", desc: "Impassable (light vehicles)" },
                    { state: "landslide" as RoadState, icon: XCircle, color: "text-critical", desc: "Debris — avoid" },
                    { state: "bridge_damaged" as RoadState, icon: XCircle, color: "text-critical", desc: "Closed — structural damage" },
                    { state: "blocked" as RoadState, icon: XCircle, color: "text-critical", desc: "Closed — all traffic" },
                  ] as const
                ).map(({ state, icon: Icon, color, desc }) => (
                  <div key={state} className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} aria-hidden="true" />
                    <RoadStateBadge state={state} />
                    <span className="text-muted-foreground text-[10px]">{desc}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* ── Results ──────────────────────────────────────────────────────── */}
          <div className="space-y-4">
            {!computed ? (
              <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border text-center px-6">
                <Navigation className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">Select origin and destination</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The planner will evaluate all known road segments and recommend the safest corridor
                </p>
                {/* Static flow preview */}
                <div className="mt-6 flex items-center gap-1 text-[10px] text-muted-foreground">
                  {["Origin", "Roads Evaluated", "Hazards Scored", "Safe Path", "Destination"].map(
                    (s, i, arr) => (
                      <span key={s} className="flex items-center gap-1">
                        <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-foreground">{s}</span>
                        {i < arr.length - 1 && <ArrowRight className="h-3 w-3" aria-hidden="true" />}
                      </span>
                    ),
                  )}
                </div>
              </div>
            ) : isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-64 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
              </div>
            ) : routes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-critical/30 bg-critical-soft px-6 py-12 text-center">
                <XCircle className="mb-3 h-10 w-10 text-critical" aria-hidden="true" />
                <p className="text-sm font-semibold text-critical">No passable route</p>
                <p className="mt-1 text-xs text-critical/80 max-w-xs">
                  All known road segments between {origin} and {destination} are currently
                  blocked, flooded, or have landslide damage.
                </p>
                <div className="mt-4 rounded-lg border border-critical/20 bg-white/40 px-4 py-3 text-xs text-critical space-y-1">
                  <p className="font-semibold">Recommended actions:</p>
                  <p>• Request air ambulance or helicopter evacuation</p>
                  <p>• Wait for road clearance confirmation</p>
                  <p>• Contact field teams for alternate access</p>
                </div>
                <Button variant="outline" size="sm" className="mt-5" onClick={() => setComputed(false)}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try different parameters
                </Button>
              </div>
            ) : (
              <>
                {/* Route comparison header — side-by-side summary */}
                {routes.length === 2 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {routes.map((r) => (
                      <div
                        key={r.label}
                        className={`rounded-xl border p-3 ${
                          r.recommended
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-secondary/40"
                        }`}
                        aria-label={`${r.label} summary`}
                      >
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {r.recommended ? (
                            <CheckCircle2 className="h-4 w-4 text-safe" />
                          ) : (
                            <Navigation className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-semibold">{r.label}</span>
                          <SeverityBadge severity={r.maxRisk} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div>
                            <p className="label-caps">ETA</p>
                            <p className="font-bold text-base">{r.etaMinutes}m</p>
                          </div>
                          <div>
                            <p className="label-caps">Distance</p>
                            <p className="font-bold text-base">{r.totalKm}km</p>
                          </div>
                          <div>
                            <p className="label-caps">Avoided</p>
                            <p className="font-bold text-base">{r.avoidedRoads.length}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Full route cards */}
                <div className="grid gap-5 xl:grid-cols-2">
                  {routes.map((r) => (
                    <RouteComparisonCard key={r.label} result={r} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
