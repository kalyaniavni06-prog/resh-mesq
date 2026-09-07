import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Truck,
  MapPin,
  Clock,
  Users,
  Home,
  Navigation,
  Search,
  RefreshCw,
} from "lucide-react";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { VehicleStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useVehicles, useIncidents, type Vehicle } from "@/hooks/useSupabaseData";
import type { Database } from "@/integrations/supabase/types";

type VehicleStatus = Database["public"]["Enums"]["vehicle_status"];

export const Route = createFileRoute("/vehicles")({
  component: VehicleTrackingPage,
});

const STATUS_OPTIONS: VehicleStatus[] = [
  "available",
  "en_route",
  "on_scene",
  "returning",
  "offline",
];

const KIND_ICONS: Record<string, string> = {
  ambulance: "🚑",
  rescue_truck: "🚒",
  fire_engine: "🔥",
  rescue_boat: "⛵",
  air_ambulance: "🚁",
};

function VehicleCard({
  vehicle,
  assignedIncidentName,
  selected,
  onClick,
}: {
  vehicle: Vehicle;
  assignedIncidentName?: string | undefined;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all hover:border-primary/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card"
      }`}
      aria-pressed={selected}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5" aria-hidden="true">
          {KIND_ICONS[vehicle.kind] ?? "🚗"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-semibold text-sm text-foreground">{vehicle.code}</p>
            <VehicleStatusBadge status={vehicle.status} />
          </div>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">
            {vehicle.kind.replace(/_/g, " ")}
          </p>
          {vehicle.destination && (
            <p className="mt-1 flex items-center gap-1 text-xs text-foreground">
              <Navigation className="h-3 w-3 text-muted-foreground shrink-0" />
              {vehicle.destination}
              {vehicle.eta_minutes != null && vehicle.eta_minutes > 0 && (
                <span className="text-muted-foreground ml-1">· ETA {vehicle.eta_minutes} min</span>
              )}
            </p>
          )}
          {assignedIncidentName && (
            <p className="mt-1 text-xs text-muted-foreground truncate">
              📍 {assignedIncidentName}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function VehicleDetail({ vehicle, assignedIncidentRef }: { vehicle: Vehicle; assignedIncidentRef?: string | undefined }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-4xl" aria-hidden="true">{KIND_ICONS[vehicle.kind] ?? "🚗"}</span>
        <div>
          <h2 className="text-xl font-bold font-display">{vehicle.code}</h2>
          <p className="text-sm text-muted-foreground capitalize">{vehicle.kind.replace(/_/g, " ")}</p>
        </div>
        <VehicleStatusBadge status={vehicle.status} className="ml-auto" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="panel p-3">
          <p className="label-caps mb-1">Crew</p>
          <p className="flex items-center gap-1.5 text-xl font-bold">
            <Users className="h-4 w-4 text-muted-foreground" />
            {vehicle.crew}
          </p>
        </div>
        <div className="panel p-3">
          <p className="label-caps mb-1">Home Base</p>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Home className="h-4 w-4 text-muted-foreground" />
            {vehicle.home_base ?? "—"}
          </p>
        </div>
      </div>

      <div className="panel p-3 space-y-2">
        <p className="label-caps">Current Position</p>
        <p className="flex items-center gap-1.5 text-sm">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {vehicle.lat.toFixed(4)}, {vehicle.lng.toFixed(4)}
        </p>
      </div>

      {vehicle.destination && (
        <div className="panel p-3 space-y-2">
          <p className="label-caps">Destination</p>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Navigation className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {vehicle.destination}
          </p>
          {vehicle.eta_minutes != null && vehicle.eta_minutes > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              ETA: {vehicle.eta_minutes} minutes
            </p>
          )}
        </div>
      )}

      {assignedIncidentRef && (
        <div className="panel p-3">
          <p className="label-caps mb-1">Assigned Incident</p>
          <p className="text-sm font-mono font-medium">{assignedIncidentRef}</p>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Last updated: {new Date(vehicle.updated_at).toLocaleString()}
      </div>

      <div className="rounded-lg border border-moderate/30 bg-moderate-soft px-3 py-2 text-xs text-moderate-foreground">
        This is a demonstration system. Vehicle positions are seeded demo data and do not reflect
        real-time GPS tracking.
      </div>
    </div>
  );
}

function VehicleTrackingPage() {
  const { data: vehicles, isLoading, refetch } = useVehicles();
  const { data: incidents } = useIncidents();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<VehicleStatus | "all">("all");
  const [selected, setSelected] = useState<Vehicle | null>(null);

  const filtered = (vehicles ?? []).filter((v) => {
    const q = search.toLowerCase();
    const matchText =
      v.code.toLowerCase().includes(q) ||
      v.kind.toLowerCase().includes(q) ||
      (v.home_base ?? "").toLowerCase().includes(q) ||
      (v.destination ?? "").toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || v.status === filterStatus;
    return matchText && matchStatus;
  });

  // Build incident lookup: vehicle id -> incident reference
  const vehicleToIncident: Record<string, string> = {};
  (incidents ?? []).forEach((inc) => {
    if (inc.assigned_vehicle) {
      vehicleToIncident[inc.assigned_vehicle] = inc.reference;
    }
  });

  const available = vehicles?.filter((v) => v.status === "available").length ?? 0;
  const deployed = vehicles?.filter((v) => v.status === "en_route" || v.status === "on_scene").length ?? 0;
  const offline = vehicles?.filter((v) => v.status === "offline").length ?? 0;

  return (
    <div>
      <PageHeader
        title="Vehicle Tracking"
        description={`${vehicles?.length ?? 0} vehicles in fleet`}
      >
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </PageHeader>

      <div className="p-6 space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            <>
              <StatCard label="Total Fleet" value={vehicles?.length ?? 0} icon={<Truck className="h-5 w-5" />} />
              <StatCard label="Available" value={available} icon={<Truck className="h-5 w-5" />} variant="safe" />
              <StatCard label="Deployed" value={deployed} icon={<Navigation className="h-5 w-5" />} variant="moderate" />
              <StatCard label="Offline" value={offline} icon={<Truck className="h-5 w-5" />} />
            </>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Search by code, type, base…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as VehicleStatus | "all")}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr,360px]">
          {/* Grid */}
          <div>
            {isLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Truck className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No vehicles match your filters</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filtered.map((v) => (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    assignedIncidentName={vehicleToIncident[v.id]}
                    selected={selected?.id === v.id}
                    onClick={() => setSelected(v.id === selected?.id ? null : v)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Detail */}
          {selected && (
            <Card className="h-fit sticky top-6">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Vehicle Details</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  ✕
                </Button>
              </CardHeader>
              <CardContent>
                <VehicleDetail
                  vehicle={selected}
                  assignedIncidentRef={vehicleToIncident[selected.id]}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
