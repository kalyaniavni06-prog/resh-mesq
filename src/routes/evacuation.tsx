import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Home,
  Hospital,
  Info,
  MapPin,
  Navigation,
  Route as RouteIcon,
  ShieldAlert,
  Tent,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoads, useHospitals, useShelters, haversineKm } from "@/hooks/useSupabaseData";
import type { Database } from "@/integrations/supabase/types";

type RoadState = Database["public"]["Enums"]["road_state"];
type Severity = Database["public"]["Enums"]["severity_level"];

export const Route = createFileRoute("/evacuation")({
  head: () => ({
    meta: [
      { title: "Safe Evacuation — RESH MESQ" },
      {
        name: "description",
        content:
          "Find the safest evacuation corridor from your area, with nearby shelters and hospitals shown on a real map.",
      },
    ],
  }),
  component: EvacuationPage,
});

// Real OpenStreetMap map — lazy loaded (Leaflet touches window at import time)
const EvacuationMapCanvas = lazy(() => import("@/components/evacuation-map-canvas"));

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted rounded-xl">
      <p className="text-xs text-muted-foreground">Loading map…</p>
    </div>
  );
}

// Reuse the route-finding logic from routes.tsx (same DFS engine)
const SEV_ORDER: Record<Severity, number> = { critical: 3, high: 2, moderate: 1, safe: 0 };
const RISK_MULTIPLIER: Record<RoadState, number> = {
  open: 1.0, high_risk: 1.4,
  flooded: 9999, landslide: 9999, bridge_damaged: 9999, blocked: 9999,
};

type Road = ReturnType<typeof useRoads>["data"] extends (infer R)[] | undefined ? R : never;

interface EvacRoute {
  path: Road[];
  nodes: string[];
  totalKm: number;
  etaMinutes: number;
  maxRisk: Severity;
  passable: boolean;
  avoidedCount: number;
}

function findEvacRoutes(roads: Road[], origin: string, dest: string): EvacRoute[] {
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
    if (path.length >= 6) return;
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
    const totalCost = path.reduce((s, r) => s + (r.base_minutes * RISK_MULTIPLIER[r.state]), 0);
    const totalKm = path.reduce((s, r) => s + Number(r.distance_km), 0);
    const etaMinutes = path.reduce((s, r) => s + r.base_minutes, 0);
    const maxRiskNum = Math.max(...path.map((r) => SEV_ORDER[r.risk]));
    const maxRisk = (["safe", "moderate", "high", "critical"][maxRiskNum] as Severity) ?? "safe";
    const passable = totalCost < 9000;
    const nodes = [path[0]?.from_node ?? origin, ...path.map((r) => r.to_node)];
    const avoidedCount = roads.filter((r) => r.state !== "open" && !path.find((p) => p.id === r.id)).length;
    return { path, nodes, totalKm: Math.round(totalKm * 10) / 10, etaMinutes, maxRisk, passable, avoidedCount };
  });
  return scored.filter((s) => s.passable).sort((a, b) => {
    const rA = SEV_ORDER[a.maxRisk]; const rB = SEV_ORDER[b.maxRisk];
    if (rA !== rB) return rA - rB;
    return a.totalKm - b.totalKm;
  }).slice(0, 2);
}

const NODES = ["Kathmandu", "Lalitpur", "Chitwan", "Dhulikhel", "Morang", "Bhaktapur", "Thankot", "Chabahil", "Koshi"];

const HAZARD_ICONS: Record<string, string> = {
  flood: "🌊", landslide: "⛰️", bridge_damage: "🏗️", weather: "🌧️", accessibility: "🚧",
};

function EvacuationPage() {
  const { data: roads, isLoading: loadRoads } = useRoads();
  const { data: hospitals } = useHospitals();
  const { data: shelters } = useShelters();

  const [origin, setOrigin] = useState("");
  const [computed, setComputed] = useState(false);

  const routes = useMemo(() => {
    if (!computed || !roads || !origin) return [];
    // Find routes to all possible destinations, pick best per destination
    const results: Array<{ dest: string; route: EvacRoute }> = [];
    for (const dest of NODES.filter((n) => n !== origin)) {
      const found = findEvacRoutes(roads, origin, dest);
      if (found.length > 0 && found[0]) results.push({ dest, route: found[0] });
    }
    // Return top 3 safest + fastest
    return results.sort((a, b) => {
      const rA = SEV_ORDER[a.route.maxRisk]; const rB = SEV_ORDER[b.route.maxRisk];
      if (rA !== rB) return rA - rB;
      return a.route.etaMinutes - b.route.etaMinutes;
    }).slice(0, 3);
  }, [computed, roads, origin]);

  const bestRoute = routes[0];

  // Nearest open shelters and hospitals to origin node
  const originCoords = useMemo(() => {
    const NODE_COORDS: Record<string, [number, number]> = {
      Kathmandu: [27.7172, 85.324], Lalitpur: [27.6644, 85.3188], Bhaktapur: [27.671, 85.4298],
      Thankot: [27.6939, 85.2075], Chabahil: [27.7189, 85.3455], Dhulikhel: [27.6193, 85.539],
      Chitwan: [27.5291, 84.3542], Morang: [26.66, 87.28], Koshi: [26.51, 87.15],
    };
    return NODE_COORDS[origin] ?? null;
  }, [origin]);

  const nearbyShelters = useMemo(() => {
    if (!originCoords || !shelters) return [];
    return shelters
      .filter((s) => s.occupancy < s.capacity)
      .map((s) => ({ ...s, dist: haversineKm(originCoords[0], originCoords[1], s.lat, s.lng) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);
  }, [shelters, originCoords]);

  const nearbyHospitals = useMemo(() => {
    if (!originCoords || !hospitals) return [];
    return hospitals
      .filter((h) => h.is_operational)
      .map((h) => ({ ...h, dist: haversineKm(originCoords[0], originCoords[1], h.lat, h.lng) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2);
  }, [hospitals, originCoords]);

  const blockedRoads = (roads ?? []).filter((r) => r.state !== "open" && r.state !== "high_risk");
  const isLoading = loadRoads;

  // Evacuation flow steps for voice announcement
  const flowSummary = bestRoute
    ? `Evacuation corridor from ${origin} to ${bestRoute.dest}. ${bestRoute.route.etaMinutes} minutes. Risk level: ${bestRoute.route.maxRisk}. ${bestRoute.route.avoidedCount} hazards avoided.`
    : "";

  return (
    <div>
      <PageHeader
        title="Safe Evacuation"
        description="Find the safest evacuation corridor from your current area"
      >
        <Badge variant="outline" className="gap-1.5 border-moderate/50 bg-moderate-soft text-moderate-foreground text-[10px]">
          NEPAL FLOOD DEMO DATA
        </Badge>
      </PageHeader>

      {/* Screen reader live summary */}
      {flowSummary && (
        <p className="sr-only" role="status" aria-live="polite">{flowSummary}</p>
      )}

      <div className="p-4 sm:p-6 space-y-5">

        {/* Demo notice */}
        <div className="flex items-start gap-2 rounded-lg border border-moderate/40 bg-moderate-soft px-4 py-3 text-sm text-moderate-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Demo system.</strong> Road conditions, facility data and route suggestions
            are from the Nepal flood demonstration scenario. Verify with local authorities before acting.
          </span>
        </div>

        {/* Evacuation visual workflow */}
        <section className="panel overflow-hidden" aria-label="Evacuation process workflow">
          <div className="border-b border-border px-4 py-2.5">
            <p className="label-caps">Evacuation process</p>
          </div>
          <div className="flex flex-wrap items-center gap-1 justify-center px-4 py-4">
            {[
              { icon: ShieldAlert, label: "Hazard", color: "bg-critical", sub: "Alert detected" },
              { icon: MapPin, label: "Your area", color: "bg-high", sub: "Origin confirmed" },
              { icon: RouteIcon, label: "Safe corridor", color: "bg-primary", sub: "Route computed" },
              { icon: Navigation, label: "Move now", color: "bg-moderate-foreground", sub: "Follow route" },
              { icon: Tent, label: "Shelter", color: "bg-safe", sub: "Register on arrival" },
              { icon: Hospital, label: "Hospital", color: "bg-safe", sub: "If medical needed" },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center shrink-0">
                <div className="flex flex-col items-center text-center w-16 sm:w-20">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${step.color} shadow-sm`} aria-hidden="true">
                    <step.icon className="h-4 w-4 text-white" />
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-foreground">{step.label}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{step.sub}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="mx-0.5 hidden sm:flex items-center">
                    <div className="h-px w-3 bg-border" aria-hidden="true" />
                    <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Origin selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" aria-hidden="true" />
              Your current location
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-40 space-y-1.5">
              <Label htmlFor="evac-origin">Select your nearest node</Label>
              <Select value={origin} onValueChange={setOrigin}>
                <SelectTrigger id="evac-origin">
                  <SelectValue placeholder="Select your area…" />
                </SelectTrigger>
                <SelectContent>
                  {NODES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => { setComputed(false); setTimeout(() => setComputed(true), 50); }}
                disabled={!origin || isLoading}
                className="gap-2"
              >
                <Navigation className="h-4 w-4" />
                {isLoading ? "Loading…" : "Find safe corridors"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main grid: map + results */}
        {computed && (
          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">

            {/* Real OpenStreetMap */}
            <section aria-label="Evacuation route map">
              <div className="mb-2 flex items-center justify-between">
                <p className="label-caps">Route map — OpenStreetMap</p>
                <Badge variant="secondary" className="text-[10px]">REAL MAP · DEMO ROUTE DATA</Badge>
              </div>
              <div className="h-[420px] rounded-xl overflow-hidden border border-border">
                <ClientOnly fallback={<MapSkeleton />}>
                  <Suspense fallback={<MapSkeleton />}>
                    <EvacuationMapCanvas
                      originCoords={originCoords}
                      routes={routes.map((r) => r.route)}
                      shelters={nearbyShelters}
                      hospitals={nearbyHospitals}
                    />
                  </Suspense>
                </ClientOnly>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a> contributors · Map tiles via OSM tile servers · Route data: DEMO scenario
              </p>
            </section>

            {/* Route + facilities panel */}
            <div className="space-y-4">

              {/* Safe corridors */}
              <section aria-label="Safe evacuation corridors">
                <p className="label-caps mb-2">Safe corridors from {origin}</p>
                {routes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-critical/30 bg-critical-soft px-4 py-8 text-center">
                    <XCircle className="mb-2 h-8 w-8 text-critical" aria-hidden="true" />
                    <p className="text-sm font-semibold text-critical">No safe corridors found</p>
                    <p className="mt-1 text-xs text-critical/80">All routes blocked. Contact emergency services immediately.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {routes.map(({ dest, route }, i) => (
                      <div
                        key={dest}
                        className={`rounded-xl border p-3 ${i === 0 ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}
                        role="article"
                        aria-label={`Corridor to ${dest}: ${route.etaMinutes} minutes, risk ${route.maxRisk}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {i === 0 ? (
                              <CheckCircle2 className="h-4 w-4 text-safe shrink-0" aria-hidden="true" />
                            ) : (
                              <Navigation className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                            )}
                            <span className="text-sm font-semibold">→ {dest}</span>
                            {i === 0 && <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30">Recommended</Badge>}
                          </div>
                          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                            route.maxRisk === "critical" ? "bg-critical-soft text-critical border-critical/20"
                            : route.maxRisk === "high" ? "bg-high-soft text-high-foreground border-high/20"
                            : route.maxRisk === "moderate" ? "bg-moderate-soft text-moderate-foreground border-moderate/20"
                            : "bg-safe-soft text-safe-foreground border-safe/20"
                          }`}>
                            Risk: {route.maxRisk}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                          <div className="rounded-md bg-secondary p-2 text-center">
                            <p className="label-caps">ETA</p>
                            <p className="font-bold">{route.etaMinutes}m</p>
                          </div>
                          <div className="rounded-md bg-secondary p-2 text-center">
                            <p className="label-caps">Distance</p>
                            <p className="font-bold">{route.totalKm}km</p>
                          </div>
                          <div className="rounded-md bg-secondary p-2 text-center">
                            <p className="label-caps">Avoided</p>
                            <p className="font-bold">{route.avoidedCount}</p>
                          </div>
                        </div>
                        {/* Path nodes */}
                        <div className="flex flex-wrap items-center gap-1 text-[10px]">
                          {route.nodes.map((n, ni) => (
                            <span key={ni} className="flex items-center gap-0.5">
                              <span className="rounded bg-secondary px-1.5 py-0.5 font-medium">{n}</span>
                              {ni < route.nodes.length - 1 && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" aria-hidden="true" />}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Nearest shelters */}
              {nearbyShelters.length > 0 && (
                <section aria-label="Nearest open shelters">
                  <p className="label-caps mb-2 flex items-center gap-1.5">
                    <Tent className="h-3 w-3" />
                    Nearest open shelters
                  </p>
                  <div className="space-y-2">
                    {nearbyShelters.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 rounded-lg border border-safe/20 bg-safe-soft px-3 py-2">
                        <Tent className="h-4 w-4 text-safe shrink-0" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground">{s.district} · {s.dist.toFixed(1)}km · {s.capacity - s.occupancy} spaces free</p>
                        </div>
                        <span className="text-[10px] font-mono text-safe-foreground shrink-0">~{Math.max(5, Math.round((s.dist / 26) * 60))}min</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Nearest hospitals */}
              {nearbyHospitals.length > 0 && (
                <section aria-label="Nearest operational hospitals">
                  <p className="label-caps mb-2 flex items-center gap-1.5">
                    <Hospital className="h-3 w-3" />
                    Nearest hospitals
                  </p>
                  <div className="space-y-2">
                    {nearbyHospitals.map((h) => (
                      <div key={h.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                        <Hospital className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{h.name}</p>
                          <p className="text-[10px] text-muted-foreground">{h.district} · {h.dist.toFixed(1)}km · {h.beds_available} beds</p>
                        </div>
                        <span className="text-[10px] font-mono shrink-0">~{Math.max(5, Math.round((h.dist / 26) * 60))}min</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Blocked roads summary */}
              {blockedRoads.length > 0 && (
                <section aria-label="Blocked and hazardous roads to avoid">
                  <p className="label-caps mb-2 flex items-center gap-1.5">
                    <XCircle className="h-3 w-3 text-critical" />
                    Roads to avoid
                  </p>
                  <ul className="space-y-1.5">
                    {blockedRoads.slice(0, 5).map((r) => (
                      <li key={r.id} className="flex items-center gap-2 rounded-md border border-critical/20 bg-critical-soft px-3 py-1.5 text-xs text-critical">
                        <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate font-medium">{r.road_name}</span>
                        <span className="ml-auto shrink-0 capitalize text-[10px]">{r.state.replace(/_/g, " ")}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        )}

        {/* Pre-compute empty state */}
        {!computed && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center px-6">
            <Navigation className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Select your location to begin</p>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs">
              The system will evaluate road conditions and suggest the safest evacuation corridors from your area.
            </p>
            {/* Static visual flow */}
            <div className="mt-6 flex flex-col items-center gap-0 text-[10px] text-muted-foreground" aria-hidden="true">
              {[
                { icon: ShieldAlert, label: "Hazard zone" },
                { icon: XCircle, label: "Blocked roads removed" },
                { icon: CheckCircle2, label: "Safe corridors found" },
                { icon: Tent, label: "Shelter located" },
              ].map((s, i, arr) => (
                <div key={s.label} className="flex flex-col items-center">
                  <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5">
                    <s.icon className="h-3.5 w-3.5" />
                    <span className="font-medium">{s.label}</span>
                  </div>
                  {i < arr.length - 1 && <ArrowDown className="h-3.5 w-3.5 my-0.5 text-border" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
