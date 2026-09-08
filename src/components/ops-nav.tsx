import { Link } from "@tanstack/react-router";

const items = [
  { to: "/incidents", label: "Overview" },
  { to: "/incidents", label: "Incidents" },
  { to: "/routes", label: "Safe routes" },
  { to: "/roads", label: "Road conditions" },
  { to: "/vehicles", label: "Vehicles" },
  { to: "/alerts", label: "Alert centre" },
  { to: "/cctv", label: "CCTV" },
  { to: "/facilities", label: "Hospitals & shelters" },
  { to: "/analytics", label: "Analytics" },
] as const;

export function OpsNav() {
  return (
    <nav aria-label="Operations" className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          activeProps={{ className: "border-primary bg-primary/10 text-foreground" }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-6">
      <p className="label-caps text-primary">{eyebrow}</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
    </header>
  );
}

export function DemoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-border bg-secondary/50 px-4 py-3 text-xs text-muted-foreground">
      {children}
    </p>
  );
}
