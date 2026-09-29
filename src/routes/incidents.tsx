import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Filter,
  FlaskConical,
  GitMerge,
  Hospital,
  MapPin,
  Navigation,
  Plus,
  Radio,
  Route as RouteIcon,
  Search,
  Siren,
  Tent,
  Truck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { SeverityBadge, SeverityDot } from "@/components/SeverityBadge";
import { IncidentStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useIncidents,
  useVehicles,
  useCreateIncident,
  useUpdateIncident,
  useRoads,
  haversineKm,
  type Incident,
} from "@/hooks/useSupabaseData";
import { useDemoMode } from "@/lib/demo-mode";
import { useRole } from "@/hooks/use-role";
import { SCENARIO_INCIDENTS, isScenarioIncident } from "@/lib/scenario-incidents";
import type { Database } from "@/integrations/supabase/types";
import { formatDistanceToNow, format } from "date-fns";
import { hospitalsQuery, sheltersQuery } from "@/lib/queries";

type Severity = Database["public"]["Enums"]["severity_level"];
type IncidentStatus = Database["public"]["Enums"]["incident_status"];

export const Route = createFileRoute("/incidents")({
  component: IncidentsPage,
});

// ── Constants ─────────────────────────────────────────────────────────────────
const SEVERITY_OPTIONS: Severity[] = ["critical", "high", "moderate", "safe"];
const STATUS_OPTIONS: IncidentStatus[] = ["new", "assigned", "in_progress", "resolved"];
const INCIDENT_TYPES = [
  "flood_rescue",
  "road_accident",
  "landslide",
  "medical_emergency",
  "fire",
  "bridge_failure",
  "evacuation",
  "other",
];
const SERVICE_TYPES = ["ambulance", "rescue_team", "fire_engine", "police", "medical_team", "all"];

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  flood_rescue: "Flood / Rescue",
  road_accident: "Road Accident",
  landslide: "Landslide",
  medical_emergency: "Medical Emergency",
  fire: "Fire",
  bridge_failure: "Bridge Failure",
  evacuation: "Evacuation",
  other: "Other",
};

const INCIDENT_TYPE_ICONS: Record<string, string> = {
  flood_rescue: "🌊",
  road_accident: "🚗",
  landslide: "⛰️",
  medical_emergency: "🏥",
  fire: "🔥",
  bridge_failure: "🌉",
  evacuation: "🏃",
  other: "🆘",
};

const EMPTY_FORM = {
  incident_type: "flood_rescue",
  location_name: "",
  lat: 27.7,
  lng: 85.32,
  severity: "high" as Severity,
  people_affected: 1,
  road_accessible: true,
  required_service: "ambulance",
  status: "new" as IncidentStatus,
  summary: "",
};

// ── Readable status labels (for the workflow stepper) ─────────────────────────
export const STATUS_STEPS: { status: IncidentStatus; label: string; desc: string }[] = [
  { status: "new",         label: "Reported",          desc: "Report logged" },
  { status: "assigned",    label: "Response Assigned",  desc: "Team dispatched" },
  { status: "in_progress", label: "Rescue In Progress", desc: "On scene" },
  { status: "resolved",    label: "Resolved",           desc: "Incident closed" },
];

// ── Response workflow stepper ─────────────────────────────────────────────────
function WorkflowStepper({ status }: { status: IncidentStatus }) {
  const currentIdx = STATUS_STEPS.findIndex((s) => s.status === status);
  return (
    <div className="w-full" aria-label={`Response workflow — current step: ${STATUS_STEPS[currentIdx]?.label}`}>
      <div className="flex items-start">
        {STATUS_STEPS.map((step, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step.status} className="flex flex-1 flex-col items-center text-center relative">
              {/* Connector */}
              {i < STATUS_STEPS.length - 1 && (
                <div
                  className={`absolute left-1/2 top-4 h-px w-full ${done && i < currentIdx ? "bg-safe" : "bg-border"}`}
                  aria-hidden="true"
                />
              )}
              {/* Circle */}
              <div
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : done
                    ? "bg-safe text-white border-safe"
                    : "bg-card text-muted-foreground border-border"
                }`}
                aria-current={active ? "step" : undefined}
              >
                {done && !active ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <p className={`mt-1.5 text-[10px] font-semibold leading-tight px-0.5 ${active ? "text-primary" : done ? "text-safe-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Scenario chip ────────────────────────────────────────────────────────────
function ScenarioChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-moderate/30 bg-moderate-soft px-2 py-0.5 text-[10px] font-medium text-moderate-foreground">
      <FlaskConical className="h-2.5 w-2.5" aria-hidden="true" />
      Scenario
    </span>
  );
}

// ── Details sheet ─────────────────────────────────────────────────────────────
function IncidentDetailSheet({
  incident,
  vehicles,
  onEdit,
  onClose,
  canManage,
}: {
  incident: Incident;
  vehicles: ReturnType<typeof useVehicles>["data"];
  onEdit: () => void;
  onClose: () => void;
  canManage: boolean;
}) {
  const updateMutation = useUpdateIncident();
  const { data: hospitals } = useQuery(hospitalsQuery);
  const { data: shelters } = useQuery(sheltersQuery);
  const { data: roads } = useRoads();

  const assignedVehicle = vehicles?.find((v) => v.id === incident.assigned_vehicle);
  const isScenario = isScenarioIncident(incident.id);

  // Nearest hospital by haversine
  const nearestHospital = useMemo(() => {
    if (!hospitals) return null;
    return hospitals
      .filter((h) => h.is_operational)
      .map((h) => ({ ...h, dist: haversineKm(incident.lat, incident.lng, h.lat, h.lng) }))
      .sort((a, b) => a.dist - b.dist)[0] ?? null;
  }, [hospitals, incident.lat, incident.lng]);

  // Nearest open shelter
  const nearestShelter = useMemo(() => {
    if (!shelters) return null;
    return shelters
      .filter((s) => s.occupancy < s.capacity)
      .map((s) => ({ ...s, dist: haversineKm(incident.lat, incident.lng, s.lat, s.lng) }))
      .sort((a, b) => a.dist - b.dist)[0] ?? null;
  }, [shelters, incident.lat, incident.lng]);

  // Nearest blocked road
  const nearestBlockedRoad = useMemo(() => {
    if (!roads) return null;
    return roads
      .filter((r) => r.state !== "open" && r.state !== "high_risk")
      .slice(0, 3);
  }, [roads]);

  async function handleStatusChange(status: IncidentStatus) {
    if (isScenario) {
      toast.info("Scenario incidents cannot be updated — they are read-only sample data.");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: incident.id,
        updates: {
          status,
          ...(status === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
        },
      });
      toast.success(`Status → ${STATUS_STEPS.find((s) => s.status === status)?.label}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update status";
      toast.error(msg);
    }
  }

  const nextStatus = STATUS_STEPS[STATUS_STEPS.findIndex((s) => s.status === incident.status) + 1];

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto p-0"
        aria-label={`Incident details: ${incident.reference}`}
      >
        {/* Header */}
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-card px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <SeverityDot severity={incident.severity} />
              <SheetTitle className="font-mono text-sm truncate">{incident.reference}</SheetTitle>
              {isScenario && <ScenarioChip />}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {!isScenario && (
                <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 p-5">
          {/* Title + type */}
          <div>
            <h2 className="text-base font-semibold text-foreground">{incident.location_name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {INCIDENT_TYPE_ICONS[incident.incident_type] ?? "🆘"}{" "}
              {INCIDENT_TYPE_LABELS[incident.incident_type] ?? incident.incident_type.replace(/_/g, " ")}
            </p>
          </div>

          {/* Status + severity badges */}
          <div className="flex flex-wrap gap-2">
            <SeverityBadge severity={incident.severity} />
            <IncidentStatusBadge status={incident.status} />
            {!incident.road_accessible && (
              <Badge variant="outline" className="text-xs gap-1">
                <XCircle className="h-3 w-3 text-critical" aria-hidden="true" />
                Road inaccessible
              </Badge>
            )}
          </div>

          {/* Workflow stepper */}
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <p className="label-caps mb-4">Response workflow</p>
            <WorkflowStepper status={incident.status} />
          </div>

          {/* Description */}
          {incident.summary && (
            <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground leading-relaxed">
              {incident.summary}
            </div>
          )}

          {/* Key stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="label-caps mb-1">People affected</p>
              <p className="flex items-center gap-1.5 text-xl font-bold">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                {incident.people_affected}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="label-caps mb-1">Required service</p>
              <p className="text-sm font-semibold capitalize">
                {incident.required_service.replace(/_/g, " ")}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="label-caps mb-1">Report confidence</p>
              <p className="flex items-center gap-1.5 text-xl font-bold">
                <Cpu className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                {incident.ai_confidence}%
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="label-caps mb-1">Reports fused</p>
              <p className="flex items-center gap-1.5 text-xl font-bold">
                <GitMerge className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                {incident.reports_fused}
              </p>
            </div>
          </div>

          {/* Location + coords */}
          <div className="rounded-lg border border-border p-3 space-y-1.5">
            <p className="label-caps">Location</p>
            <p className="flex items-center gap-1.5 text-sm">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              {incident.location_name}
            </p>
            <a
              href={`https://www.openstreetmap.org/?mlat=${incident.lat}&mlon=${incident.lng}#map=14/${incident.lat}/${incident.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Navigation className="h-3 w-3 shrink-0" aria-hidden="true" />
              {incident.lat.toFixed(5)}, {incident.lng.toFixed(5)} — View on map
            </a>
          </div>

          {/* Assigned vehicle */}
          {assignedVehicle ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="label-caps mb-1.5">Assigned vehicle</p>
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Truck className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                {assignedVehicle.code} — {assignedVehicle.kind.replace(/_/g, " ")}
              </p>
              {assignedVehicle.eta_minutes != null && (
                <p className="text-xs text-muted-foreground mt-1">ETA {assignedVehicle.eta_minutes} min</p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-3">
              <p className="label-caps mb-1">Assigned vehicle</p>
              <p className="text-xs text-muted-foreground">No vehicle assigned yet</p>
            </div>
          )}

          {/* Nearest hospital */}
          {nearestHospital && (
            <div className="rounded-lg border border-border p-3">
              <p className="label-caps mb-1.5 flex items-center gap-1.5">
                <Hospital className="h-3 w-3" aria-hidden="true" /> Nearest hospital
              </p>
              <p className="text-sm font-semibold">{nearestHospital.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {nearestHospital.district} · {nearestHospital.dist.toFixed(1)} km · {nearestHospital.beds_available} beds
              </p>
            </div>
          )}

          {/* Nearest shelter */}
          {nearestShelter && (
            <div className="rounded-lg border border-border p-3">
              <p className="label-caps mb-1.5 flex items-center gap-1.5">
                <Tent className="h-3 w-3" aria-hidden="true" /> Nearest open shelter
              </p>
              <p className="text-sm font-semibold">{nearestShelter.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {nearestShelter.district} · {nearestShelter.dist.toFixed(1)} km · {nearestShelter.capacity - nearestShelter.occupancy} spaces free
              </p>
            </div>
          )}

          {/* Affected roads */}
          {nearestBlockedRoad && nearestBlockedRoad.length > 0 && (
            <div className="rounded-lg border border-critical/20 bg-critical-soft p-3">
              <p className="label-caps mb-1.5 flex items-center gap-1.5 text-critical">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Roads to avoid nearby
              </p>
              <ul className="space-y-1">
                {nearestBlockedRoad.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-xs">
                    <span className="text-critical font-medium">{r.road_name}</span>
                    <span className="text-critical/70 capitalize ml-2">{r.state.replace(/_/g, " ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Safe route link */}
          <Link
            to="/routes"
            className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            <span className="flex items-center gap-2">
              <RouteIcon className="h-4 w-4" aria-hidden="true" />
              Find safe route to this location
            </span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>

          {/* Timestamps */}
          <div className="text-xs text-muted-foreground space-y-0.5 border-t border-border pt-3">
            <p className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
              Reported {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}
              {" "}· {format(new Date(incident.created_at), "dd MMM yyyy, HH:mm")}
            </p>
            {incident.resolved_at && (
              <p className="text-safe-foreground">
                Resolved {format(new Date(incident.resolved_at), "dd MMM yyyy, HH:mm")}
              </p>
            )}
          </div>

          {/* Status update actions */}
          {canManage && incident.status !== "resolved" && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="label-caps">Update status</p>
              {isScenario ? (
                <p className="text-xs text-muted-foreground">
                  Scenario incidents are read-only. Use the "New Incident" button to create a real incident.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {nextStatus && (
                    <Button
                      size="sm"
                      disabled={updateMutation.isPending}
                      onClick={() => handleStatusChange(nextStatus.status)}
                      className="gap-1.5"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Mark as: {nextStatus.label}
                    </Button>
                  )}
                  {STATUS_OPTIONS
                    .filter((s) => s !== incident.status && s !== nextStatus?.status)
                    .map((s) => (
                      <Button
                        key={s}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={updateMutation.isPending}
                        onClick={() => handleStatusChange(s)}
                      >
                        {s === "resolved" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                        {STATUS_STEPS.find((st) => st.status === s)?.label ?? s.replace(/_/g, " ")}
                      </Button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Not logged in notice */}
          {!canManage && incident.status !== "resolved" && (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5 text-xs text-muted-foreground">
              <Radio className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              Sign in as a dispatcher or admin to update incident status.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Create / Edit form dialog ─────────────────────────────────────────────────
function IncidentFormDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Incident | null;
}) {
  const createMutation = useCreateIncident();
  const updateMutation = useUpdateIncident();
  const { data: vehicles } = useVehicles();

  const [form, setForm] = useState(
    editing
      ? {
          incident_type: editing.incident_type,
          location_name: editing.location_name,
          lat: editing.lat,
          lng: editing.lng,
          severity: editing.severity,
          people_affected: editing.people_affected,
          road_accessible: editing.road_accessible,
          required_service: editing.required_service,
          status: editing.status,
          summary: editing.summary ?? "",
        }
      : { ...EMPTY_FORM },
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, updates: form });
        toast.success("Incident updated");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("Incident created successfully");
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save incident";
      toast.error(msg);
    }
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Incident" : "Create Incident"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="inc-type">Incident Type</Label>
              <Select value={form.incident_type} onValueChange={(v) => set("incident_type", v)}>
                <SelectTrigger id="inc-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {INCIDENT_TYPE_LABELS[t] ?? t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inc-sev">Severity</Label>
              <Select value={form.severity} onValueChange={(v) => set("severity", v as Severity)}>
                <SelectTrigger id="inc-sev"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="inc-loc">Location Name</Label>
            <Input id="inc-loc" required value={form.location_name}
              onChange={(e) => set("location_name", e.target.value)}
              placeholder="e.g. Balkhu riverside settlement" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="inc-lat">Latitude</Label>
              <Input id="inc-lat" type="number" step="0.0001" required value={form.lat}
                onChange={(e) => set("lat", parseFloat(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inc-lng">Longitude</Label>
              <Input id="inc-lng" type="number" step="0.0001" required value={form.lng}
                onChange={(e) => set("lng", parseFloat(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="inc-ppl">People Affected</Label>
              <Input id="inc-ppl" type="number" min={0} required value={form.people_affected}
                onChange={(e) => set("people_affected", parseInt(e.target.value, 10))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inc-svc">Required Service</Label>
              <Select value={form.required_service} onValueChange={(v) => set("required_service", v)}>
                <SelectTrigger id="inc-svc"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="inc-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as IncidentStatus)}>
                <SelectTrigger id="inc-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_STEPS.find((st) => st.status === s)?.label ?? s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inc-road">Road Accessible</Label>
              <Select value={form.road_accessible ? "yes" : "no"}
                onValueChange={(v) => set("road_accessible", v === "yes")}>
                <SelectTrigger id="inc-road"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes — accessible</SelectItem>
                  <SelectItem value="no">No — blocked / flooded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {editing && vehicles && vehicles.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="inc-veh">Assign Vehicle (optional)</Label>
              <Select
                value={editing.assigned_vehicle ?? "none"}
                onValueChange={(v) =>
                  updateMutation.mutateAsync({
                    id: editing.id,
                    updates: { assigned_vehicle: v === "none" ? null : v },
                  })
                }
              >
                <SelectTrigger id="inc-veh"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.code} — {v.kind.replace(/_/g, " ")} ({v.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="inc-sum">Description / Notes</Label>
            <Textarea id="inc-sum" value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              placeholder="Describe the situation…" rows={3} />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : editing ? "Save Changes" : "Create Incident"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Filter tab button ─────────────────────────────────────────────────────────
function FilterTab({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/20" : "bg-muted"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function IncidentsPage() {
  const { data: realIncidents, isLoading } = useIncidents();
  const { data: vehicles } = useVehicles();
  const { demoMode, toggleDemoMode } = useDemoMode();
  const { canManage } = useRole();

  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | Severity | "active" | "resolved">("all");
  const [selected, setSelected] = useState<Incident | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Incident | null>(null);

  // Merge real + scenario depending on mode
  const allIncidents: Incident[] = useMemo(() => {
    const real = realIncidents ?? [];
    if (demoMode) {
      // Scenario incidents shown alongside real ones; scenario items go first
      return [...SCENARIO_INCIDENTS, ...real];
    }
    return real;
  }, [realIncidents, demoMode]);

  // Summary counts — always from allIncidents (post-merge)
  const stats = useMemo(() => {
    const total = allIncidents.length;
    const critical = allIncidents.filter((i) => i.severity === "critical").length;
    const active = allIncidents.filter((i) => i.status !== "resolved").length;
    const resolved = allIncidents.filter((i) => i.status === "resolved").length;
    return { total, critical, active, resolved };
  }, [allIncidents]);

  // Filter counts for tabs
  const tabCounts = useMemo(() => ({
    all: allIncidents.length,
    critical: allIncidents.filter((i) => i.severity === "critical").length,
    high: allIncidents.filter((i) => i.severity === "high").length,
    moderate: allIncidents.filter((i) => i.severity === "moderate").length,
    active: allIncidents.filter((i) => i.status !== "resolved").length,
    resolved: allIncidents.filter((i) => i.status === "resolved").length,
  }), [allIncidents]);

  // Apply tab + search filters
  const filtered = useMemo(() => {
    let list = allIncidents;

    // Tab filter
    if (filterTab === "active") list = list.filter((i) => i.status !== "resolved");
    else if (filterTab === "resolved") list = list.filter((i) => i.status === "resolved");
    else if (filterTab === "critical") list = list.filter((i) => i.severity === "critical");
    else if (filterTab === "high") list = list.filter((i) => i.severity === "high");
    else if (filterTab === "moderate") list = list.filter((i) => i.severity === "moderate");

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.location_name.toLowerCase().includes(q) ||
          i.reference.toLowerCase().includes(q) ||
          i.incident_type.toLowerCase().includes(q) ||
          (i.summary ?? "").toLowerCase().includes(q),
      );
    }

    return list;
  }, [allIncidents, filterTab, search]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(inc: Incident) {
    setEditing(inc);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col min-h-0">
      <PageHeader
        title="Incident Management"
        description="Track, assign and resolve emergency incidents"
      >
        {/* Demo mode toggle */}
        <button
          type="button"
          onClick={toggleDemoMode}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            demoMode
              ? "border-moderate/40 bg-moderate-soft text-moderate-foreground"
              : "border-border bg-secondary text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={demoMode}
          title={demoMode ? "Showing scenario data — click to switch to real data only" : "Click to show scenario demonstration data"}
        >
          <FlaskConical className="h-3 w-3" aria-hidden="true" />
          {demoMode ? "Scenario mode ON" : "Scenario mode"}
        </button>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New Incident
        </Button>
      </PageHeader>

      {/* Scenario mode notice */}
      {demoMode && (
        <div className="flex items-start gap-2 border-b border-moderate/20 bg-moderate-soft px-6 py-2.5 text-xs text-moderate-foreground" role="status">
          <FlaskConical className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Scenario mode active.</strong>{" "}
            Sample Bihar/Nepal flood incidents are shown for demonstration. They are not real events
            and cannot be updated. Real incidents appear alongside them.
          </span>
        </div>
      )}

      <div className="px-6 py-4 space-y-4">
        {/* Summary stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            <>
              <StatCard
                label="Total incidents"
                value={stats.total}
                icon={<Siren className="h-5 w-5" />}
                variant={stats.total > 0 ? "default" : "default"}
              />
              <StatCard
                label="Critical"
                value={stats.critical}
                icon={<AlertTriangle className="h-5 w-5" />}
                variant={stats.critical > 0 ? "critical" : "default"}
              />
              <StatCard
                label="Active responses"
                value={stats.active}
                icon={<Radio className="h-5 w-5" />}
                variant={stats.active > 0 ? "high" : "default"}
              />
              <StatCard
                label="Resolved"
                value={stats.resolved}
                icon={<CheckCircle2 className="h-5 w-5" />}
                variant={stats.resolved > 0 ? "safe" : "default"}
              />
            </>
          )}
        </div>

        {/* Response workflow visual (always visible) */}
        <div className="panel p-4" aria-label="Incident response workflow">
          <p className="label-caps mb-4">Response workflow</p>
          <div className="flex items-start gap-0">
            {[
              { icon: Radio,       label: "Reported",          color: "bg-critical" },
              { icon: AlertTriangle, label: "Verification",    color: "bg-high" },
              { icon: Truck,       label: "Response Assigned",  color: "bg-moderate-foreground" },
              { icon: Navigation,  label: "In Progress",        color: "bg-primary" },
              { icon: CheckCircle2, label: "Resolved",          color: "bg-safe" },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex flex-1 flex-col items-center text-center relative">
                {i < arr.length - 1 && (
                  <div className="absolute left-1/2 top-4 h-px w-full bg-border" aria-hidden="true" />
                )}
                <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full ${step.color} shadow-sm`} aria-hidden="true">
                  <step.icon className="h-3.5 w-3.5 text-white" />
                </div>
                <p className="mt-1.5 text-[10px] font-semibold text-foreground leading-tight px-0.5">
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Search + filter tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Search by location, type or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search incidents"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter incidents">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <FilterTab label="All" active={filterTab === "all"} count={tabCounts.all} onClick={() => setFilterTab("all")} />
            <FilterTab label="Critical" active={filterTab === "critical"} count={tabCounts.critical} onClick={() => setFilterTab("critical")} />
            <FilterTab label="High" active={filterTab === "high"} count={tabCounts.high} onClick={() => setFilterTab("high")} />
            <FilterTab label="Moderate" active={filterTab === "moderate"} count={tabCounts.moderate} onClick={() => setFilterTab("moderate")} />
            <FilterTab label="Active" active={filterTab === "active"} count={tabCounts.active} onClick={() => setFilterTab("active")} />
            <FilterTab label="Resolved" active={filterTab === "resolved"} count={tabCounts.resolved} onClick={() => setFilterTab("resolved")} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border-t border-border">
        {isLoading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            {allIncidents.length === 0 && !demoMode ? (
              <>
                <div className="rounded-full bg-secondary p-5 mb-4">
                  <CheckCircle2 className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-foreground">No active incidents reported</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                  No emergency incidents have been logged yet. Reports submitted via SOS will appear here.
                </p>
                <div className="mt-5 flex gap-3">
                  <Button onClick={openCreate} size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    Create incident
                  </Button>
                  <Button variant="outline" size="sm" onClick={toggleDemoMode}>
                    <FlaskConical className="h-3.5 w-3.5" />
                    Show scenario data
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Search className="h-8 w-8 text-muted-foreground mb-3" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">No incidents match your filters</p>
                <Button
                  variant="ghost" size="sm" className="mt-2"
                  onClick={() => { setSearch(""); setFilterTab("all"); }}
                >
                  Clear filters
                </Button>
              </>
            )}
          </div>
        ) : (
          /* ── Incident table ── */
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" aria-label="Incident list">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th scope="col" className="px-4 py-3 text-left label-caps whitespace-nowrap">ID</th>
                  <th scope="col" className="px-4 py-3 text-left label-caps whitespace-nowrap">Type</th>
                  <th scope="col" className="px-4 py-3 text-left label-caps min-w-[160px]">Location</th>
                  <th scope="col" className="px-4 py-3 text-left label-caps whitespace-nowrap">Severity</th>
                  <th scope="col" className="px-4 py-3 text-left label-caps whitespace-nowrap">Reported</th>
                  <th scope="col" className="px-4 py-3 text-left label-caps whitespace-nowrap">Vehicle</th>
                  <th scope="col" className="px-4 py-3 text-left label-caps whitespace-nowrap">Status</th>
                  <th scope="col" className="px-4 py-3 text-left label-caps whitespace-nowrap">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((inc) => {
                  const assignedVehicle = vehicles?.find((v) => v.id === inc.assigned_vehicle);
                  const scenario = isScenarioIncident(inc.id);
                  const isSelected = selected?.id === inc.id;
                  return (
                    <tr
                      key={inc.id}
                      className={`group cursor-pointer transition-colors hover:bg-accent ${isSelected ? "bg-accent" : ""}`}
                      onClick={() => setSelected(inc)}
                      onKeyDown={(e) => e.key === "Enter" && setSelected(inc)}
                      tabIndex={0}
                      role="row"
                      aria-selected={isSelected}
                    >
                      {/* ID */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <SeverityDot severity={inc.severity} />
                          <span className="font-mono text-xs text-muted-foreground">{inc.reference}</span>
                          {scenario && <ScenarioChip />}
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs">
                          {INCIDENT_TYPE_ICONS[inc.incident_type] ?? "🆘"}{" "}
                          <span className="hidden sm:inline">
                            {INCIDENT_TYPE_LABELS[inc.incident_type] ?? inc.incident_type.replace(/_/g, " ")}
                          </span>
                        </span>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground truncate max-w-[240px]">{inc.location_name}</p>
                        {inc.people_affected > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Users className="h-3 w-3" aria-hidden="true" />
                            {inc.people_affected} affected
                          </p>
                        )}
                      </td>

                      {/* Severity */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SeverityBadge severity={inc.severity} />
                      </td>

                      {/* Reported time */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(inc.created_at), { addSuffix: true })}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70">
                          {format(new Date(inc.created_at), "dd MMM, HH:mm")}
                        </p>
                      </td>

                      {/* Vehicle */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {assignedVehicle ? (
                          <span className="flex items-center gap-1 text-xs font-medium">
                            <Truck className="h-3 w-3 text-primary shrink-0" aria-hidden="true" />
                            {assignedVehicle.code}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <IncidentStatusBadge status={inc.status} />
                      </td>

                      {/* View */}
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={(e) => { e.stopPropagation(); setSelected(inc); }}
                          aria-label={`View details for ${inc.reference}`}
                        >
                          Details
                          <ChevronRight className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Footer */}
            <div className="border-t border-border bg-card px-5 py-2.5">
              <p className="text-xs text-muted-foreground">
                Showing {filtered.length} of {allIncidents.length} incident{allIncidents.length !== 1 ? "s" : ""}
                {demoMode && " (includes scenario data)"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Details sheet */}
      {selected && (
        <IncidentDetailSheet
          incident={selected}
          vehicles={vehicles}
          canManage={canManage}
          onEdit={() => {
            if (isScenarioIncident(selected.id)) {
              toast.info("Scenario incidents are read-only.");
              return;
            }
            openEdit(selected);
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Create / Edit dialog */}
      <IncidentFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
      />
    </div>
  );
}
