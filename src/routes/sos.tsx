import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Radio,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle2,
  Info,
  WifiOff,
  Wifi,
  ArrowRight,
  ShieldAlert,
  Footprints,
  Tent,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOfflineSOSQueue } from "@/hooks/useOfflineSOSQueue";
import { useShelters, useRoads, haversineKm } from "@/hooks/useSupabaseData";
import type { Database } from "@/integrations/supabase/types";

type Severity = Database["public"]["Enums"]["severity_level"];

export const Route = createFileRoute("/sos")({
  component: SOSPage,
});

const INCIDENT_TYPES = [
  { value: "flood_rescue", label: "Flood / Water rescue", emoji: "🌊" },
  { value: "road_accident", label: "Road accident", emoji: "🚗" },
  { value: "landslide", label: "Landslide", emoji: "⛰️" },
  { value: "medical_emergency", label: "Medical emergency", emoji: "🏥" },
  { value: "fire", label: "Fire", emoji: "🔥" },
  { value: "evacuation", label: "Evacuation needed", emoji: "🏃" },
  { value: "bridge_failure", label: "Bridge / Infrastructure failure", emoji: "🌉" },
  { value: "other", label: "Other emergency", emoji: "🆘" },
];

const SERVICE_TYPES = [
  { value: "ambulance", label: "Ambulance" },
  { value: "rescue_team", label: "Rescue team" },
  { value: "fire_engine", label: "Fire engine" },
  { value: "police", label: "Police" },
  { value: "medical_team", label: "Medical team" },
  { value: "all", label: "All available" },
];

const SEVERITY_OPTIONS: { value: Severity; label: string; desc: string }[] = [
  { value: "critical", label: "Critical", desc: "Immediate life threat, multiple casualties" },
  { value: "high", label: "High", desc: "Serious situation, urgent response needed" },
  { value: "moderate", label: "Moderate", desc: "Significant risk but stable" },
  { value: "safe", label: "Low / Informational", desc: "No immediate danger" },
];

// ── Guidance definitions per incident type ───────────────────────────────────
// Steps are static; nearest shelter + blocked roads are injected dynamically from DB data.

interface GuidanceStep {
  icon: React.ReactNode;
  text: string;
}

type GuidanceDef = {
  heading: string;
  steps: GuidanceStep[];
  avoidStateFilter?: string[]; // road states to highlight as avoid
};

const GUIDANCE: Record<string, GuidanceDef> = {
  flood_rescue: {
    heading: "Flood / Water Rescue",
    avoidStateFilter: ["flooded", "bridge_damaged"],
    steps: [
      {
        icon: <Footprints className="h-4 w-4 text-blue-600" />,
        text: "Move immediately to the highest available ground. Do NOT attempt to walk or drive through floodwater.",
      },
      {
        icon: <ShieldAlert className="h-4 w-4 text-amber-600" />,
        text: "Stay away from riverbanks, drainage channels and underpasses — water levels can rise within minutes.",
      },
      {
        icon: <Tent className="h-4 w-4 text-green-600" />,
        text: "Proceed to the nearest open evacuation shelter (shown below). Bring identity documents and medications if safe to do so.",
      },
    ],
  },
  medical_emergency: {
    heading: "Medical Emergency",
    avoidStateFilter: ["flooded", "bridge_damaged", "blocked"],
    steps: [
      {
        icon: <ShieldAlert className="h-4 w-4 text-red-600" />,
        text: "Keep the patient still and warm. Do not move them if spinal injury is suspected.",
      },
      {
        icon: <Radio className="h-4 w-4 text-primary" />,
        text: "Submit this SOS and stay on the line. Responders will call back to guide you.",
      },
      {
        icon: <Tent className="h-4 w-4 text-green-600" />,
        text: "The nearest trauma centre with available beds is shown below. Only transport the patient yourself if response time exceeds 30 minutes.",
      },
    ],
  },
  fire: {
    heading: "Fire",
    avoidStateFilter: ["blocked", "high_risk"],
    steps: [
      {
        icon: <Footprints className="h-4 w-4 text-red-600" />,
        text: "Evacuate everyone immediately. Stay low under smoke and use stairs — never lifts.",
      },
      {
        icon: <ShieldAlert className="h-4 w-4 text-amber-600" />,
        text: "Close all doors behind you to slow fire spread. Do not re-enter the building for any reason.",
      },
      {
        icon: <MapPin className="h-4 w-4 text-primary" />,
        text: "Assemble at an open space at least 50 m upwind from the building and wait for fire teams.",
      },
    ],
  },
  landslide: {
    heading: "Landslide",
    avoidStateFilter: ["landslide", "high_risk"],
    steps: [
      {
        icon: <Footprints className="h-4 w-4 text-amber-700" />,
        text: "Move away from the slide path immediately — perpendicular to the slope direction, not uphill.",
      },
      {
        icon: <ShieldAlert className="h-4 w-4 text-amber-600" />,
        text: "Watch for secondary slides and avoid all roads marked as landslide risk below.",
      },
      {
        icon: <Tent className="h-4 w-4 text-green-600" />,
        text: "Report your position and proceed to the nearest rescue command post or shelter.",
      },
    ],
  },
  road_accident: {
    heading: "Road Accident",
    avoidStateFilter: ["flooded", "bridge_damaged", "blocked"],
    steps: [
      {
        icon: <ShieldAlert className="h-4 w-4 text-red-600" />,
        text: "Switch on hazard lights and place warning triangles at 50 m front and rear if available.",
      },
      {
        icon: <Radio className="h-4 w-4 text-primary" />,
        text: "Do not move injured persons unless there is immediate danger (fire/water). Keep them warm.",
      },
      {
        icon: <Tent className="h-4 w-4 text-green-600" />,
        text: "Nearest trauma hospital is shown below. Ambulance ETA depends on current road conditions.",
      },
    ],
  },
  evacuation: {
    heading: "Evacuation",
    avoidStateFilter: ["flooded", "bridge_damaged", "landslide", "blocked"],
    steps: [
      {
        icon: <Footprints className="h-4 w-4 text-blue-600" />,
        text: "Follow the safest route shown in the Route Planner. Avoid all roads flagged below.",
      },
      {
        icon: <ShieldAlert className="h-4 w-4 text-amber-600" />,
        text: "Travel in daylight if possible. Keep your phone charged and share your live location with family.",
      },
      {
        icon: <Tent className="h-4 w-4 text-green-600" />,
        text: "Report to the nearest evacuation shelter listed below for registration and supplies.",
      },
    ],
  },
  bridge_failure: {
    heading: "Bridge / Infrastructure Failure",
    avoidStateFilter: ["bridge_damaged", "flooded"],
    steps: [
      {
        icon: <ShieldAlert className="h-4 w-4 text-red-600" />,
        text: "Stop all traffic immediately and keep everyone at least 100 m from the structure.",
      },
      {
        icon: <Radio className="h-4 w-4 text-primary" />,
        text: "Report exact bridge name and location. Engineers will be dispatched for assessment.",
      },
      {
        icon: <MapPin className="h-4 w-4 text-primary" />,
        text: "Use the Route Planner to find the next available crossing — bypass options are shown there.",
      },
    ],
  },
  other: {
    heading: "Emergency",
    avoidStateFilter: ["flooded", "bridge_damaged", "blocked"],
    steps: [
      {
        icon: <ShieldAlert className="h-4 w-4 text-red-600" />,
        text: "Move yourself and others to a safe location away from the hazard.",
      },
      {
        icon: <Radio className="h-4 w-4 text-primary" />,
        text: "Submit this report with as much detail as possible. A responder will follow up.",
      },
      {
        icon: <Tent className="h-4 w-4 text-green-600" />,
        text: "Nearest shelter or hospital is shown below if you need immediate refuge.",
      },
    ],
  },
};

// ── Guidance card component ───────────────────────────────────────────────────
function GuidanceCard({
  incidentType,
  lat,
  lng,
}: {
  incidentType: string;
  lat: number;
  lng: number;
}) {
  const { data: shelters } = useShelters();
  const { data: roads } = useRoads();
  const guidance = GUIDANCE[incidentType] ?? GUIDANCE["other"]!;

  // Nearest shelter by haversine distance
  const nearestShelter = useMemo(() => {
    if (!shelters) return null;
    return shelters
      .filter((s) => s.occupancy < s.capacity)
      .map((s) => ({ ...s, dist: haversineKm(lat, lng, s.lat, s.lng) }))
      .sort((a, b) => a.dist - b.dist)[0] ?? null;
  }, [shelters, lat, lng]);

  // Roads to avoid for this incident type
  const roadsToAvoid = useMemo(() => {
    if (!roads || !guidance.avoidStateFilter) return [];
    return roads
      .filter((r) => guidance.avoidStateFilter!.includes(r.state))
      .slice(0, 3);
  }, [roads, guidance.avoidStateFilter]);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2 text-primary">
          <ShieldAlert className="h-4 w-4" />
          Immediate Actions — {guidance.heading}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action steps */}
        <ol className="space-y-2.5">
          {guidance.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground mt-0.5">
                {i + 1}
              </span>
              <div className="flex items-start gap-2 flex-1">
                <span className="mt-0.5 shrink-0">{step.icon}</span>
                <span className="text-sm text-foreground leading-snug">{step.text}</span>
              </div>
            </li>
          ))}
        </ol>

        {/* Nearest shelter */}
        {nearestShelter && (
          <div className="rounded-lg border border-safe/30 bg-safe-soft px-3 py-2.5">
            <p className="label-caps mb-1 flex items-center gap-1.5">
              <Tent className="h-3 w-3" />
              Nearest open shelter
            </p>
            <p className="text-sm font-semibold text-foreground">{nearestShelter.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {nearestShelter.district} ·{" "}
              {nearestShelter.dist < 1
                ? `${Math.round(nearestShelter.dist * 1000)} m`
                : `${nearestShelter.dist.toFixed(1)} km`}{" "}
              away · {nearestShelter.capacity - nearestShelter.occupancy} spaces free
            </p>
          </div>
        )}

        {/* Roads to avoid */}
        {roadsToAvoid.length > 0 && (
          <div className="rounded-lg border border-critical/30 bg-critical-soft px-3 py-2.5">
            <p className="label-caps mb-1.5 flex items-center gap-1.5 text-critical">
              <AlertTriangle className="h-3 w-3" />
              Avoid these roads
            </p>
            <ul className="space-y-1">
              {roadsToAvoid.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-xs text-critical">
                  <ArrowRight className="h-3 w-3 shrink-0" />
                  <span className="font-medium">{r.road_name}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-critical-soft text-critical border-critical/20 ml-auto"
                  >
                    {r.state.replace(/_/g, " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Offline status bar ────────────────────────────────────────────────────────
function OfflineBar({ queuedCount }: { queuedCount: number }) {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useState(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  });

  if (online && queuedCount === 0) return null;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
        online
          ? "border-safe/30 bg-safe-soft text-safe-foreground"
          : "border-high/30 bg-high-soft text-high-foreground"
      }`}
      role="status"
      aria-live="polite"
    >
      {online ? (
        <Wifi className="h-4 w-4 shrink-0" />
      ) : (
        <WifiOff className="h-4 w-4 shrink-0" />
      )}
      {online
        ? `Back online — ${queuedCount} queued report${queuedCount !== 1 ? "s" : ""} will be sent now.`
        : "You are offline. Your SOS report will be saved locally and sent automatically when you reconnect."}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function SOSPage() {
  const navigate = useNavigate();

  const { queuedCount, submitOrEnqueue } = useOfflineSOSQueue({
    onDrained: (count) =>
      toast.success(`${count} offline SOS report${count !== 1 ? "s" : ""} sent to command centre`),
    onError: (msg) => toast.error(msg),
  });

  const [form, setForm] = useState({
    incident_type: "",
    location_name: "",
    lat: 27.7,
    lng: 85.32,
    severity: "high" as Severity,
    people_affected: 1,
    road_accessible: true,
    required_service: "ambulance",
    summary: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submittedRef, setSubmittedRef] = useState("");
  const [wasQueued, setWasQueued] = useState(false);
  const [isPending, setIsPending] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.incident_type || !form.location_name) return;
    setIsPending(true);
    try {
      const result = await submitOrEnqueue(form);
      if (result.queued) {
        setWasQueued(true);
        setSubmittedRef("QUEUED");
      } else {
        setSubmittedRef(result.reference ?? "—");
      }
      setSubmitted(true);
    } catch {
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  function resetForm() {
    setSubmitted(false);
    setWasQueued(false);
    setSubmittedRef("");
    setForm({
      incident_type: "",
      location_name: "",
      lat: 27.7,
      lng: 85.32,
      severity: "high",
      people_affected: 1,
      road_accessible: true,
      required_service: "ambulance",
      summary: "",
    });
  }

  if (submitted) {
    return (
      <AppShell>
        <PageHeader title="SOS Report" />
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <div
            className={`rounded-full p-6 mb-4 ${wasQueued ? "bg-moderate-soft" : "bg-safe-soft"}`}
          >
            {wasQueued ? (
              <WifiOff className="h-12 w-12 text-moderate-foreground" />
            ) : (
              <CheckCircle2 className="h-12 w-12 text-safe" />
            )}
          </div>
          <h2 className="text-xl font-bold font-display text-foreground">
            {wasQueued ? "Report Saved Offline" : "Report Submitted"}
          </h2>
          <p className="mt-2 text-muted-foreground max-w-sm">
            {wasQueued
              ? "You are offline. Your report has been saved securely on this device and will be sent to the command centre automatically when you reconnect."
              : "Your emergency report has been logged and will be reviewed by the response team."}
          </p>
          {!wasQueued && (
            <div className="mt-4 rounded-lg border border-border bg-card px-6 py-4">
              <p className="label-caps mb-1">Reference Number</p>
              <p className="text-2xl font-bold font-mono text-primary">{submittedRef}</p>
            </div>
          )}
          {wasQueued && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-moderate/30 bg-moderate-soft px-4 py-3 text-sm text-moderate-foreground">
              <WifiOff className="h-4 w-4 shrink-0" />
              {queuedCount} report{queuedCount !== 1 ? "s" : ""} queued — will auto-send on reconnect
            </div>
          )}
          <div className="mt-6 flex gap-3">
            <Button onClick={resetForm} variant="outline">
              Report another
            </Button>
            {!wasQueued && (
              <Button onClick={() => navigate({ to: "/incidents" })}>
                View incidents
              </Button>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="SOS Emergency Report"
        description="Submit an emergency report to the response command centre"
      />

      <div className="p-6 max-w-2xl space-y-6">
        {/* Offline status */}
        <OfflineBar queuedCount={queuedCount} />

        {/* Disclaimer */}
        <div className="flex items-start gap-3 rounded-lg border border-critical/30 bg-critical-soft px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 text-critical shrink-0" />
          <div className="text-sm text-critical">
            <p className="font-semibold">This is a demonstration system.</p>
            <p className="mt-0.5">
              Reports are logged to the demo database only. For a real emergency call{" "}
              <strong>112</strong> (Nepal emergency services).
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Emergency type */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Emergency Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {INCIDENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set("incident_type", t.value)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      form.incident_type === t.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/50"
                    }`}
                  >
                    <span className="mr-1.5" aria-hidden="true">
                      {t.emoji}
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Guidance card — shown as soon as incident type is selected */}
          {form.incident_type && (
            <GuidanceCard
              incidentType={form.incident_type}
              lat={form.lat}
              lng={form.lng}
            />
          )}

          {/* Location */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Location
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sos-loc">Location description *</Label>
                <Input
                  id="sos-loc"
                  required
                  value={form.location_name}
                  onChange={(e) => set("location_name", e.target.value)}
                  placeholder="e.g. Balkhu riverside settlement, near the bridge"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sos-lat">Latitude (approx)</Label>
                  <Input
                    id="sos-lat"
                    type="number"
                    step="0.0001"
                    value={form.lat}
                    onChange={(e) => set("lat", parseFloat(e.target.value) || 27.7)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sos-lng">Longitude (approx)</Label>
                  <Input
                    id="sos-lng"
                    type="number"
                    step="0.0001"
                    value={form.lng}
                    onChange={(e) => set("lng", parseFloat(e.target.value) || 85.32)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sos-road">Road-accessible?</Label>
                <Select
                  value={form.road_accessible ? "yes" : "no"}
                  onValueChange={(v) => set("road_accessible", v === "yes")}
                >
                  <SelectTrigger id="sos-road">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes — vehicles can reach</SelectItem>
                    <SelectItem value="no">No — road blocked / flooded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Severity + people */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> Situation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SEVERITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set("severity", opt.value)}
                      className={`rounded-lg border px-3 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        form.severity === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sos-ppl">People affected</Label>
                  <Input
                    id="sos-ppl"
                    type="number"
                    min={1}
                    required
                    value={form.people_affected}
                    onChange={(e) =>
                      set("people_affected", Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sos-svc">Required service</Label>
                  <Select
                    value={form.required_service}
                    onValueChange={(v) => set("required_service", v)}
                  >
                    <SelectTrigger id="sos-svc">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sos-notes">Additional notes (optional)</Label>
                <Textarea
                  id="sos-notes"
                  value={form.summary}
                  onChange={(e) => set("summary", e.target.value)}
                  placeholder="Describe the situation: what happened, hazards, anything responders should know…"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!form.incident_type || !form.location_name || isPending}
          >
            <Radio className="h-4 w-4" />
            {isPending
              ? "Submitting…"
              : !navigator.onLine
                ? "Save SOS (offline — will auto-send)"
                : "Submit Emergency Report"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
