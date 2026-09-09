import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BedDouble, Hospital, MapPin, Phone, Search, ShieldCheck, Tent, Users, Navigation } from "lucide-react";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useHospitals, useShelters, haversineKm, type Hospital as HospitalType, type Shelter } from "@/hooks/useSupabaseData";

export const Route = createFileRoute("/facilities")({ component: FacilitiesPage });

// Reference point: Kathmandu city centre
const REF_LAT = 27.7172;
const REF_LNG = 85.324;

function CapacityBar({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;
  const color = pct >= 90 ? "bg-critical" : pct >= 70 ? "bg-high" : "bg-safe";
  return (
    <div>
      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
        <span>{label}</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${pct}%`}
        />
      </div>
    </div>
  );
}

function ETABadge({ distKm }: { distKm: number }) {
  const etaMins = Math.max(5, Math.round((distKm / 26) * 60));
  return (
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <Navigation className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`}</span>
      <span>·</span>
      <span>~{etaMins}min</span>
    </div>
  );
}

function HospitalCard({ h, dist }: { h: HospitalType; dist: number }) {
  const bedsPct = Math.max(0, Math.min(100, 100 - Math.round((h.beds_available / 40) * 100)));
  return (
    <Card className={h.is_operational ? "" : "opacity-60"}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <Hospital className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground leading-tight">{h.name}</h3>
          </div>
          <div className="flex flex-wrap gap-1 shrink-0">
            {h.trauma_center && (
              <Badge variant="outline" className="text-[10px] bg-safe-soft text-safe-foreground border-safe/20">
                ✚ Trauma
              </Badge>
            )}
            <Badge
              variant="outline"
              className={h.is_operational
                ? "text-[10px] bg-safe-soft text-safe-foreground border-safe/20"
                : "text-[10px] bg-muted text-muted-foreground"}
            >
              {h.is_operational ? "Operational" : "Closed"}
            </Badge>
          </div>
        </div>

        {/* Distance/ETA */}
        <ETABadge distKm={dist} />

        {/* Bed availability visual */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <BedDouble className="h-3 w-3" aria-hidden="true" />
              Beds available
            </span>
            <span className="font-bold text-foreground">{h.beds_available}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${h.beds_available > 20 ? "bg-safe" : h.beds_available > 5 ? "bg-moderate" : "bg-critical"}`}
              style={{ width: `${Math.min((h.beds_available / 40) * 100, 100)}%` }}
              role="progressbar"
              aria-valuenow={h.beds_available}
              aria-label={`${h.beds_available} beds available`}
            />
          </div>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{h.district} · {h.lat.toFixed(4)}, {h.lng.toFixed(4)}</span>
        </div>

        <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-[10px] text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{h.contact_label}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ShelterCard({ s, dist }: { s: Shelter; dist: number }) {
  const pct = s.capacity > 0 ? Math.round((s.occupancy / s.capacity) * 100) : 0;
  const free = s.capacity - s.occupancy;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <Tent className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground leading-tight">{s.name}</h3>
          </div>
          <div className="flex flex-wrap gap-1 shrink-0">
            <Badge variant="outline" className="text-[10px] capitalize">{s.kind.replace(/_/g, " ")}</Badge>
            <Badge
              variant="outline"
              className={`text-[10px] ${pct >= 90 ? "bg-critical-soft text-critical border-critical/20" : pct >= 70 ? "bg-high-soft text-high-foreground border-high/20" : "bg-safe-soft text-safe-foreground border-safe/20"}`}
            >
              {pct}% full
            </Badge>
          </div>
        </div>

        <ETABadge distKm={dist} />

        <CapacityBar used={s.occupancy} total={s.capacity} label={`${s.occupancy}/${s.capacity} occupied · ${free} free`} />

        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" aria-hidden="true" />
            Capacity: {s.capacity}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {s.district}
          </span>
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
  const isLoading = loadH || loadS;

  const filteredHospitals = (hospitals ?? [])
    .map((h) => ({ ...h, dist: Math.round(haversineKm(REF_LAT, REF_LNG, h.lat, h.lng) * 10) / 10 }))
    .filter((h) => {
      const q = search.toLowerCase();
      return h.name.toLowerCase().includes(q) || h.district.toLowerCase().includes(q);
    })
    .sort((a, b) => a.dist - b.dist);

  const filteredShelters = (shelters ?? [])
    .map((s) => ({ ...s, dist: Math.round(haversineKm(REF_LAT, REF_LNG, s.lat, s.lng) * 10) / 10 }))
    .filter((s) => {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.district.toLowerCase().includes(q);
    })
    .sort((a, b) => a.dist - b.dist);

  const operational = hospitals?.filter((h) => h.is_operational).length ?? 0;
  const traumaCentres = hospitals?.filter((h) => h.trauma_center).length ?? 0;
  const totalBeds = hospitals?.reduce((s, h) => s + h.beds_available, 0) ?? 0;
  const totalCapacity = shelters?.reduce((s, sh) => s + sh.capacity, 0) ?? 0;
  const totalOccupancy = shelters?.reduce((s, sh) => s + sh.occupancy, 0) ?? 0;
  const shelterPct = totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0;

  return (
    <div>
      <PageHeader title="Hospitals & Shelters" description="Medical facilities and evacuation shelters — Nepal flood scenario · sorted by distance from Kathmandu" />

      <div className="p-4 sm:p-6 space-y-5">

        {/* Demo note */}
        <div className="flex items-start gap-2 rounded-lg border border-moderate/40 bg-moderate-soft px-4 py-3 text-sm text-moderate-foreground">
          <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Facility data is sourced from the operational database. Contact labels are for reference only — always verify directly.</span>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : (
            <>
              <StatCard label="Hospitals" value={operational} sub={`${hospitals?.length ?? 0} total`} icon={<Hospital className="h-5 w-5" />} variant="safe" />
              <StatCard label="Trauma Centres" value={traumaCentres} icon={<ShieldCheck className="h-5 w-5" />} />
              <StatCard label="Beds Available" value={totalBeds} icon={<BedDouble className="h-5 w-5" />} variant="safe" />
              <StatCard
                label="Shelter Occupancy"
                value={`${shelterPct}%`}
                sub={`${totalOccupancy}/${totalCapacity} people`}
                icon={<Tent className="h-5 w-5" />}
                variant={shelterPct >= 90 ? "critical" : shelterPct >= 70 ? "high" : "moderate"}
              />
            </>
          )}
        </div>

        {/* Overall shelter capacity bar */}
        {!isLoading && totalCapacity > 0 && (
          <div className="panel p-4">
            <p className="label-caps mb-2">Overall shelter network capacity</p>
            <CapacityBar used={totalOccupancy} total={totalCapacity} label={`${totalOccupancy} of ${totalCapacity} spaces used across ${shelters?.length ?? 0} shelters`} />
          </div>
        )}

        {/* Tabs + search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "hospitals" | "shelters")}>
            <TabsList>
              <TabsTrigger value="hospitals">Hospitals ({filteredHospitals.length})</TabsTrigger>
              <TabsTrigger value="shelters">Shelters ({filteredShelters.length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input className="pl-8 h-8 text-sm" placeholder="Search by name or district…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search facilities" />
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/routes">
              <Navigation className="h-3.5 w-3.5" />
              Plan route
            </Link>
          </Button>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : tab === "hospitals" ? (
          filteredHospitals.length === 0
            ? <div className="py-16 text-center text-sm text-muted-foreground">No hospitals found</div>
            : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredHospitals.map((h) => <HospitalCard key={h.id} h={h} dist={h.dist} />)}
              </div>
        ) : (
          filteredShelters.length === 0
            ? <div className="py-16 text-center text-sm text-muted-foreground">No shelters found</div>
            : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredShelters.map((s) => <ShelterCard key={s.id} s={s} dist={s.dist} />)}
              </div>
        )}
      </div>
    </div>
  );
}
