import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Search, Clock, Ruler, AlertTriangle } from "lucide-react";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { SeverityBadge } from "@/components/SeverityBadge";
import { RoadStateBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoads } from "@/hooks/useSupabaseData";
import { formatDistanceToNow } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type RoadState = Database["public"]["Enums"]["road_state"];
type Severity = Database["public"]["Enums"]["severity_level"];

export const Route = createFileRoute("/roads")({
  component: RoadConditionsPage,
});

const STATE_OPTIONS: RoadState[] = [
  "open",
  "high_risk",
  "flooded",
  "landslide",
  "bridge_damaged",
  "blocked",
];

const RISK_OPTIONS: Severity[] = ["critical", "high", "moderate", "safe"];

function RoadConditionsPage() {
  const { data: roads, isLoading } = useRoads();
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState<RoadState | "all">("all");
  const [filterRisk, setFilterRisk] = useState<Severity | "all">("all");

  const filtered = (roads ?? []).filter((r) => {
    const q = search.toLowerCase();
    const matchText =
      r.road_name.toLowerCase().includes(q) ||
      r.from_node.toLowerCase().includes(q) ||
      r.to_node.toLowerCase().includes(q);
    const matchState = filterState === "all" || r.state === filterState;
    const matchRisk = filterRisk === "all" || r.risk === filterRisk;
    return matchText && matchState && matchRisk;
  });

  const openCount = roads?.filter((r) => r.state === "open").length ?? 0;
  const blockedCount =
    roads?.filter((r) => ["flooded", "landslide", "bridge_damaged", "blocked"].includes(r.state))
      .length ?? 0;
  const highRiskCount = roads?.filter((r) => r.state === "high_risk").length ?? 0;
  const criticalRisk = roads?.filter((r) => r.risk === "critical").length ?? 0;

  return (
    <div>
      <PageHeader
        title="Road Conditions"
        description={`${roads?.length ?? 0} road segments monitored`}
      />

      <div className="p-6 space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            <>
              <StatCard
                label="Open"
                value={openCount}
                icon={<MapPin className="h-5 w-5" />}
                variant="safe"
              />
              <StatCard
                label="Blocked / Flooded"
                value={blockedCount}
                icon={<AlertTriangle className="h-5 w-5" />}
                variant={blockedCount > 0 ? "critical" : "default"}
              />
              <StatCard
                label="High Risk"
                value={highRiskCount}
                icon={<AlertTriangle className="h-5 w-5" />}
                variant={highRiskCount > 0 ? "high" : "default"}
              />
              <StatCard
                label="Critical Risk"
                value={criticalRisk}
                icon={<AlertTriangle className="h-5 w-5" />}
                variant={criticalRisk > 0 ? "critical" : "default"}
              />
            </>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Search road name or node…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={filterState}
            onValueChange={(v) => setFilterState(v as RoadState | "all")}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="All states" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {STATE_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterRisk}
            onValueChange={(v) => setFilterRisk(v as Severity | "all")}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="All risks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risks</SelectItem>
              {RISK_OPTIONS.map((r) => (
                <SelectItem key={r} value={r} className="capitalize">
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table / cards */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MapPin className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No roads match your filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((road) => (
              <Card key={road.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <RoadStateBadge state={road.state} />
                        <SeverityBadge severity={road.risk} />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">{road.road_name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {road.from_node} <span className="mx-1">→</span> {road.to_node}
                      </p>
                      {road.note && (
                        <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-l-2 border-border pl-2">
                          {road.note}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-4 text-xs text-muted-foreground sm:flex-col sm:items-end sm:gap-1.5">
                      <span className="flex items-center gap-1">
                        <Ruler className="h-3 w-3" />
                        {road.distance_km} km
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {road.base_minutes} min (clear)
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(road.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
