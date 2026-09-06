import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { BarChart3, TrendingUp, Activity } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useIncidents,
  useVehicles,
  useRoads,
  useAlerts,
} from "@/hooks/useSupabaseData";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});

const SEV_COLORS: Record<string, string> = {
  critical: "oklch(0.55 0.22 26)",
  high: "oklch(0.63 0.17 44)",
  moderate: "oklch(0.76 0.14 86)",
  safe: "oklch(0.55 0.13 155)",
};

const STATUS_COLORS: Record<string, string> = {
  new: "oklch(0.55 0.22 26)",
  assigned: "oklch(0.63 0.17 44)",
  in_progress: "oklch(0.76 0.14 86)",
  resolved: "oklch(0.55 0.13 155)",
};

const VEHICLE_STATUS_COLORS: Record<string, string> = {
  available: "oklch(0.55 0.13 155)",
  en_route: "oklch(0.76 0.14 86)",
  on_scene: "oklch(0.63 0.17 44)",
  returning: "oklch(0.53 0.17 255)",
  offline: "oklch(0.51 0.03 258)",
};

function AnalyticsPage() {
  const { data: incidents, isLoading: liInc } = useIncidents();
  const { data: vehicles, isLoading: liVeh } = useVehicles();
  const { data: roads, isLoading: liRoads } = useRoads();
  const { data: alerts, isLoading: liAlerts } = useAlerts();

  const isLoading = liInc || liVeh || liRoads || liAlerts;

  // Incident severity distribution
  const incBySeverity = useMemo(() => {
    const counts: Record<string, number> = {};
    (incidents ?? []).forEach((i) => {
      counts[i.severity] = (counts[i.severity] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [incidents]);

  // Incident status distribution
  const incByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    (incidents ?? []).forEach((i) => {
      counts[i.status] = (counts[i.status] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace(/_/g, " "),
      value,
      rawName: name,
    }));
  }, [incidents]);

  // Incident by type (top 6)
  const incByType = useMemo(() => {
    const counts: Record<string, number> = {};
    (incidents ?? []).forEach((i) => {
      const t = i.incident_type.replace(/_/g, " ");
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [incidents]);

  // People affected by location (top 6)
  const peopleByLocation = useMemo(() => {
    const counts: Record<string, number> = {};
    (incidents ?? []).forEach((i) => {
      const loc = (i.location_name.split(",")[0] ?? i.location_name).trim();
      counts[loc] = (counts[loc] ?? 0) + i.people_affected;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [incidents]);

  // Vehicle status distribution
  const vehByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    (vehicles ?? []).forEach((v) => {
      counts[v.status] = (counts[v.status] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace(/_/g, " "),
      value,
      rawName: name,
    }));
  }, [vehicles]);

  // Road risk distribution
  const roadsByRisk = useMemo(() => {
    const counts: Record<string, number> = {};
    (roads ?? []).forEach((r) => {
      counts[r.risk] = (counts[r.risk] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [roads]);

  // Alert distribution by severity
  const alertsBySev = useMemo(() => {
    const counts: Record<string, number> = {};
    (alerts ?? []).forEach((a) => {
      counts[a.severity] = (counts[a.severity] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [alerts]);

  const activeInc = (incidents ?? []).filter((i) => i.status !== "resolved").length;
  const resolvedInc = (incidents ?? []).filter((i) => i.status === "resolved").length;
  const totalPeople = (incidents ?? []).reduce((s, i) => s + i.people_affected, 0);
  const avgConfidence =
    (incidents ?? []).length > 0
      ? Math.round(
          (incidents ?? []).reduce((s, i) => s + i.ai_confidence, 0) / (incidents ?? []).length,
        )
      : 0;

  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        description="Operational metrics — Nepal flood scenario (demo data)"
      />

      <div className="p-6 space-y-6">
        {/* Top KPI */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            <>
              <StatCard
                label="Active Incidents"
                value={activeInc}
                icon={<Activity className="h-5 w-5" />}
                variant="high"
              />
              <StatCard
                label="Resolved"
                value={resolvedInc}
                icon={<Activity className="h-5 w-5" />}
                variant="safe"
              />
              <StatCard
                label="Total Affected"
                value={totalPeople}
                sub="across all incidents"
                icon={<TrendingUp className="h-5 w-5" />}
                variant="moderate"
              />
              <StatCard
                label="Avg AI Confidence"
                value={`${avgConfidence}%`}
                sub="incident fusion"
                icon={<BarChart3 className="h-5 w-5" />}
              />
            </>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Incident by severity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Incidents by Severity</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={incBySeverity}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name} (${value})`}
                      labelLine={false}
                    >
                      {incBySeverity.map((entry) => (
                        <Cell key={entry.name} fill={SEV_COLORS[entry.name] ?? "#888"} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Incident by status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Incident Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={incByStatus} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {incByStatus.map((entry) => (
                        <Cell
                          key={entry.rawName}
                          fill={STATUS_COLORS[entry.rawName] ?? "#888"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* People affected by location */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">People Affected — Top Locations</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={peopleByLocation} margin={{ bottom: 40 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="oklch(0.63 0.17 44)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Incident by type */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Incident Types</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={incByType} margin={{ bottom: 40 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="oklch(0.53 0.17 255)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Vehicle status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Fleet Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={vehByStatus}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {vehByStatus.map((entry) => (
                        <Cell
                          key={entry.rawName}
                          fill={VEHICLE_STATUS_COLORS[entry.rawName] ?? "#888"}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconSize={10} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Road risk + alerts */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Road Risk Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-32" />
                ) : (
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={roadsByRisk} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={72} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {roadsByRisk.map((entry) => (
                          <Cell key={entry.name} fill={SEV_COLORS[entry.name] ?? "#888"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Alert Severity Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-32" />
                ) : (
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={alertsBySev} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={72} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {alertsBySev.map((entry) => (
                          <Cell key={entry.name} fill={SEV_COLORS[entry.name] ?? "#888"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          All data displayed is from the Nepal flood demonstration scenario. No real-time data is
          sourced from live emergency systems.
        </p>
      </div>
    </AppShell>
  );
}
