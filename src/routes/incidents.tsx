import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Search,
  Filter,
  ChevronDown,
  X,
  MapPin,
  Users,
  Cpu,
  GitMerge,
  Truck,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
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
  useIncidents,
  useVehicles,
  useCreateIncident,
  useUpdateIncident,
  type Incident,
} from "@/hooks/useSupabaseData";
import type { Database } from "@/integrations/supabase/types";
import { formatDistanceToNow, format } from "date-fns";

type Severity = Database["public"]["Enums"]["severity_level"];
type IncidentStatus = Database["public"]["Enums"]["incident_status"];

export const Route = createFileRoute("/incidents")({
  component: IncidentsPage,
});

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

// ── Empty form state ─────────────────────────────────────────────────────────
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

// ── Detail panel ─────────────────────────────────────────────────────────────
function IncidentDetail({
  incident,
  vehicles,
  onEdit,
  onClose,
}: {
  incident: Incident;
  vehicles: ReturnType<typeof useVehicles>["data"];
  onEdit: () => void;
  onClose: () => void;
}) {
  const updateMutation = useUpdateIncident();

  const assignedVehicle = vehicles?.find((v) => v.id === incident.assigned_vehicle);

  async function handleStatusChange(status: IncidentStatus) {
    try {
      await updateMutation.mutateAsync({
        id: incident.id,
        updates: {
          status,
          ...(status === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
        },
      });
      toast.success(`Status updated to ${status.replace(/_/g, " ")}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <SeverityDot severity={incident.severity} />
          <span className="font-mono text-sm text-muted-foreground">{incident.reference}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{incident.location_name}</h2>
          <p className="mt-1 text-sm text-muted-foreground capitalize">
            {incident.incident_type.replace(/_/g, " ")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <SeverityBadge severity={incident.severity} />
          <IncidentStatusBadge status={incident.status} />
          {!incident.road_accessible && (
            <Badge variant="outline" className="text-xs">
              Road Inaccessible
            </Badge>
          )}
        </div>

        {incident.summary && (
          <div className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
            {incident.summary}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3">
            <p className="label-caps mb-1">People Affected</p>
            <p className="flex items-center gap-1.5 text-xl font-bold">
              <Users className="h-4 w-4 text-muted-foreground" />
              {incident.people_affected}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="label-caps mb-1">Required Service</p>
            <p className="text-sm font-semibold capitalize">
              {incident.required_service.replace(/_/g, " ")}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="label-caps mb-1">AI Confidence</p>
            <p className="flex items-center gap-1.5 text-xl font-bold">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              {incident.ai_confidence}%
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="label-caps mb-1">Reports Fused</p>
            <p className="flex items-center gap-1.5 text-xl font-bold">
              <GitMerge className="h-4 w-4 text-muted-foreground" />
              {incident.reports_fused}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3">
          <p className="label-caps mb-1">Location</p>
          <p className="flex items-center gap-1.5 text-sm">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {incident.lat.toFixed(4)}, {incident.lng.toFixed(4)}
          </p>
        </div>

        {assignedVehicle && (
          <div className="rounded-lg border border-border p-3">
            <p className="label-caps mb-1">Assigned Vehicle</p>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {assignedVehicle.code} — {assignedVehicle.kind.replace(/_/g, " ")}
            </p>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>Reported {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })}</p>
          <p>{format(new Date(incident.created_at), "dd MMM yyyy, HH:mm")}</p>
          {incident.resolved_at && (
            <p className="text-safe-foreground">
              Resolved {format(new Date(incident.resolved_at), "dd MMM yyyy, HH:mm")}
            </p>
          )}
        </div>

        {/* Status workflow */}
        {incident.status !== "resolved" && (
          <div>
            <p className="label-caps mb-2">Update Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.filter((s) => s !== incident.status).map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={updateMutation.isPending}
                  onClick={() => handleStatusChange(s)}
                >
                  {s === "resolved" && <CheckCircle2 className="mr-1 h-3 w-3" />}
                  {s.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
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
        toast.success("Incident created");
      }
      onClose();
    } catch {
      toast.error("Failed to save incident");
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
              <Select
                value={form.incident_type}
                onValueChange={(v) => set("incident_type", v)}
              >
                <SelectTrigger id="inc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inc-sev">Severity</Label>
              <Select
                value={form.severity}
                onValueChange={(v) => set("severity", v as Severity)}
              >
                <SelectTrigger id="inc-sev">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="inc-loc">Location Name</Label>
            <Input
              id="inc-loc"
              required
              value={form.location_name}
              onChange={(e) => set("location_name", e.target.value)}
              placeholder="e.g. Balkhu riverside settlement"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="inc-lat">Latitude</Label>
              <Input
                id="inc-lat"
                type="number"
                step="0.0001"
                required
                value={form.lat}
                onChange={(e) => set("lat", parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inc-lng">Longitude</Label>
              <Input
                id="inc-lng"
                type="number"
                step="0.0001"
                required
                value={form.lng}
                onChange={(e) => set("lng", parseFloat(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="inc-ppl">People Affected</Label>
              <Input
                id="inc-ppl"
                type="number"
                min={0}
                required
                value={form.people_affected}
                onChange={(e) => set("people_affected", parseInt(e.target.value, 10))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inc-svc">Required Service</Label>
              <Select
                value={form.required_service}
                onValueChange={(v) => set("required_service", v)}
              >
                <SelectTrigger id="inc-svc">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="inc-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as IncidentStatus)}
              >
                <SelectTrigger id="inc-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="inc-road">Road Accessible</Label>
              <Select
                value={form.road_accessible ? "yes" : "no"}
                onValueChange={(v) => set("road_accessible", v === "yes")}
              >
                <SelectTrigger id="inc-road">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {editing && vehicles && vehicles.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="inc-veh">Assigned Vehicle (optional)</Label>
              <Select
                value={editing.assigned_vehicle ?? "none"}
                onValueChange={(v) =>
                  updateMutation.mutateAsync({
                    id: editing.id,
                    updates: { assigned_vehicle: v === "none" ? null : v },
                  })
                }
              >
                <SelectTrigger id="inc-veh">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
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
            <Label htmlFor="inc-sum">Summary</Label>
            <Textarea
              id="inc-sum"
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              placeholder="Describe the situation…"
              rows={3}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : editing ? "Save Changes" : "Create Incident"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function IncidentsPage() {
  const { data: incidents, isLoading } = useIncidents();
  const { data: vehicles } = useVehicles();

  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | "all">("all");
  const [selected, setSelected] = useState<Incident | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Incident | null>(null);

  const filtered = (incidents ?? []).filter((inc) => {
    const q = search.toLowerCase();
    const matchText =
      inc.location_name.toLowerCase().includes(q) ||
      inc.reference.toLowerCase().includes(q) ||
      inc.incident_type.toLowerCase().includes(q);
    const matchSev = filterSeverity === "all" || inc.severity === filterSeverity;
    const matchStat = filterStatus === "all" || inc.status === filterStatus;
    return matchText && matchSev && matchStat;
  });

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(inc: Incident) {
    setEditing(inc);
    setFormOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Incident Management"
        description={`${incidents?.length ?? 0} total incidents`}
      >
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          New Incident
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-6 py-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search by location, type or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select
            value={filterSeverity}
            onValueChange={(v) => setFilterSeverity(v as Severity | "all")}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {SEVERITY_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterStatus}
            onValueChange={(v) => setFilterStatus(v as IncidentStatus | "all")}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Status" />
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
      </div>

      {/* Content */}
      <div className="flex h-[calc(100vh-8.5rem)] overflow-hidden">
        {/* List */}
        <div
          className={`flex flex-col overflow-hidden border-r border-border transition-all ${selected ? "hidden sm:flex sm:w-80 lg:w-96 xl:w-[420px]" : "flex-1"}`}
        >
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <p className="text-muted-foreground text-sm">No incidents match your filters</p>
                {(search || filterSeverity !== "all" || filterStatus !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setSearch("");
                      setFilterSeverity("all");
                      setFilterStatus("all");
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((inc) => (
                  <li
                    key={inc.id}
                    className={`cursor-pointer px-4 py-3 hover:bg-accent transition-colors ${selected?.id === inc.id ? "bg-accent" : ""}`}
                    onClick={() => setSelected(inc)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSelected(inc)}
                    aria-pressed={selected?.id === inc.id}
                  >
                    <div className="flex items-start gap-3">
                      <SeverityDot severity={inc.severity} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {inc.reference}
                          </span>
                          <IncidentStatusBadge status={inc.status} />
                        </div>
                        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                          {inc.location_name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={inc.severity} />
                          <span className="text-xs text-muted-foreground capitalize">
                            {inc.incident_type.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {inc.people_affected} affected
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(inc.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <ChevronDown className="mt-1 h-3.5 w-3.5 shrink-0 -rotate-90 text-muted-foreground" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-border bg-card px-4 py-2">
            <p className="text-xs text-muted-foreground">
              {filtered.length} incident{filtered.length !== 1 ? "s" : ""}
              {filtered.length !== (incidents?.length ?? 0) && ` (filtered from ${incidents?.length ?? 0})`}
            </p>
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="flex-1 overflow-hidden">
            <IncidentDetail
              incident={selected}
              vehicles={vehicles}
              onEdit={() => openEdit(selected)}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </div>

      <IncidentFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
      />
    </div>
  );
}
