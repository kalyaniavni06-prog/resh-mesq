import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Hospital,
  MapPin,
  Route as RouteIcon,
  Siren,
  Timer,
  Truck,
} from "lucide-react";

import { PageHeader, StatCard } from "@/components/PageHeader";
import { SeverityBadge } from "@/components/SeverityBadge";
import { IncidentStatusBadge, VehicleStatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  incidentsQuery,
  vehiclesQuery,
  roadsQuery,
  alertsQuery,
  type Incident,
  type Vehicle,
} from "@/lib/queries";
import { roadStateLabel, severityOrder, timeAgo, vehicleKindLabel } from "@/lib/emergency";

export const Route = createFileRoute("/command")({
  head: () => ({
    meta: [
      { title: "Command Centre — RESH MESQ" },
      {
        name: "description",
        content:
          "Live operating picture for RESH MESQ dispatchers: open emergencies, crew availability, blocked roads, critical alerts and response-time metrics.",
      },
      { property: "og:title", content: "Command Centre — RESH MESQ" },
      {
        property: "og:description",
        content:
          "Open emergencies, available crews, blocked roads and critical alerts on one operations screen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommandCentrePage,
});

const MODULES = [
  { to: "/incidents", label: "Incidents", icon: Siren },
  { to: "/routes", label: "Safe route planner", icon: RouteIcon },
  { to: "/roads", label: "Road conditions", icon: MapPin },
  { to: "/vehicles", label: "Vehicles", icon: Truck },
  { to: "/alerts", label: "Alert centre", icon: Bell },
  { to: "/facilities", label: "Hospitals & shelters", icon: Hospital },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

/** Median minutes from report to resolution across resolved incidents. */
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
    spans.length % 2 === 0 ? ((spans[mid - 1] ?? 0) + (spans[mid] ?? 0)) / 2 : (spans[mid] ?? 0);
  return Math.round(value);
}

function CommandCentrePage() {
  const incidents = useQuery(incidentsQuery);
  const vehicles = useQuery(vehiclesQuery);
  const roads = useQuery(roadsQuery);
  const alerts = useQuery(alertsQuery);

  const incidentRows = incidents.data ?? [];
  const vehicleRows = vehicles.data ?? [];
  const roadRows = roads.data ?? [];
  const alertRows = alerts.data ?? [];

  const openIncidents = incidentRows.filter((i) => i.status !== "resolved");
  const availableVehicles = vehicleRows.filter((v) => v.status === "available");
  const activeOps = vehicleRows.filter(
    (v) => v.status === "en_route" || v.status === "on_scene",
  );
  const impassable = roadRows.filter(
    (r) => r.state === "blocked" || r.state === "bridge_damaged" || r.state === "flooded",
  );
  const criticalAlerts = alertRows.filter((a) => a.active && a.severity === "critical");
  const median = medianResolutionMinutes(incidentRows);

  const priority = [...openIncidents]
    .sort(
      (a, b) =>
        severityOrder[a.severity] - severityOrder[b.severity] ||
        b.people_affected - a.people_affected,
    )
    .slice(0, 6);

  const incidentByVehicle = new Map<string, Incident>();
  for (const inc of incidentRows) {
    if (inc.assigned_vehicle) incidentByVehicle.set(inc.assigned_vehicle, inc);
  }

  const loading =
    incidents.isLoading || vehicles.isLoading || roads.isLoading || alerts.isLoading;

  return (
    <div>
      <PageHeader
        title="Command Centre"
        description="Current operating picture, drawn live from the RESH MESQ operations database"
      >
        <Button asChild size="sm" variant="destructive">
          <Link to="/sos">
            <Siren className="h-3.5 w-3.5" />
            New SOS
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link to="/incidents">Manage incidents</Link>
        </Button>
      </PageHeader>

      <div className="space-y-5 p-5">
        {/* Key figures */}
        <section aria-label="Key figures">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active emergencies"
              value={loading ? "—" : openIncidents.length}
              sub={`${incidentRows.length} logged in total`}
              variant={openIncidents.length > 0 ? "critical" : "safe"}
              icon={<Siren className="h-4 w-4" />}
            />
            <StatCard
              label="Available vehicles"
              value={loading ? "—" : availableVehicles.length}
              sub={`${vehicleRows.length} in the fleet`}
              variant={availableVehicles.length > 0 ? "safe" : "high"}
              icon={<Truck className="h-4 w-4" />}
            />
            <StatCard
              label="Impassable roads"
              value={loading ? "—" : impassable.length}
              sub={`${roadRows.length} monitored segments`}
              variant={impassable.length > 0 ? "high" : "safe"}
              icon={<MapPin className="h-4 w-4" />}
            />
            <StatCard
              label="Critical alerts"
              value={loading ? "—" : criticalAlerts.length}
              sub={`${alertRows.filter((a) => a.active).length} active alerts`}
              variant={criticalAlerts.length > 0 ? "critical" : "safe"}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* Priority incidents */}
          <section className="panel" aria-label="Priority incidents">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="label-caps">Priority incidents</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Highest severity first, then most people affected
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/incidents">
                  All incidents
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            {loading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Loading incidents…</p>
            ) : priority.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                No open emergencies. Every logged incident is resolved.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {priority.map((incident) => (
                  <li key={incident.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={incident.severity} />
                      <IncidentStatusBadge status={incident.status} />
                      <span className="font-mono text-xs text-muted-foreground">
                        {incident.reference}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {timeAgo(incident.created_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-foreground">
                      {incident.location_name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {incident.people_affected} affected · needs{" "}
                      {incident.required_service.replace(/_/g, " ")} ·{" "}
                      {incident.road_accessible ? "road accessible" : "road not accessible"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="space-y-5">
            {/* Response metrics */}
            <section className="panel p-4" aria-label="Response-time metrics">
              <p className="label-caps">Response-time metrics</p>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Median time to resolve</dt>
                  <dd className="font-semibold tabular-nums">
                    {median === null ? "No resolved incidents yet" : `${median} min`}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Crews committed</dt>
                  <dd className="font-semibold tabular-nums">
                    {activeOps.length} / {vehicleRows.length}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Unassigned emergencies</dt>
                  <dd className="font-semibold tabular-nums">
                    {openIncidents.filter((i) => !i.assigned_vehicle).length}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Timer className="mt-0.5 h-3 w-3 shrink-0" />
                Calculated only from incidents that carry a recorded resolution time. No figure is
                estimated.
              </p>
            </section>

            {/* Active operations */}
            <section className="panel" aria-label="Active operations">
              <div className="border-b border-border px-4 py-3">
                <p className="label-caps">Active operations</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Vehicle positions and arrival times are simulated demonstration data
                </p>
              </div>
              {activeOps.length === 0 ? (
                <p className="px-4 py-5 text-sm text-muted-foreground">
                  No crews are currently committed.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {activeOps.slice(0, 6).map((vehicle: Vehicle) => {
                    const inc = incidentByVehicle.get(vehicle.id);
                    return (
                      <li key={vehicle.id} className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold">{vehicle.code}</span>
                          <VehicleStatusBadge status={vehicle.status} />
                          {vehicle.eta_minutes !== null && (
                            <Badge variant="secondary" className="ml-auto text-[10px]">
                              ETA {vehicle.eta_minutes} min
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {vehicleKindLabel(vehicle.kind)} · {vehicle.crew} crew ·{" "}
                          {vehicle.destination ?? "no destination set"}
                        </p>
                        {inc && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Assigned to {inc.reference} — {inc.location_name}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>

        {/* Blocked roads + alerts */}
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="panel" aria-label="Blocked and hazardous roads">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="label-caps">Blocked &amp; hazardous roads</p>
              <Button asChild variant="ghost" size="sm">
                <Link to="/roads">
                  Manage
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            {impassable.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted-foreground">
                Every monitored segment is currently passable.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {impassable.slice(0, 6).map((road) => (
                  <li key={road.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{road.road_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {road.from_node} → {road.to_node} · {road.distance_km} km · updated{" "}
                        {timeAgo(road.updated_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px]">
                        {roadStateLabel[road.state]}
                      </Badge>
                      <SeverityBadge severity={road.risk} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel" aria-label="Critical and high alerts">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="label-caps">Critical &amp; high alerts</p>
              <Button asChild variant="ghost" size="sm">
                <Link to="/alerts">
                  Alert centre
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
            {alertRows.filter((a) => a.active && a.severity !== "moderate" && a.severity !== "safe")
              .length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted-foreground">
                No critical or high alerts are active.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {alertRows
                  .filter((a) => a.active && (a.severity === "critical" || a.severity === "high"))
                  .slice(0, 6)
                  .map((alert) => (
                    <li key={alert.id} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={alert.severity} />
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          {alert.category.replace(/_/g, " ")}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {timeAgo(alert.issued_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">{alert.area}</p>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>

        {/* Quick navigation */}
        <section aria-label="Operational modules">
          <p className="label-caps mb-2">Operational modules</p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {MODULES.map((mod) => (
              <Link
                key={mod.to}
                to={mod.to}
                className="panel flex items-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors hover:border-primary/50"
              >
                <mod.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">{mod.label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
