import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-border bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  variant?: "default" | "critical" | "high" | "moderate" | "safe";
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "border-border",
  critical: "border-critical/30 bg-critical-soft",
  high: "border-high/30 bg-high-soft",
  moderate: "border-moderate/30 bg-moderate-soft",
  safe: "border-safe/30 bg-safe-soft",
};

const VALUE_CLASSES: Record<NonNullable<StatCardProps["variant"]>, string> = {
  default: "text-foreground",
  critical: "text-critical",
  high: "text-high-foreground",
  moderate: "text-moderate-foreground",
  safe: "text-safe-foreground",
};

export function StatCard({ label, value, sub, icon, variant = "default", className }: StatCardProps) {
  return (
    <div
      className={cn(
        "panel flex items-start justify-between p-4",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      <div>
        <p className="label-caps mb-1">{label}</p>
        <p className={cn("text-3xl font-bold font-display tabular-nums", VALUE_CLASSES[variant])}>
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </div>
      {icon && (
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
      )}
    </div>
  );
}
