import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Accessibility,
  ActivitySquare,
  AlertTriangle,
  BarChart3,
  Hospital,
  Map,
  Route as RouteIcon,
  Siren,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RESH MESQ — Disaster-Safe Emergency Route Optimizer" },
      {
        name: "description",
        content:
          "RESH MESQ finds the safest usable route for ambulances and rescue teams during floods, landslides and road failures — not just the shortest one.",
      },
      { property: "og:title", content: "RESH MESQ — Disaster-Safe Emergency Route Optimizer" },
      {
        property: "og:description",
        content:
          "Command dashboard, live disaster intelligence and safe routing for emergency responders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const capabilities = [
  {
    icon: ActivitySquare,
    title: "Emergency command dashboard",
    body: "Open emergencies, crew availability, blocked roads and high-risk areas on one screen.",
    to: "/dashboard" as const,
  },
  {
    icon: Map,
    title: "Interactive emergency map",
    body: "Vehicles, hospitals, shelters, flood and landslide zones, damaged bridges and safe roads.",
    to: "/dashboard" as const,
  },
  {
    icon: RouteIcon,
    title: "Smart safe routing",
    body: "Fastest, safest and alternative corridors with ETA, risk level and a written explanation.",
    to: "/route-planner" as const,
  },
  {
    icon: AlertTriangle,
    title: "Disaster intelligence",
    body: "Flood, landslide, road, bridge and weather alerts graded Critical, High, Moderate or Safe.",
    to: "/alerts" as const,
  },
  {
    icon: Siren,
    title: "Incident management",
    body: "Severity, people affected, road access, required service and status from new to resolved.",
    to: "/incidents" as const,
  },
  {
    icon: Hospital,
    title: "Hospitals & shelters",
    body: "Nearest facilities with straight-line distance, estimated arrival time and free beds.",
    to: "/resources" as const,
  },
  {
    icon: Truck,
    title: "Vehicle tracking",
    body: "Ambulances, fire units and rescue crews with simulated movement for demonstration.",
    to: "/vehicles" as const,
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "Response mix, severity spread, network health and where the network is failing.",
    to: "/analytics" as const,
  },
];

function Landing() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:py-28">
          <p className="label-caps text-primary">Intelligent emergency response</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Every Minute Matters.
            <br />
            Every Route Matters.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            RESH MESQ plans disaster-safe routes for emergency crews. When a bridge is down or a
            highway is under water, the shortest route is often the wrong one — RESH MESQ scores every
            corridor for hazard, then explains the choice.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2 font-semibold">
              <Link to="/dashboard">
                <ActivitySquare className="size-5" aria-hidden="true" />
                Open Emergency Dashboard
              </Link>
            </Button>
            <Button asChild size="lg" variant="destructive" className="gap-2 font-semibold">
              <Link to="/report">
                <Siren className="size-5" aria-hidden="true" />
                Raise an SOS
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <Link to="/route-planner">
                <RouteIcon className="size-5" aria-hidden="true" />
                Plan a safe route
              </Link>
            </Button>
          </div>
          <p className="mt-8 max-w-2xl rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
            AI is decision support. Verify before real-world action. Contact details, camera feeds and
            vehicle movement in this build are clearly-labelled demonstration data.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="font-display text-2xl font-bold tracking-tight">
          Eleven working areas, one operating picture
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((item) => (
            <Link
              key={item.title}
              to={item.to}
              className="panel group p-5 transition-colors hover:border-primary/50"
            >
              <item.icon className="size-6 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-display text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 lg:grid-cols-3">
          <div>
            <Accessibility className="size-7 text-primary" aria-hidden="true" />
            <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">
              Built to be usable when it matters most
            </h2>
            <p className="mt-3 text-muted-foreground">
              Light and dark themes, a high-contrast mode, three text sizes, full keyboard operation,
              spoken guidance for blind and low-vision users, and a text version of every map.
            </p>
            <Button asChild variant="outline" className="mt-5">
              <Link to="/accessibility">Accessibility features</Link>
            </Button>
          </div>
          <div className="panel p-6 lg:col-span-2">
            <p className="label-caps">Why a hazard-aware route</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <span className="font-semibold">Blocked links are removed, not penalised.</span> A
                damaged bridge or blocked road is never offered, however short it is.
              </li>
              <li>
                <span className="font-semibold">Risk costs minutes.</span> Flooded, landslide-prone
                and high-risk stretches carry a time penalty so a longer safe corridor can win.
              </li>
              <li>
                <span className="font-semibold">Every result is explained.</span> You see the roads
                used, the roads avoided and the reason each was rejected.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
