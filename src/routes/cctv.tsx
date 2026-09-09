import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Camera,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Navigation,
  Eye,
  EyeOff,
  Info,
  MapPin,
  Route as RouteIcon,
  ShieldAlert,
  XCircle,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SeverityBadge } from "@/components/SeverityBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRoads } from "@/hooks/useSupabaseData";

export const Route = createFileRoute("/cctv")({
  head: () => ({
    meta: [
      { title: "CCTV Intelligence — RESH MESQ" },
      {
        name: "description",
        content:
          "Camera observations feed into road risk scoring and safe route recommendations. Demo/simulated data only.",
      },
    ],
  }),
  component: CCTVPage,
});

// ── Simulated camera observation types ───────────────────────────────────────
type CameraStatus = "online" | "offline";
type CameraObservation =
  | "clear"
  | "heavy_traffic"
  | "flooded"
  | "obstructed"
  | "low_visibility"
  | "landslide"
  | "bridge_damage";

interface DemoCamera {
  id: string;
  label: string;
  district: string;
  lat: number;
  lng: number;
  status: CameraStatus;
  nearbyRoad: string;
  observation: CameraObservation;
  lastSeen: string; // relative time string
  routeImpact: "none" | "moderate" | "high" | "critical";
}

const OBS_CONFIG: Record<
  CameraObservation,
  { label: string; color: string; bg: string; icon: React.ReactNode; riskLevel: "safe" | "moderate" | "high" | "critical" }
> = {
  clear: {
    label: "Clear",
    color: "text-safe-foreground",
    bg: "bg-safe-soft border-safe/20",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    riskLevel: "safe",
  },
  heavy_traffic: {
    label: "Heavy traffic",
    color: "text-moderate-foreground",
    bg: "bg-moderate-soft border-moderate/20",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    riskLevel: "moderate",
  },
  flooded: {
    label: "Flooded",
    color: "text-critical",
    bg: "bg-critical-soft border-critical/20",
    icon: <XCircle className="h-3.5 w-3.5" />,
    riskLevel: "critical",
  },
  obstructed: {
    label: "Obstructed",
    color: "text-high-foreground",
    bg: "bg-high-soft border-high/20",
    icon: <XCircle className="h-3.5 w-3.5" />,
    riskLevel: "high",
  },
  low_visibility: {
    label: "Low visibility",
    color: "text-moderate-foreground",
    bg: "bg-moderate-soft border-moderate/20",
    icon: <EyeOff className="h-3.5 w-3.5" />,
    riskLevel: "moderate",
  },
  landslide: {
    label: "Landslide",
    color: "text-critical",
    bg: "bg-critical-soft border-critical/20",
    icon: <XCircle className="h-3.5 w-3.5" />,
    riskLevel: "critical",
  },
  bridge_damage: {
    label: "Bridge damage",
    color: "text-critical",
    bg: "bg-critical-soft border-critical/20",
    icon: <XCircle className="h-3.5 w-3.5" />,
    riskLevel: "critical",
  },
};

// ── Demo cameras seeded for Nepal flood scenario ──────────────────────────────
const DEMO_CAMERAS: DemoCamera[] = [
  {
    id: "CAM-001",
    label: "Bagmati Bridge North",
    district: "Kathmandu",
    lat: 27.6845,
    lng: 85.3011,
    status: "online",
    nearbyRoad: "Bagmati Bridge – Balkhu",
    observation: "bridge_damage",
    lastSeen: "2 min ago",
    routeImpact: "critical",
  },
  {
    id: "CAM-002",
    label: "Sanga Underpass",
    district: "Kavrepalanchok",
    lat: 27.682,
    lng: 85.445,
    status: "online",
    nearbyRoad: "Araniko Highway (Sanga stretch)",
    observation: "flooded",
    lastSeen: "5 min ago",
    routeImpact: "critical",
  },
  {
    id: "CAM-003",
    label: "Malekhu Slide Zone",
    district: "Dhading",
    lat: 27.795,
    lng: 84.9,
    status: "online",
    nearbyRoad: "Prithvi Highway (Malekhu segment)",
    observation: "landslide",
    lastSeen: "8 min ago",
    routeImpact: "critical",
  },
  {
    id: "CAM-004",
    label: "Ring Road North",
    district: "Kathmandu",
    lat: 27.718,
    lng: 85.345,
    status: "online",
    nearbyRoad: "Ring Road North",
    observation: "clear",
    lastSeen: "1 min ago",
    routeImpact: "none",
  },
  {
    id: "CAM-005",
    label: "Sanga Bypass Entry",
    district: "Kavrepalanchok",
    lat: 27.69,
    lng: 85.49,
    status: "online",
    nearbyRoad: "Sanga Bypass Track",
    observation: "clear",
    lastSeen: "3 min ago",
    routeImpact: "none",
  },
  {
    id: "CAM-006",
    label: "Kalanki Junction",
    district: "Kathmandu",
    lat: 27.693,
    lng: 85.281,
    status: "online",
    nearbyRoad: "Kalanki – Thankot Corridor",
    observation: "heavy_traffic",
    lastSeen: "4 min ago",
    routeImpact: "moderate",
  },
  {
    id: "CAM-007",
    label: "Itahari Tollgate",
    district: "Sunsari",
    lat: 26.464,
    lng: 87.281,
    status: "offline",
    nearbyRoad: "East-West Highway (Itahari link)",
    observation: "flooded",
    lastSeen: "47 min ago",
    routeImpact: "high",
  },
  {
    id: "CAM-008",
    label: "Bhaktapur Inner Loop",
    district: "Bhaktapur",
    lat: 27.671,
    lng: 85.429,
    status: "online",
    nearbyRoad: "Bhaktapur Inner Loop",
    observation: "clear",
    lastSeen: "1 min ago",
    routeImpact: "none",
  },
];

// ── Camera → Road → Route workflow ───────────────────────────────────────────
const WORKFLOW_STEPS = [
  {
    icon: Camera,
    label: "Camera Observation",
    desc: "Visual feed analysed",
    color: "bg-primary",
  },
  {
    icon: MapPin,
    label: "Road Condition",
    desc: "Segment risk updated",
    color: "bg-high",
  },
  {
    icon: ShieldAlert,
    label: "Route Risk",
    desc: "Corridor re-scored",
    color: "bg-moderate-foreground",
  },
  {
    icon: RouteIcon,
    label: "Safe Route",
    desc: "Alternative recommended",
    color: "bg-safe",
  },
] as const;

// ── SVG schematic map showing camera locations ────────────────────────────────
function CameraSchematicMap({ cameras, selected, onSelect }: {
  cameras: DemoCamera[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  // Simple lat/lng to SVG projection for Nepal area
  const minLat = 26.3, maxLat = 27.9, minLng = 84.2, maxLng = 87.6;
  function proj(lat: number, lng: number) {
    const x = ((lng - minLng) / (maxLng - minLng)) * 96 + 2;
    const y = 98 - ((lat - minLat) / (maxLat - minLat)) * 96;
    return { x, y };
  }

  const obsToColor = (obs: CameraObservation, status: CameraStatus) => {
    if (status === "offline") return "var(--color-muted-foreground)";
    const riskLevel = OBS_CONFIG[obs].riskLevel;
    if (riskLevel === "critical") return "var(--color-critical)";
    if (riskLevel === "high") return "var(--color-high)";
    if (riskLevel === "moderate") return "var(--color-moderate)";
    return "var(--color-safe)";
  };

  return (
    <div
      className="panel overflow-hidden"
      role="img"
      aria-label={`Schematic map showing ${cameras.length} camera locations across Nepal`}
    >
      <div className="border-b border-border px-4 py-2.5 flex items-center justify-between">
        <p className="label-caps">Camera locations</p>
      </div>
      <svg
        viewBox="0 0 100 100"
        className="h-64 w-full bg-secondary/40 sm:h-80"
        preserveAspectRatio="none"
      >
        {/* Grid */}
        <defs>
          <pattern id="cam-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="currentColor" strokeWidth="0.1" opacity="0.12" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#cam-grid)" className="text-muted-foreground" />

        {/* Camera markers */}
        {cameras.map((cam) => {
          const { x, y } = proj(cam.lat, cam.lng);
          const color = obsToColor(cam.observation, cam.status);
          const isSelected = cam.id === selected;
          return (
            <g key={cam.id} className="cursor-pointer" onClick={() => onSelect(cam.id)} role="button" aria-label={`Camera ${cam.id}: ${cam.label} — ${OBS_CONFIG[cam.observation].label}`}>
              {/* Pulse ring for critical */}
              {(cam.observation === "flooded" || cam.observation === "bridge_damage" || cam.observation === "landslide") && (
                <circle cx={x} cy={y} r="4" fill={color} opacity="0.2" />
              )}
              {isSelected && (
                <circle cx={x} cy={y} r="5.5" fill="none" stroke="var(--color-primary)" strokeWidth="0.6" />
              )}
              <circle cx={x} cy={y} r="2.2" fill={color} stroke="white" strokeWidth="0.4" />
              {/* Camera icon — tiny rectangle */}
              <rect
                x={x - 1}
                y={y - 0.7}
                width="2"
                height="1.4"
                rx="0.3"
                fill="white"
                opacity="0.9"
              />
              {/* Label */}
              <text
                x={x + 2.8}
                y={y + 0.5}
                fontSize="1.8"
                fill="currentColor"
                className="text-foreground"
              >
                {cam.id}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-[10px] text-muted-foreground">
        {[
          { color: "var(--color-safe)", label: "Clear" },
          { color: "var(--color-moderate)", label: "Caution" },
          { color: "var(--color-high)", label: "Hazardous" },
          { color: "var(--color-critical)", label: "Blocked / flooded" },
          { color: "var(--color-muted-foreground)", label: "Offline" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: l.color }}
              aria-hidden="true"
            />
            {l.label}
          </span>
        ))}
      </div>

      {/* Screen-reader text fallback */}
      <details className="border-t border-border px-4 py-2 text-xs">
        <summary className="cursor-pointer text-muted-foreground">Camera list (text)</summary>
        <ul className="mt-2 space-y-0.5 text-muted-foreground">
          {cameras.map((c) => (
            <li key={c.id}>
              {c.id} — {c.label} ({c.district}): {OBS_CONFIG[c.observation].label},{" "}
              {c.status === "online" ? "online" : "offline"}, last seen {c.lastSeen}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

// ── Camera card ───────────────────────────────────────────────────────────────
function CameraCard({
  cam,
  selected,
  onClick,
}: {
  cam: DemoCamera;
  selected: boolean;
  onClick: () => void;
}) {
  const obs = OBS_CONFIG[cam.observation];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-all hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card"
      } ${cam.status === "offline" ? "opacity-60" : ""}`}
      aria-pressed={selected}
      aria-label={`${cam.label} — ${obs.label}`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${obs.bg} border`}
          aria-hidden="true"
        >
          {cam.status === "online" ? (
            <Eye className={`h-4 w-4 ${obs.color}`} />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] font-bold text-muted-foreground">{cam.id}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${obs.bg} ${obs.color}`}
            >
              {obs.icon}
              {obs.label}
            </span>
            {cam.status === "offline" && (
              <Badge variant="secondary" className="text-[10px]">OFFLINE</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs font-semibold text-foreground truncate">{cam.label}</p>
          <p className="text-[10px] text-muted-foreground">{cam.district} · {cam.lastSeen}</p>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            Near: {cam.nearbyRoad}
          </p>
        </div>
      </div>
    </button>
  );
}

// ── Detail panel for selected camera ─────────────────────────────────────────
function CameraDetailPanel({ cam }: { cam: DemoCamera }) {
  const { data: roads } = useRoads();
  const obs = OBS_CONFIG[cam.observation];

  const affectedRoad = useMemo(
    () => roads?.find((r) => r.road_name === cam.nearbyRoad) ?? null,
    [roads, cam.nearbyRoad],
  );

  const workflowActive = cam.observation !== "clear" && cam.status === "online";

  return (
    <div className="panel overflow-hidden h-full flex flex-col">
      <div className="border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-bold text-muted-foreground">{cam.id}</span>
          {cam.status === "online" ? (
            <Badge variant="outline" className="text-[10px] bg-safe-soft text-safe-foreground border-safe/20 gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-safe animate-pulse" />
              Online
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">Offline</Badge>
          )}
        </div>
        <p className="mt-1 text-sm font-semibold text-foreground">{cam.label}</p>
        <p className="text-xs text-muted-foreground">{cam.district} · Last update: {cam.lastSeen}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Simulated feed placeholder */}
        <div
          className={`relative rounded-xl border overflow-hidden ${obs.bg}`}
          aria-label="Simulated camera preview — not a real feed"
        >
          <div className="flex h-36 items-center justify-center">
            <div className="text-center">
              <Camera className={`mx-auto mb-2 h-8 w-8 ${obs.color}`} aria-hidden="true" />
              <p className={`text-sm font-semibold ${obs.color}`}>{obs.label.toUpperCase()}</p>
              {cam.status === "offline" && (
                <p className="text-xs text-muted-foreground mt-1">No signal</p>
              )}
            </div>
          </div>
          <div className="absolute bottom-2 right-2">
            <Badge className="text-[10px] bg-black/60 text-white border-0">
              Scenario feed — not live
            </Badge>
          </div>
          {cam.status === "online" && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
              SCENARIO
            </div>
          )}
        </div>

        {/* Observation detail */}
        <div className={`rounded-xl border p-3 ${obs.bg}`}>
          <p className="label-caps mb-2 flex items-center gap-1.5">
            <Eye className="h-3 w-3" />
            Current observation
          </p>
          <div className="flex items-center gap-2">
            <span className={`${obs.color}`} aria-hidden="true">{obs.icon}</span>
            <span className={`text-sm font-semibold ${obs.color}`}>{obs.label}</span>
            <SeverityBadge severity={obs.riskLevel} className="ml-auto" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Near road segment: <span className="font-medium text-foreground">{cam.nearbyRoad}</span>
          </p>
          {affectedRoad && (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="label-caps">DB road state</p>
                <p className="font-medium capitalize">{affectedRoad.state.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="label-caps">Risk rating</p>
                <p className="font-medium capitalize">{affectedRoad.risk}</p>
              </div>
            </div>
          )}
        </div>

        {/* Camera → Route workflow */}
        {workflowActive && (
          <div>
            <p className="label-caps mb-3 flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-primary" />
              Impact chain — this camera affects routing
            </p>
            <div className="space-y-1" role="list" aria-label="Camera to route impact chain">
              {[
                {
                  icon: Camera,
                  label: "Camera observation",
                  desc: obs.label,
                  color: "bg-primary/10 text-primary border-primary/20",
                },
                {
                  icon: MapPin,
                  label: "Road segment affected",
                  desc: cam.nearbyRoad,
                  color: "bg-high-soft text-high-foreground border-high/20",
                },
                {
                  icon: AlertTriangle,
                  label: "Route risk increased",
                  desc: "Corridors using this segment penalised",
                  color: "bg-high-soft text-high-foreground border-high/20",
                },
                {
                  icon: RouteIcon,
                  label: "Alternative route recommended",
                  desc: "Planner avoids this segment",
                  color: "bg-safe-soft text-safe-foreground border-safe/20",
                },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-start" role="listitem">
                  <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 w-full ${step.color}`}>
                    <step.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold">{step.label}</p>
                      <p className="text-[10px] opacity-75 truncate">{step.desc}</p>
                    </div>
                  </div>
                  {i < 3 && (
                    <div className="ml-4 h-3 w-px bg-border" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Button asChild size="sm" className="w-full gap-1.5">
                <Link to="/routes">
                  <Navigation className="h-3.5 w-3.5" />
                  Open Route Planner
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {cam.observation === "clear" && (
          <div className="flex items-center gap-2 rounded-lg border border-safe/20 bg-safe-soft px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-safe shrink-0" />
            <div>
              <p className="text-xs font-semibold text-safe-foreground">No route impact</p>
              <p className="text-[10px] text-muted-foreground">
                Segment is clear — normal routing applies
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function CCTVPage() {
  const [selectedId, setSelectedId] = useState<string | null>(DEMO_CAMERAS[0]?.id ?? null);
  const [filter, setFilter] = useState<"all" | "online" | "alert">("all");

  const selectedCam = DEMO_CAMERAS.find((c) => c.id === selectedId) ?? null;

  const filtered = DEMO_CAMERAS.filter((c) => {
    if (filter === "online") return c.status === "online";
    if (filter === "alert") return c.routeImpact !== "none" && c.status === "online";
    return true;
  });

  const onlineCount = DEMO_CAMERAS.filter((c) => c.status === "online").length;
  const alertCount = DEMO_CAMERAS.filter(
    (c) => c.routeImpact !== "none" && c.status === "online",
  ).length;
  const criticalCount = DEMO_CAMERAS.filter(
    (c) => c.routeImpact === "critical" && c.status === "online",
  ).length;

  return (
    <div>
      <PageHeader
        title="CCTV & Camera Intelligence"
        description="Camera observations → road risk → safe route recommendations"
      />

      <div className="p-4 sm:p-5 space-y-5">

        {/* One-time note */}
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Camera feeds shown here are scenario-based observations connected to road condition data.
            No private or real-time surveillance infrastructure is accessed.
          </span>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="panel p-3">
            <p className="label-caps mb-1">Cameras online</p>
            <p className="text-2xl font-bold font-display text-safe-foreground">{onlineCount}</p>
            <p className="text-[10px] text-muted-foreground">of {DEMO_CAMERAS.length} total</p>
          </div>
          <div className="panel p-3">
            <p className="label-caps mb-1">Route alerts</p>
            <p className={`text-2xl font-bold font-display ${alertCount > 0 ? "text-high-foreground" : "text-foreground"}`}>
              {alertCount}
            </p>
            <p className="text-[10px] text-muted-foreground">cameras affecting routes</p>
          </div>
          <div className="panel p-3">
            <p className="label-caps mb-1">Critical obs</p>
            <p className={`text-2xl font-bold font-display ${criticalCount > 0 ? "text-critical" : "text-foreground"}`}>
              {criticalCount}
            </p>
            <p className="text-[10px] text-muted-foreground">blocked / flooded</p>
          </div>
        </div>

        {/* Workflow diagram */}
        <div className="panel overflow-hidden" aria-label="Camera to route workflow">
          <div className="border-b border-border px-4 py-2.5">
            <p className="label-caps">How camera intelligence feeds into routing</p>
          </div>
          <div className="flex items-center justify-center overflow-x-auto px-4 py-4 gap-1">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.label} className="flex items-center shrink-0">
                <div className="flex flex-col items-center text-center w-24 sm:w-28">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${step.color} shadow-sm`}
                    aria-hidden="true"
                  >
                    <step.icon className="h-4 w-4 text-white" />
                  </div>
                  <p className="mt-1.5 text-[11px] font-semibold text-foreground">{step.label}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className="mx-1 flex items-center">
                    <div className="h-px w-4 sm:w-6 bg-border" aria-hidden="true" />
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main content: map + camera list + detail */}
        <div className="grid gap-4 lg:grid-cols-[280px,1fr]">

          {/* Left: filter + camera list */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cameras ({DEMO_CAMERAS.length})</SelectItem>
                  <SelectItem value="online">Online only ({onlineCount})</SelectItem>
                  <SelectItem value="alert">Route impact ({alertCount})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filtered.map((cam) => (
                <CameraCard
                  key={cam.id}
                  cam={cam}
                  selected={cam.id === selectedId}
                  onClick={() => setSelectedId(cam.id)}
                />
              ))}
            </div>
          </div>

          {/* Right: map + detail */}
          <div className="space-y-4">
            <CameraSchematicMap
              cameras={filtered}
              selected={selectedId}
              onSelect={setSelectedId}
            />
            {selectedCam && (
              <div className="min-h-96">
                <CameraDetailPanel cam={selectedCam} />
              </div>
            )}
          </div>
        </div>

        {/* Scenario walkthrough */}
        <div className="panel overflow-hidden" aria-label="Demo scenario walkthrough">
          <div className="border-b border-border px-4 py-2.5 flex items-center justify-between">
            <p className="label-caps">Camera impact walkthrough</p>
          </div>
          <div className="overflow-x-auto px-4 py-4">
            <div className="flex items-center gap-0 min-w-max text-xs">
              {[
                { label: "CAM-002", sublabel: "Sanga Underpass", obs: "Flooded", color: "border-critical/30 bg-critical-soft text-critical" },
                null,
                { label: "Road blocked", sublabel: "Araniko Highway", obs: "Impassable", color: "border-critical/30 bg-critical-soft text-critical" },
                null,
                { label: "Route risk ↑", sublabel: "Kathmandu→Dhulikhel", obs: "Corridor flagged", color: "border-high/30 bg-high-soft text-high-foreground" },
                null,
                { label: "Alternative", sublabel: "Sanga Bypass Track", obs: "Recommended", color: "border-safe/30 bg-safe-soft text-safe-foreground" },
                null,
                { label: "Ambulance", sublabel: "AMB-101", obs: "Rerouted", color: "border-primary/30 bg-primary/5 text-primary" },
              ].map((item, i) => {
                if (item === null) {
                  return (
                    <div key={i} className="flex items-center mx-1">
                      <div className="h-px w-5 bg-border" />
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                  );
                }
                return (
                  <div
                    key={i}
                    className={`rounded-lg border px-3 py-2 text-center min-w-[110px] ${item.color}`}
                  >
                    <p className="font-mono text-[10px] font-bold">{item.label}</p>
                    <p className="text-[9px] opacity-75 mt-0.5">{item.sublabel}</p>
                    <p className="text-[9px] font-medium mt-1">{item.obs}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
