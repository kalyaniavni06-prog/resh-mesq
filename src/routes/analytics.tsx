import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Activity, BarChart3, CheckCircle2, TrendingUp, Truck, AlertTriangle, MapPin, RefreshCw, WifiOff } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIncidents, useVehicles, useRoads, useAlerts } from "@/hooks/useSupabaseData";
import { format, subDays, startOfDay } from "date-fns";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

const SEV_COLORS: Record<string, string> = {
  critical: "oklch(0.55 0.22 26)", high: "oklch(0.63 0.17 44)",
  moderate: "oklch(0.76 0.14 86)", safe: "oklch(0.55 0.13 155)",
};
const STATUS_COLORS: Record<string, string> = {
  new: "oklch(0.55 0.22 26)", assigned: "oklch(0.63 0.17 44)",
  in_progress: "oklch(0.76 0.14 86)", resolved: "oklch(0.55 0.13 155)",
};
const VEH_COLORS: Record<string, string> = {
  available: "oklch(0.55 0.13 155)", en_route: "oklch(0.76 0.14 86)",
  on_scene: "oklch(0.63 0.17 44)", returning: "oklch(0.53 0.17 255)",
  offline: "oklch(0.51 0.03 258)",
};

// ── Inline error/empty state component ────────────────────────────────────────
function ChartEmpty({ message = "No data available" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-center text-muted-foreground gap-2">
      <BarChart3 className="h-6 w-6 opacity-30" aria-hidden="true" />
      <p className="text-xs">{message}</p>
    </div>
  );
}

function AnalyticsPage() {
  const { data: incidents, isLoading: liInc, error: errInc, refetch: refetchInc } = useIncidents();
  const { data: vehicles, isLoading: liVeh, error: errVeh } = useVehicles();
  const { data: roads, isLoading: liRoads, error: errRoads } = useRoads();
  const { data: alerts, isLoading: liAlerts, error: errAlerts } = useAlerts();
  const isLoading = liInc || liVeh || liRoads || liAlerts;
  const hasError = !!(errInc || errVeh || errRoads || errAlerts);

  const incBySeverity = useMemo(() => {
    const c: Record<string, number> = {};
    (incidents ?? []).forEach((i) => { c[i.severity] = (c[i.severity] ?? 0) + 1; });
    return Object.entries(c).map(([name, value]) => ({ name, value }));
  }, [incidents]);

  const incByStatus = useMemo(() => {
    const c: Record<string, number> = {};
    (incidents ?? []).forEach((i) => { c[i.status] = (c[i.status] ?? 0) + 1; });
    return Object.entries(c).map(([name, value]) => ({ name: name.replace(/_/g, " "), value, rawName: name }));
  }, [incidents]);

  const incByType = useMemo(() => {
    const c: Record<string, number> = {};
    (incidents ?? []).forEach((i) => { const t = i.incident_type.replace(/_/g, " "); c[t] = (c[t] ?? 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));
  }, [incidents]);

  const peopleByLoc = useMemo(() => {
    const c: Record<string, number> = {};
    (incidents ?? []).forEach((i) => { const loc = (i.location_name.split(",")[0] ?? i.location_name).trim(); c[loc] = (c[loc] ?? 0) + i.people_affected; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));
  }, [incidents]);

  const vehByStatus = useMemo(() => {
    const c: Record<string, number> = {};
    (vehicles ?? []).forEach((v) => { c[v.status] = (c[v.status] ?? 0) + 1; });
    return Object.entries(c).map(([name, value]) => ({ name: name.replace(/_/g, " "), value, rawName: name }));
  }, [vehicles]);

  const roadsByState = useMemo(() => {
    const c: Record<string, number> = {};
    (roads ?? []).forEach((r) => { c[r.state] = (c[r.state] ?? 0) + 1; });
    return Object.entries(c).map(([name, value]) => ({ name: name.replace(/_/g, " "), value, state: name }));
  }, [roads]);

  const alertsBySev = useMemo(() => {
    const c: Record<string, number> = {};
    (alerts ?? []).forEach((a) => { c[a.severity] = (c[a.severity] ?? 0) + 1; });
    return Object.entries(c).map(([name, value]) => ({ name, value }));
  }, [alerts]);

  // Road accessibility summary bar
  const roadAccess = useMemo(() => {
    const total = (roads ?? []).length;
    if (total === 0) return [];
    const open = (roads ?? []).filter((r) => r.state === "open").length;
    const caution = (roads ?? []).filter((r) => r.state === "high_risk").length;
    const blocked = (roads ?? []).filter((r) => !["open", "high_risk"].includes(r.state)).length;
    return [
      { name: "Open", value: open, color: SEV_COLORS["safe"] },
      { name: "Caution", value: caution, color: SEV_COLORS["moderate"] },
      { name: "Blocked", value: blocked, color: SEV_COLORS["critical"] },
    ].filter((x) => x.value > 0);
  }, [roads]);

  // ── Real incident trend from created_at timestamps ────────────────────────
  // Build last-7-days daily count from actual DB records
  const incidentTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = startOfDay(subDays(new Date(), 6 - i));
      return { date: d, label: format(d, "EEE"), count: 0 };
    });
    (incidents ?? []).forEach((inc) => {
      const day = startOfDay(new Date(inc.created_at)).getTime();
      const slot = days.find((d) => d.date.getTime() === day);
      if (slot) slot.count += 1;
    });
    return days.map(({ label, count }) => ({ day: label, count }));
  }, [incidents]);

  const hasTrendData = incidentTrend.some((d) => d.count > 0);

  const activeInc = (incidents ?? []).filter((i) => i.status !== "resolved").length;
  const resolvedInc = (incidents ?? []).filter((i) => i.status === "resolved").length;
  const totalPeople = (incidents ?? []).reduce((s, i) => s + i.people_affected, 0);
  const criticalInc = (incidents ?? []).filter((i) => i.severity === "critical").length;

  return (
    <div>
      <PageHeader title="Analytics" description="Operational metrics from the database" />

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── Global error banner ──────────────────────────────────────────── */}
        {hasError && !isLoading && (
          <div className="flex items-center gap-3 rounded-lg border border-critical/30 bg-critical-soft px-4 py-3 text-sm text-critical" role="alert">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">Some data failed to load. Charts may be incomplete.</span>
            <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={() => refetchInc()}>
              <RefreshCw className="h-3 w-3 mr-1" />Retry
            </Button>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : (
            <>
              <StatCard label="Active Incidents" value={activeInc} icon={<Activity className="h-5 w-5" />} variant="high" />
              <StatCard label="Resolved" value={resolvedInc} icon={<CheckCircle2 className="h-5 w-5" />} variant="safe" />
              <StatCard label="Total Affected" value={totalPeople} sub="across all incidents" icon={<TrendingUp className="h-5 w-5" />} variant="moderate" />
              <StatCard label="Critical" value={criticalInc} sub="immediate priority" icon={<AlertTriangle className="h-5 w-5" />} variant={criticalInc > 0 ? "critical" : "default"} />
            </>
          )}
        </div>

        {/* Road accessibility summary — visual bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Road accessibility — {(roads ?? []).length} monitored segments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? <Skeleton className="h-8" /> : roadAccess.length === 0 ? (
              <ChartEmpty message="No road data available" />
            ) : (
              <>
                <div className="flex h-6 w-full rounded-full overflow-hidden gap-px" role="img" aria-label="Road accessibility breakdown">
                  {roadAccess.map((r) => (
                    <div
                      key={r.name}
                      className="h-full transition-all"
                      style={{ width: `${(r.value / (roads ?? []).length) * 100}%`, background: r.color }}
                      title={`${r.name}: ${r.value}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  {roadAccess.map((r) => (
                    <span key={r.name} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} aria-hidden="true" />
                      <span className="font-medium">{r.name}</span>
                      <span className="text-muted-foreground">{r.value} ({Math.round((r.value / (roads ?? []).length) * 100)}%)</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Real incident trend (last 7 days from created_at) ─────────── */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm">Incidents reported — last 7 days</CardTitle>
            {!hasTrendData && <Badge variant="secondary" className="text-[10px]">No reports this week</Badge>}
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-36" /> : hasTrendData ? (
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={incidentTrend} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, "Incidents"]} />
                  <Line type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-center gap-2 text-muted-foreground">
                <TrendingUp className="h-6 w-6 opacity-30" />
                <p className="text-xs">No incidents reported in the last 7 days.</p>
                <p className="text-[10px] text-muted-foreground/70">Data will appear here as reports are submitted.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts grid */}
        <div className="grid gap-4 lg:grid-cols-2">

          {/* Severity donut */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Incidents by severity</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-48" /> : incBySeverity.length === 0 ? <ChartEmpty message="No incidents logged yet" /> : (
                <div className="flex items-center gap-4">
                  <div className="w-1/2 min-w-0">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={incBySeverity} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                          {incBySeverity.map((e) => <Cell key={e.name} fill={SEV_COLORS[e.name] ?? "#888"} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex-1 space-y-2 text-xs min-w-0">
                    {incBySeverity.map((d) => (
                      <li key={d.name} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: SEV_COLORS[d.name] ?? "#888" }} aria-hidden="true" />
                          <span className="capitalize font-medium">{d.name}</span>
                        </span>
                        <span className="font-mono font-bold">{d.value}</span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between border-t border-border pt-1 mt-1">
                      <span className="font-medium">Total</span>
                      <span className="font-mono font-bold">{(incidents ?? []).length}</span>
                    </li>
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Incident status breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-48" /> : incByStatus.length === 0 ? <ChartEmpty message="No incidents logged yet" /> : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={incByStatus} layout="vertical" margin={{ left: 4, right: 16 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {incByStatus.map((e) => <Cell key={e.rawName} fill={STATUS_COLORS[e.rawName] ?? "#888"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Resolution rate */}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Resolution rate</span>
                      <span className="font-semibold text-foreground">
                        {(incidents ?? []).length > 0 ? Math.round((resolvedInc / (incidents ?? []).length) * 100) : 0}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-safe"
                        style={{ width: `${(incidents ?? []).length > 0 ? Math.round((resolvedInc / (incidents ?? []).length) * 100) : 0}%` }}
                        role="progressbar"
                        aria-valuenow={(incidents ?? []).length > 0 ? Math.round((resolvedInc / (incidents ?? []).length) * 100) : 0}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Incident types */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Incident types</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-48" /> : incByType.length === 0 ? <ChartEmpty message="No incidents logged yet" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={incByType} layout="vertical" margin={{ left: 4, right: 16 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="value" fill="oklch(0.53 0.17 255)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* People affected by location */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">People affected — top locations</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-48" /> : peopleByLoc.length === 0 ? <ChartEmpty message="No incidents with affected persons logged" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={peopleByLoc} layout="vertical" margin={{ left: 4, right: 16 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="value" fill="oklch(0.63 0.17 44)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Fleet status donut */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Fleet status distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-48" /> : vehByStatus.length === 0 ? <ChartEmpty message="No vehicle data available" /> : (
                <div className="flex items-center gap-4">
                  <div className="w-1/2 min-w-0">
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={vehByStatus} cx="50%" cy="50%" outerRadius={70} paddingAngle={3} dataKey="value">
                          {vehByStatus.map((e, i) => (
                            <Cell key={e.rawName} fill={VEH_COLORS[e.rawName] ?? `hsl(${i * 60}, 60%, 50%)`} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2 text-xs min-w-0">
                    {vehByStatus.map((d, i) => (
                      <div key={d.rawName} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: VEH_COLORS[d.rawName] ?? `hsl(${i * 60}, 60%, 50%)` }} aria-hidden="true" />
                          <span className="capitalize">{d.name}</span>
                        </span>
                        <span className="font-mono font-bold">{d.value}</span>
                      </div>
                    ))}
                    {/* Utilization bar */}
                    <div className="pt-1 border-t border-border">
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Utilization</span>
                        <span className="font-semibold">
                          {(vehicles ?? []).length > 0 ? Math.round(((vehicles ?? []).filter((v) => v.status !== "available" && v.status !== "offline").length / (vehicles ?? []).length) * 100) : 0}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(vehicles ?? []).length > 0 ? Math.round(((vehicles ?? []).filter((v) => v.status !== "available" && v.status !== "offline").length / (vehicles ?? []).length) * 100) : 0}%` }}
                          role="progressbar"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alert severity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Alert severity distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-36" /> : alertsBySev.length === 0 ? <ChartEmpty message="No alerts in the database" /> : (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={alertsBySev} layout="vertical" margin={{ left: 4, right: 16 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={72} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {alertsBySev.map((e) => <Cell key={e.name} fill={SEV_COLORS[e.name] ?? "#888"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Road state distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Road state distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-36" /> : roadsByState.length === 0 ? <ChartEmpty message="No road data available" /> : (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={roadsByState} layout="vertical" margin={{ left: 4, right: 16 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {roadsByState.map((e) => (
                        <Cell
                          key={e.state}
                          fill={
                            e.state === "open" ? SEV_COLORS["safe"] :
                            e.state === "high_risk" ? SEV_COLORS["high"] :
                            SEV_COLORS["critical"]
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Footer note */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-[11px] text-muted-foreground">
          <span>All charts sourced from the live Supabase database. Incident trend is real data from the last 7 days.</span>
          <Link to="/command" className="text-primary hover:underline">← Back to Command Centre</Link>
        </div>

      </div>
    </div>
  );
}
