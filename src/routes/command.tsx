import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Camera,
  CheckCircle2,
  Hospital,
  MapPin,
  Navigation,
  Radio,
  Route as RouteIcon,
  Siren,
  Timer,
  Truck,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";

import { EmergencyMap } from "@/components/emergency-map";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { SeverityBadge } from "@/components/SeverityBadge";
import { IncidentStatusBadge, VehicleStatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  incidentsQuery,
  vehiclesQuery,
  roadsQuery,
  alertsQuery,
  hospitalsQuery,
  sheltersQuery,
  type Incident,
  type Vehicle,
} from "@/lib/queries";
import {
  roadStateLabel,
  severityOrder,
  severityLabel,
  timeAgo,
  vehicleKindLabel,
} from "@/lib/emergency";

export const Route = createFileRoute("/command")({
  head: () => ({
    meta: [
      { title: "Command Centre — RESH MESQ" },
      {
        name: "description",
        content:
          "Live operating picture for RESH MESQ dispatchers: open emergencies, crew availability, blocked roads, critical alerts and response-time metrics.",
      },
    ],
  }),
  component: CommandCentrePage,
});

const MODULES = [
  { to: "/incidents", label: "Incidents", icon: Siren },
  { to: "/routes", label: "Route Planner", icon: RouteIcon },
  { to: "/roads", label: "Roads", icon: MapPin },
  { to: "/vehicles", label: "Vehicles", icon: Truck },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/cctv", label: "CCTV", icon: Camera },
  { to: "/facilities", label: "Facilities", icon: Hospital },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

// ── Emergency workflow steps ──────────────────────────────────────────────────
const WORKFLOW_STEPS = [
  { label: "Incident", icon: Radio, color: "bg-critical", textColor: "text-critical" },
  { label: "Assess", icon: AlertTriangle, color: "bg-high", textColor: "text-high-foreground" },
  { label: "Assign", icon: Truck, color: "bg-moderate-foreground", textColor: "text-moderate-foreground" },
  { label: "Route", icon: RouteIcon, color: "bg-primary", textColor: "text-primary" },
  { label: "Respond", icon: Navigation, color: "bg-primary", textColor: "text-primary" },
  { label: "Resolve", icon: CheckCircle2, color: "bg-safe", textColor: "text-safe" },
] as const;

const SEV_COLORS: Record<string, string> = {
  critical: "var(--color-critical)",
  high: "var(--color-high)",
  moderate: "var(--color-moderate)",
  safe: "var(--color-safe)",
};

function medianResolutionMinutes(incidents: Incident[]): number | null {
  const spans = incidents
    .filter((i) => i.status === "resolved" && i.resolved_at)
    .map(
      (i) =>
        (new Date(i.resolved_at as string).getTime() - new Date(i.created_at).getTime()) / 60000,
    )
    .filter((m) => m > 0)
    .sort((a, b) => a - b);
  if (spans.length === 0) return null;
  const mid = Math.floor(spans.length / 2);
  const value =
    spans.length % 2 === 0
      ? ((spans[mid - 1] ?? 0) + (spans[mid] ?? 0)) / 2
      : (spans[mid] ?? 0);
  return Math.round(value);
}

// ── Smart priority score ──────────────────────────────────────────────────────
function priorityScore(inc: Incident): number {
  const sevScore = { critical: 100, high: 60, moderate: 30, safe: 5 }[inc.severity] ?? 0;
  const accessScore = inc.road_accessible ? 0 : 15;
  const peopleScore = Math.min(inc.people_affected * 2, 40);
  return sevScore + accessScore + peopleScore;
}

function PriorityBar({ score }: { score: number }) {
  const pct = Math.min(score, 155) / 155;
  const color = score >= 100 ? "bg-critical" : score >= 60 ? "bg-high" : "bg-moderate";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden" aria-hidden="true">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${Math.round(pct * 100)}%` }}
      />
    </div>
  );
}

function CommandCentrePage() {
  const incidents = useQuery(incidentsQuery);
  const vehicles = useQuery(vehiclesQuery);
  const roads = useQuery(roadsQuery);
  const alerts = useQuery(alertsQuery);
  const hospitals = useQuery(hospitalsQuery);
  const shelters = useQuery(sheltersQuery);

  const incidentRows = incidents.data ?? [];
  const vehicleRows = vehicles.data ?? [];
  const roadRows = roads.data ?? [];
  const alertRows = alerts.data ?? [];
  const hospitalRows = hospitals.data ?? [];
  const shelterRows = shelters.data ?? [];

  const openIncidents = incidentRows.filter((i) => i.status !== "resolved");
  const criticalIncidents = openIncidents.filter((i) => i.severity === "critical");
  const availableVehicles = vehicleRows.filter((v) => v.status === "available");
  const activeOps = vehicleRows.filter(
    (v) => v.status === "en_route" || v.status === "on_scene",
  );
  const impassable = roadRows.filter(
    (r) =>
      r.state === "blocked" ||
      r.state === "bridge_damaged" ||
      r.state === "flooded" ||
      r.state === "landslide",
  );
  const criticalAlerts = alertRows.filter((a) => a.active && a.severity === "critical");
  const median = medianResolutionMinutes(incidentRows);

  const priority = [...openIncidents]
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .slice(0, 6);

  const incidentByVehicle = new Map<string, Incident>();
  for (const inc of incidentRows) {
    if (inc.assigned_vehicle) incidentByVehicle.set(inc.assigned_vehicle, inc);
  }

  const loading =
    incidents.isLoading ||
    vehicles.isLoading ||
    roads.isLoading ||
    alerts.isLoading;

  // ── Charts ──────────────────────────────────────────────────────────────────
  const severityDonut = useMemo(() => {
    const counts: Record<string, number> = {};
    openIncidents.forEach((i) => {
      counts[i.severity] = (counts[i.severity] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [openIncidents]);

  const typeBar = useMemo(() => {
    const counts: Record<string, number> = {};
    openIncidents.forEach((i) => {
      const t = i.incident_type.replace(/_/g, " ");
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  }, [openIncidents]);

  const roadStateBar = useMemo(() => {
    const counts: Record<string, number> = {
      open: 0, flooded: 0, landslide: 0, bridge_damaged: 0, blocked: 0, high_risk: 0,
    };
    roadRows.forEach((r) => { counts[r.state] = (counts[r.state] ?? 0) + 1; });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name: name.replace(/_/g, " "), state: name, value }));
  }, [roadRows]);

  const fleetDonut = useMemo(() => {
    const counts: Record<string, number> = {};
    vehicleRows.forEach((v) => { counts[v.status] = (counts[v.status] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [vehicleRows]);

  const fleetColors = ["var(--color-safe)", "var(--color-moderate)", "var(--color-high)", "var(--color-muted-foreground)", "var(--color-border)"];
  const roadStateColorMap: Record<string, string> = {
    open: "var(--color-safe)", high_risk: "var(--color-high)", flooded: "var(--color-critical)",
    landslide: "var(--color-critical)", bridge_damaged: "var(--color-critical)", blocked: "var(--color-high)",
  };

  // Describe-map text for screen readers
  const mapDescription = useMemo(() => {
    const blocked = impassable.length;
    const safe = roadRows.length - blocked;
    const openCount = openIncidents.length;
    const critCount = criticalIncidents.length;
    return `${openCount} active incident${openCount !== 1 ? "s" : ""}, ${critCount} critical. ${blocked} blocked road${blocked !== 1 ? "s" : ""}, ${safe} passable. ${availableVehicles.length} vehicle${availableVehicles.length !== 1 ? "s" : ""} available, ${activeOps.length} deployed. ${criticalAlerts.length} critical alert${criticalAlerts.length !== 1 ? "s" : ""} active.`;
  }, [impassable.length, roadRows.length, openIncidents.length, criticalIncidents.length, availableVehicles.length, activeOps.length, criticalAlerts.length]);

  return (
    <div>
      <PageHeader
        title="Command Centre"
        description="Live operating picture — Nepal flood demonstration scenario"
      >
        <Badge
          variant="outline"
          className="gap-1.5 border-moderate/50 bg-moderate-soft text-moderate-foreground text-[10px]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-moderate animate-pulse" aria-hidden="true" />
          DEMO DATA
        </Badge>
        <Button asChild size="sm" variant="destructive">
          <Link to="/sos">
            <Siren className="h-3.5 w-3.5" />
            New SOS
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/incidents">Manage</Link>
        </Button>
      </PageHeader>

      <div className="space-y-5 p-4 sm:p-5">

        {/* ── KPI row ──────────────────────────────────────────────────────── */}
        <section aria-label="Key operational figures">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))
            ) : (
              <>
                <StatCard
                  label="Active incidents"
                  value={openIncidents.length}
                  sub={`${incidentRows.length} total logged`}
                  variant={openIncidents.length > 0 ? "critical" : "safe"}
                  icon={<Siren className="h-4 w-4" />}
                />
                <StatCard
                  label="Critical"
                  value={criticalIncidents.length}
                  sub="immediate response"
                  variant={criticalIncidents.length > 0 ? "critical" : "default"}
                  icon={<AlertTriangle className="h-4 w-4" />}
                />
                <StatCard
                  label="Available vehicles"
                  value={availableVehicles.length}
                  sub={`${vehicleRows.length} in fleet`}
                  variant={availableVehicles.length > 0 ? "safe" : "high"}
                  icon={<Truck className="h-4 w-4" />}
                />
                <StatCard
                  label="Active ops"
                  value={activeOps.length}
                  sub="en route / on scene"
                  variant={activeOps.length > 0 ? "moderate" : "default"}
                  icon={<Navigation className="h-4 w-4" />}
                />
                <StatCard
                  label="Blocked roads"
                  value={impassable.length}
                  sub={`of ${roadRows.length} monitored`}
                  variant={impassable.length > 0 ? "high" : "safe"}
                  icon={<MapPin className="h-4 w-4" />}
                />
                <StatCard
                  label="Critical alerts"
                  value={criticalAlerts.length}
                  sub={`${alertRows.filter((a) => a.active).length} active`}
                  variant={criticalAlerts.length > 0 ? "critical" : "safe"}
                  icon={<Bell className="h-4 w-4" />}
                />
              </>
            )}
          </div>

          {/* Screen-reader map summary */}
          <p className="sr-only" aria-live="polite">{mapDescription}</p>
        </section>

        {/* ── Emergency response workflow ──────────────────────────────────── */}
        <section
          className="panel overflow-hidden"
          aria-label="Emergency response workflow"
        >
          <div className="border-b border-border px-4 py-2.5">
            <p className="label-caps">Emergency response workflow</p>
          </div>
          <div className="flex items-center justify-between overflow-x-auto px-4 py-4 gap-1">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center shrink-0">
                <div className="flex flex-col items-center text-center w-16 sm:w-20">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${step.color} shadow-sm`}
                    aria-hidden="true"
                  >
                    <step.icon className="h-4 w-4 text-white" />
                  </div>
                  <p className="mt-1.5 text-[11px] font-semibold text-foreground">{step.label}</p>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className="mx-1 flex items-center">
                    <div className="h-px w-4 sm:w-6 bg-border" aria-hidden="true" />
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Map + priority queue ──────────────────────────────────────────── */}
        <div className="grid gap-5 xl:grid-cols-[1fr_380px]">

          {/* Emergency map */}
          <section aria-label="Emergency operations map">
            <div className="mb-2 flex items-center justify-between">
              <p className="label-caps">Operations map — Nepal flood scenario</p>
              <Badge variant="secondary" className="text-[10px]">DEMO / SIMULATED</Badge>
            </div>
            {loading ? (
              <Skeleton className="h-[22rem] rounded-xl" />
            ) : (
              <EmergencyMap
                incidents={incidentRows}
                vehicles={vehicleRows}
                hospitals={hospitalRows}
                shelters={shelterRows}
                roads={roadRows}
              />
            )}
          </section>

          {/* Priority queue */}
          <section className="panel flex flex-col" aria-label="Priority incident queue">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
              <div>
                <p className="label-caps">Priority queue</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Severity · people · road access</p>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link to="/incidents">
                  All <ArrowRight className="h-3 w-3 ml-0.5" />
                </Link>
              </Button>
            </div>

            {loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : priority.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-10 text-center">
                <div>
                  <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-safe" />
                  <p className="text-sm text-muted-foreground">All clear — no open emergencies</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border overflow-y-auto flex-1">
                {priority.map((inc, rank) => {
                  const score = priorityScore(inc);
                  return (
                    <li key={inc.id} className="px-4 py-3">
                      <div className="flex items-start gap-2.5">
                        {/* Rank badge */}
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                            rank === 0 ? "bg-critical" : rank === 1 ? "bg-high" : "bg-moderate-foreground"
                          }`}
                          aria-label={`Priority ${rank + 1}`}
                        >
                          {rank + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <SeverityBadge severity={inc.severity} />
                            <IncidentStatusBadge status={inc.status} />
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {inc.reference}
                            </span>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-foreground truncate">
                            {inc.location_name}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Users className="h-3 w-3 shrink-0" />
                            {inc.people_affected} affected
                            {!inc.road_accessible && (
                              <span className="flex items-center gap-0.5 text-critical">
                                <XCircle className="h-3 w-3" /> no road
                              </span>
                            )}
                          </div>
                          <PriorityBar score={score} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* ── Charts row ───────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* Incident severity donut */}
          <div className="panel p-4" aria-label="Incident severity distribution">
            <p className="label-caps mb-3">Severity mix</p>
            {loading || severityDonut.length === 0 ? (
              <div className="flex h-28 items-center justify-center text-xs text-muted-foreground">
                {loading ? <Skeleton className="h-24 w-24 rounded-full" /> : "No open incidents"}
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={100}>
                  <PieChart>
                    <Pie
                      data={severityDonut}
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={46}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {severityDonut.map((entry) => (
                        <Cell key={entry.name} fill={SEV_COLORS[entry.name] ?? "#888"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, severityLabel[n as string] ?? n]} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="mt-2 space-y-1" aria-label="Severity legend">
                  {severityDonut.map((d) => (
                    <li key={d.name} className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: SEV_COLORS[d.name] ?? "#888" }}
                          aria-hidden="true"
                        />
                        <span className="capitalize">{d.name}</span>
                      </span>
                      <span className="font-mono font-semibold">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Incident types bar */}
          <div className="panel p-4" aria-label="Incident types">
            <p className="label-caps mb-3">Incident types</p>
            {loading || typeBar.length === 0 ? (
              <Skeleton className="h-24" />
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={typeBar} layout="vertical" margin={{ left: 0, right: 12 }}>
                  <XAxis type="number" tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={68} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Road conditions bar */}
          <div className="panel p-4" aria-label="Road condition summary">
            <p className="label-caps mb-3">Road conditions</p>
            {loading || roadStateBar.length === 0 ? (
              <Skeleton className="h-24" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={roadStateBar} layout="vertical" margin={{ left: 0, right: 12 }}>
                    <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={68} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                      {roadStateBar.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={roadStateColorMap[entry.state] ?? "var(--color-muted-foreground)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {roadRows.filter((r) => r.state === "open").length} of {roadRows.length} open
                </p>
              </>
            )}
          </div>

          {/* Fleet status donut */}
          <div className="panel p-4" aria-label="Fleet status">
            <p className="label-caps mb-3">Fleet status</p>
            {loading || fleetDonut.length === 0 ? (
              <Skeleton className="h-24" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={100}>
                  <PieChart>
                    <Pie
                      data={fleetDonut}
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={46}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {fleetDonut.map((entry, i) => (
                        <Cell key={entry.name} fill={fleetColors[i % fleetColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="mt-2 space-y-1">
                  {fleetDonut.map((d, i) => (
                    <li key={d.name} className="flex items-center justify-between text-[10px]">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: fleetColors[i % fleetColors.length] }}
                          aria-hidden="true"
                        />
                        <span className="capitalize">{d.name}</span>
                      </span>
                      <span className="font-mono font-semibold">{d.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {/* ── Active ops + metrics row ──────────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr_auto]">

          {/* Active operations */}
          <section className="panel" aria-label="Active operations">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="label-caps">Active operations</p>
              <Badge variant="secondary" className="text-[10px]">SIMULATED POSITIONS</Badge>
            </div>
            {activeOps.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted-foreground">No crews currently deployed.</p>
            ) : (
              <ul className="divide-y divide-border">
                {activeOps.slice(0, 5).map((vehicle: Vehicle) => {
                  const inc = incidentByVehicle.get(vehicle.id);
                  return (
                    <li key={vehicle.id} className="flex items-start gap-3 px-4 py-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                        {vehicle.code.slice(0, 3)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-semibold">{vehicle.code}</span>
                          <VehicleStatusBadge status={vehicle.status} />
                          {vehicle.eta_minutes != null && (
                            <Badge variant="outline" className="text-[10px] ml-auto">
                              ETA {vehicle.eta_minutes} min
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {vehicleKindLabel(vehicle.kind)} · {vehicle.crew} crew
                          {vehicle.destination ? ` → ${vehicle.destination}` : ""}
                        </p>
                        {inc && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {inc.reference} — {inc.location_name}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Blocked roads */}
          <section className="panel" aria-label="Blocked and hazardous roads">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="label-caps">Blocked &amp; hazardous roads</p>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link to="/roads">
                  All <ArrowRight className="h-3 w-3 ml-0.5" />
                </Link>
              </Button>
            </div>
            {impassable.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-5 text-sm text-safe-foreground">
                <CheckCircle2 className="h-4 w-4" />
                All monitored segments passable
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {impassable.slice(0, 5).map((road) => (
                  <li key={road.id} className="flex items-start gap-3 px-4 py-2.5">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{road.road_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {road.from_node} → {road.to_node} · {roadStateLabel[road.state]}
                      </p>
                    </div>
                    <SeverityBadge severity={road.risk} className="shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Response metrics panel */}
          <section className="panel p-4 min-w-[200px]" aria-label="Response time metrics">
            <p className="label-caps mb-4">Response metrics</p>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-[10px] label-caps text-muted-foreground">Median resolution</dt>
                <dd className="mt-1 text-2xl font-bold font-display tabular-nums">
                  {median === null ? "—" : `${median}m`}
                </dd>
                <dd className="text-[10px] text-muted-foreground">
                  {median === null ? "No resolved incidents" : "minutes (demo data)"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] label-caps text-muted-foreground">Crews committed</dt>
                <dd className="mt-1 text-2xl font-bold font-display">
                  {activeOps.length}
                  <span className="text-base text-muted-foreground font-normal">
                    /{vehicleRows.length}
                  </span>
                </dd>
                <div className="mt-1 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: vehicleRows.length > 0
                        ? `${Math.round((activeOps.length / vehicleRows.length) * 100)}%`
                        : "0%",
                    }}
                    aria-hidden="true"
                  />
                </div>
              </div>
              <div>
                <dt className="text-[10px] label-caps text-muted-foreground">Unassigned</dt>
                <dd className="mt-1 text-2xl font-bold font-display text-critical">
                  {openIncidents.filter((i) => !i.assigned_vehicle).length}
                </dd>
                <dd className="text-[10px] text-muted-foreground">incidents need vehicle</dd>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-start gap-1">
                <Timer className="mt-0.5 h-3 w-3 shrink-0" />
                From incidents with recorded resolution time only.
              </p>
            </dl>
          </section>
        </div>

        {/* ── Critical alerts ───────────────────────────────────────────────── */}
        <section className="panel" aria-label="Critical and high severity alerts">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="label-caps">Critical &amp; high alerts</p>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
              <Link to="/alerts">
                Alert centre <ArrowRight className="h-3 w-3 ml-0.5" />
              </Link>
            </Button>
          </div>
          {alertRows.filter(
            (a) => a.active && (a.severity === "critical" || a.severity === "high"),
          ).length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-5 text-sm text-safe-foreground">
              <CheckCircle2 className="h-4 w-4" />
              No critical or high alerts active
            </div>
          ) : (
            <ul className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
              {alertRows
                .filter((a) => a.active && (a.severity === "critical" || a.severity === "high"))
                .slice(0, 6)
                .map((alert) => (
                  <li key={alert.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityBadge severity={alert.severity} />
                      <span className="label-caps">{alert.category.replace(/_/g, " ")}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                        {timeAgo(alert.issued_at)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.area}</p>
                  </li>
                ))}
            </ul>
          )}
        </section>

        {/* ── Quick nav ─────────────────────────────────────────────────────── */}
        <section aria-label="Operational modules">
          <p className="label-caps mb-2">All modules</p>
          <div className="grid gap-2 grid-cols-4 sm:grid-cols-4 lg:grid-cols-8">
            {MODULES.map((mod) => (
              <Link
                key={mod.to}
                to={mod.to}
                className="panel flex flex-col items-center gap-1.5 px-2 py-3 text-center transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <mod.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="text-[10px] font-medium text-foreground leading-tight">{mod.label}</span>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
