import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Hospital,
  Tent,
  MapPin,
  Users,
  Phone,
  Search,
  ShieldCheck,
  BedDouble,
} from "lucide-react";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useHospitals, useShelters, type Hospital as HospitalType, type Shelter } from "@/hooks/useSupabaseData";

export const Route = createFileRoute("/facilities")({
  component: FacilitiesPage,
});

function HospitalCard({ h }: { h: HospitalType }) {
  const occupancyPct = 0; // beds_available is absolute, not occupancy %
  return (
    <Card className={h.is_operational ? "" : "opacity-60"}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Hospital className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-sm font-semibold text-foreground leading-tight">{h.name}</h3>
          </div>
          <div className="flex flex-wrap gap-1 shrink-0">
            {h.trauma_center && (
              <Badge variant="outline" className="text-xs bg-safe-soft text-safe-foreground border-safe/20">
                Trauma
              </Badge>
            )}
            <Badge
              variant="outline"
              className={
                h.is_operational
                  ? "text-xs bg-safe-soft text-safe-foreground border-safe/20"
                  : "text-xs bg-muted text-muted-foreground"
              }
            >
              {h.is_operational ? "Operational" : "Closed"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{h.district}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <BedDouble className="h-3 w-3 shrink-0" />
            <span>{h.beds_available} beds available</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="font-mono">{h.lat.toFixed(4)}, {h.lng.toFixed(4)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" />
          <span>{h.contact_label}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ShelterCard({ s }: { s: Shelter }) {
  const pct = s.capacity > 0 ? Math.round((s.occupancy / s.capacity) * 100) : 0;
  const availableSpaces = s.capacity - s.occupancy;
  const statusColor =
    pct >= 90
      ? "bg-critical-soft text-critical border-critical/20"
      : pct >= 70
        ? "bg-high-soft text-high-foreground border-high/20"
        : "bg-safe-soft text-safe-foreground border-safe/20";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Tent className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-sm font-semibold text-foreground leading-tight">{s.name}</h3>
          </div>
          <div className="flex flex-wrap gap-1 shrink-0">
            <Badge variant="outline" className="text-xs capitalize">
              {s.kind.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline" className={`text-xs ${statusColor}`}>
              {pct}% full
            </Badge>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{s.occupancy} / {s.capacity} people</span>
            <span>{availableSpaces} spaces free</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct >= 90 ? "bg-critical" : pct >= 70 ? "bg-high" : "bg-safe"
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${pct}% capacity`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{s.district}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3 w-3 shrink-0" />
            <span>Cap: {s.capacity}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="font-mono">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FacilitiesPage() {
  const { data: hospitals, isLoading: loadH } = useHospitals();
  const { data: shelters, isLoading: loadS } = useShelters();
  const [tab, setTab] = useState<"hospitals" | "shelters">("hospitals");
  const [search, setSearch] = useState("");

  const filteredHospitals = (hospitals ?? []).filter((h) => {
    const q = search.toLowerCase();
    return h.name.toLowerCase().includes(q) || h.district.toLowerCase().includes(q);
  });

  const filteredShelters = (shelters ?? []).filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.district.toLowerCase().includes(q);
  });

  const operationalHospitals = hospitals?.filter((h) => h.is_operational).length ?? 0;
  const traumaCentres = hospitals?.filter((h) => h.trauma_center).length ?? 0;
  const totalBeds = hospitals?.reduce((s, h) => s + h.beds_available, 0) ?? 0;
  const totalShelterCapacity = shelters?.reduce((s, sh) => s + sh.capacity, 0) ?? 0;
  const totalOccupancy = shelters?.reduce((s, sh) => s + sh.occupancy, 0) ?? 0;
  const isLoading = loadH || loadS;

  return (
    <div>
      <PageHeader
        title="Hospitals & Shelters"
        description="Medical facilities and evacuation shelters — Nepal flood scenario"
      />

      <div className="p-6 space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            <>
              <StatCard
                label="Hospitals"
                value={operationalHospitals}
                sub={`${hospitals?.length ?? 0} total`}
                icon={<Hospital className="h-5 w-5" />}
                variant="safe"
              />
              <StatCard
                label="Trauma Centres"
                value={traumaCentres}
                icon={<ShieldCheck className="h-5 w-5" />}
              />
              <StatCard
                label="Beds Available"
                value={totalBeds}
                icon={<BedDouble className="h-5 w-5" />}
                variant="safe"
              />
              <StatCard
                label="Shelter Occupancy"
                value={`${totalOccupancy}/${totalShelterCapacity}`}
                sub={`${shelters?.length ?? 0} shelters`}
                icon={<Tent className="h-5 w-5" />}
                variant={
                  totalShelterCapacity > 0 && totalOccupancy / totalShelterCapacity >= 0.9
                    ? "critical"
                    : "moderate"
                }
              />
            </>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "hospitals" | "shelters")}>
            <TabsList>
              <TabsTrigger value="hospitals">
                Hospitals ({filteredHospitals.length})
              </TabsTrigger>
              <TabsTrigger value="shelters">
                Shelters ({filteredShelters.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Search by name or district…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 rounded-lg border border-moderate/40 bg-moderate-soft px-4 py-3 text-sm text-moderate-foreground">
          <Phone className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Demo system.</strong> Facility data is seeded for demonstration. Do not use
            contact information shown here for actual emergency calls.
          </span>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : tab === "hospitals" ? (
          filteredHospitals.length === 0 ? (
            <div className="py-20 text-center text-sm text-muted-foreground">No hospitals found</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredHospitals.map((h) => <HospitalCard key={h.id} h={h} />)}
            </div>
          )
        ) : filteredShelters.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">No shelters found</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredShelters.map((s) => <ShelterCard key={s.id} s={s} />)}
          </div>
        )}
      </div>
    </div>
  );
}
