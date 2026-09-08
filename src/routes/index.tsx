import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  Navigation,
  Radio,
  Route as RouteIcon,
  Shield,
  ShieldAlert,
  Siren,
  Truck,
  XCircle,
  Zap,
  Camera,
  BarChart3,
  Hospital,
  Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RESH MESQ — Disaster-Safe Emergency Route Optimizer" },
      {
        name: "description",
        content:
          "RESH MESQ is an intelligent emergency response and disaster-safe route optimization platform for Nepal flood conditions.",
      },
      { property: "og:title", content: "RESH MESQ — Disaster-Safe Emergency Route Optimizer" },
      {
        property: "og:description",
        content:
          "Command dashboard, live disaster intelligence and hazard-aware routing for emergency responders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

// ── Visual emergency workflow steps ─────────────────────────────────────────
const WORKFLOW = [
  { icon: Radio, label: "Incident", sub: "SOS received", color: "bg-critical text-white" },
  { icon: AlertTriangle, label: "Assess", sub: "Severity evaluated", color: "bg-high text-white" },
  { icon: Truck, label: "Dispatch", sub: "Vehicle assigned", color: "bg-moderate-foreground text-white" },
  { icon: RouteIcon, label: "Route", sub: "Safe path computed", color: "bg-primary text-white" },
  { icon: Navigation, label: "Respond", sub: "En route", color: "bg-primary text-white" },
  { icon: CheckCircle2, label: "Resolve", sub: "Incident closed", color: "bg-safe text-white" },
] as const;

// ── Nepal scenario demo: road-disruption visual ──────────────────────────────
const SCENARIO_ROADS = [
  { label: "Araniko Highway (Sanga)", state: "flooded", icon: "🌊", blocked: true, note: "Impassable — 1.2m water" },
  { label: "Bagmati Bridge – Balkhu", state: "bridge_damaged", icon: "🏗️", blocked: true, note: "Closed — structural damage" },
  { label: "Prithvi Highway (Malekhu)", state: "landslide", icon: "⛰️", blocked: true, note: "Debris clearance ongoing" },
  { label: "Sanga Bypass Track", state: "open", icon: "✅", blocked: false, note: "Gravel bypass — verified open" },
  { label: "Kanti Rajpath (alternate)", state: "open", icon: "✅", blocked: false, note: "Longer but accessible" },
] as const;

// ── Feature modules ──────────────────────────────────────────────────────────
const MODULES = [
  {
    to: "/command",
    icon: ShieldAlert,
    label: "Command Centre",
    sub: "Live operational picture",
    color: "text-critical",
  },
  {
    to: "/incidents",
    icon: Siren,
    label: "Incident Management",
    sub: "Track & resolve emergencies",
    color: "text-high",
  },
  {
    to: "/routes",
    icon: RouteIcon,
    label: "Safe Route Planner",
    sub: "Hazard-aware routing",
    color: "text-primary",
  },
  {
    to: "/alerts",
    icon: AlertTriangle,
    label: "Alert Centre",
    sub: "Flood · Landslide · Weather",
    color: "text-high",
  },
  {
    to: "/cctv",
    icon: Camera,
    label: "CCTV Intelligence",
    sub: "Camera → road → route",
    color: "text-primary",
  },
  {
    to: "/vehicles",
    icon: Truck,
    label: "Vehicle Tracking",
    sub: "Fleet status & dispatch",
    color: "text-moderate-foreground",
  },
  {
    to: "/facilities",
    icon: Hospital,
    label: "Hospitals & Shelters",
    sub: "Nearest facilities & beds",
    color: "text-safe",
  },
  {
    to: "/map",
    icon: Map,
    label: "Community Map",
    sub: "Crowd-sourced pin drops",
    color: "text-primary",
  },
  {
    to: "/analytics",
    icon: BarChart3,
    label: "Analytics",
    sub: "Response metrics & trends",
    color: "text-muted-foreground",
  },
] as const;

function Landing() {
  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden border-b border-border bg-gradient-to-br from-background via-background to-primary/5"
        aria-label="Product overview"
      >
        {/* Nepal Demo badge */}
        <div className="mx-auto max-w-7xl px-4 pt-6">
          <Badge
            variant="outline"
            className="gap-1.5 border-moderate/50 bg-moderate-soft text-moderate-foreground"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-moderate" aria-hidden="true" />
            NEPAL FLOOD DISASTER — DEMONSTRATION SCENARIO
          </Badge>
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-2 lg:items-center">
          {/* Left: headline + CTA */}
          <div>
            <p className="label-caps text-primary">Intelligent emergency response</p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              Every Minute Matters.
              <br />
              <span className="text-primary">Every Route Matters.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              RESH MESQ finds the safest usable route for ambulances and rescue teams during
              floods, landslides and road failures — scoring every corridor for hazard, then
              explaining the choice.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2 font-semibold">
                <Link to="/command">
                  <ShieldAlert className="size-5" aria-hidden="true" />
                  Open Command Centre
                </Link>
              </Button>
              <Button asChild size="lg" variant="destructive" className="gap-2 font-semibold">
                <Link to="/sos">
                  <Siren className="size-5" aria-hidden="true" />
                  Raise an SOS
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link to="/routes">
                  <RouteIcon className="size-5" aria-hidden="true" />
                  Plan a safe route
                </Link>
              </Button>
            </div>

            <p className="mt-5 max-w-xl rounded-lg border border-border bg-secondary/50 px-4 py-3 text-xs text-muted-foreground">
              <strong>Demo system.</strong> All incident data, vehicle positions, hospital contacts
              and camera feeds are clearly-labelled simulation data for the Nepal flood scenario.
              Do not use for real emergency dispatch.
            </p>
          </div>

          {/* Right: Nepal road scenario visual */}
          <div
            className="panel overflow-hidden"
            aria-label="Nepal disaster scenario — road conditions"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="label-caps">Nepal Flood Scenario — Road Network</p>
              <Badge variant="secondary" className="text-[10px]">DEMO DATA</Badge>
            </div>

            {/* Mini schematic: origin → roads → destination */}
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold">A</span>
                Kathmandu
                <span className="flex-1 border-t border-dashed border-border mx-1" />
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-safe text-white text-[10px] font-bold">B</span>
                Chitwan
              </div>

              {SCENARIO_ROADS.map((r) => (
                <div
                  key={r.label}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs ${
                    r.blocked
                      ? "bg-critical-soft border border-critical/20"
                      : "bg-safe-soft border border-safe/20"
                  }`}
                >
                  <span className="text-base" aria-hidden="true">{r.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium truncate ${r.blocked ? "text-critical" : "text-safe-foreground"}`}>
                      {r.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{r.note}</p>
                  </div>
                  {r.blocked ? (
                    <XCircle className="h-4 w-4 shrink-0 text-critical" aria-label="Blocked" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-safe" aria-label="Open" />
                  )}
                </div>
              ))}

              <div className="mt-3 flex items-center gap-2 rounded-md bg-primary/10 border border-primary/30 px-3 py-2 text-xs text-primary font-medium">
                <Navigation className="h-4 w-4 shrink-0" />
                RESH MESQ recommends: Sanga Bypass Track → Kanti Rajpath
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Emergency response workflow ──────────────────────────────────── */}
      <section className="border-b border-border bg-secondary/30 px-4 py-10" aria-label="Emergency response workflow">
        <div className="mx-auto max-w-7xl">
          <p className="label-caps text-center mb-6">How RESH MESQ responds to an emergency</p>
          <div className="flex flex-wrap items-center justify-center gap-0">
            {WORKFLOW.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center text-center w-24 sm:w-28">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full ${step.color} shadow-sm`}
                    aria-hidden="true"
                  >
                    <step.icon className="h-5 w-5" />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-foreground">{step.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{step.sub}</p>
                </div>
                {i < WORKFLOW.length - 1 && (
                  <div className="mx-1 mb-6 hidden sm:flex flex-col items-center">
                    <div className="h-px w-6 bg-border" />
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Mobile: vertical arrows */}
          <div className="flex flex-col items-center sm:hidden mt-4 space-y-1">
            {WORKFLOW.map((step, i) => (
              <div key={step.label} className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${step.color} shadow-sm`}
                  aria-hidden="true"
                >
                  <step.icon className="h-4 w-4" />
                </div>
                <p className="text-xs font-semibold text-foreground mt-1">{step.label}</p>
                {i < WORKFLOW.length - 1 && (
                  <ArrowDown className="h-4 w-4 text-muted-foreground my-1" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why hazard-aware routing ──────────────────────────────────────── */}
      <section className="border-b border-border px-4 py-10" aria-label="Why hazard-aware routing">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                icon: XCircle,
                color: "text-critical",
                bg: "bg-critical-soft border-critical/20",
                title: "Blocked links removed",
                body: "Damaged bridges and blocked roads are never offered — however short they are.",
              },
              {
                icon: AlertTriangle,
                color: "text-high",
                bg: "bg-high-soft border-high/20",
                title: "Risk costs time",
                body: "Flooded and landslide-prone stretches carry a penalty so a longer safe corridor can win.",
              },
              {
                icon: Zap,
                color: "text-safe",
                bg: "bg-safe-soft border-safe/20",
                title: "Every result explained",
                body: "Roads used, roads avoided, and the reason each was rejected — all shown visually.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className={`flex gap-4 rounded-xl border p-5 ${item.bg}`}
              >
                <item.icon className={`mt-0.5 h-6 w-6 shrink-0 ${item.color}`} aria-hidden="true" />
                <div>
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature modules grid ─────────────────────────────────────────── */}
      <section className="px-4 py-10" aria-label="Platform modules">
        <div className="mx-auto max-w-7xl">
          <p className="font-display text-xl font-bold tracking-tight">
            Nine working areas, one operating picture
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            All screens connect to the same live Supabase database.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {MODULES.map((mod) => (
              <Link
                key={mod.to}
                to={mod.to}
                className="panel group flex items-start gap-3 p-4 transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary"
                  aria-hidden="true"
                >
                  <mod.icon className={`h-5 w-5 ${mod.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                    {mod.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{mod.sub}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Accessibility ─────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-secondary/40 px-4 py-10" aria-label="Accessibility features">
        <div className="mx-auto max-w-7xl grid gap-6 lg:grid-cols-2 lg:items-center">
          <div>
            <Shield className="size-7 text-primary" aria-hidden="true" />
            <h2 className="mt-3 font-display text-xl font-bold tracking-tight">
              Designed for every operator
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Light/dark themes, high-contrast mode, three text sizes, full keyboard navigation,
              spoken guidance for blind and low-vision users, multilingual alerts in English and
              Nepali, and offline SOS queuing when connectivity fails.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/accessibility">Accessibility settings</Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Screen reader", desc: "ARIA labels throughout", icon: "👁️" },
              { label: "Voice guidance", desc: "Speech Synthesis API", icon: "🔊" },
              { label: "High contrast", desc: "WCAG-level contrast", icon: "◐" },
              { label: "Offline SOS", desc: "Queued when offline", icon: "📡" },
              { label: "Keyboard nav", desc: "Full tab & enter flow", icon: "⌨️" },
              { label: "Multilingual", desc: "English + Nepali", icon: "🌐" },
            ].map((f) => (
              <div
                key={f.label}
                className="panel flex items-center gap-3 px-3 py-2.5"
              >
                <span className="text-xl" aria-hidden="true">{f.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-foreground">{f.label}</p>
                  <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
