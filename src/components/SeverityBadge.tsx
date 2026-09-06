import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Severity = Database["public"]["Enums"]["severity_level"];

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; classes: string }
> = {
  critical: {
    label: "Critical",
    classes: "bg-critical-soft text-critical border-critical/20",
  },
  high: {
    label: "High",
    classes: "bg-high-soft text-high-foreground border-high/20",
  },
  moderate: {
    label: "Moderate",
    classes: "bg-moderate-soft text-moderate-foreground border-moderate/20",
  },
  safe: {
    label: "Safe",
    classes: "bg-safe-soft text-safe-foreground border-safe/20",
  },
};

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
  dot?: boolean;
}

export function SeverityBadge({ severity, className, dot = false }: SeverityBadgeProps) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
        cfg.classes,
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            severity === "critical" && "bg-critical",
            severity === "high" && "bg-high",
            severity === "moderate" && "bg-moderate",
            severity === "safe" && "bg-safe",
          )}
          aria-hidden="true"
        />
      )}
      {cfg.label}
    </span>
  );
}

// Dot-only variant for compact displays
export function SeverityDot({ severity }: { severity: Severity }) {
  const colors: Record<Severity, string> = {
    critical: "bg-critical",
    high: "bg-high",
    moderate: "bg-moderate",
    safe: "bg-safe",
  };
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full shrink-0", colors[severity])}
      aria-label={severity}
    />
  );
}
