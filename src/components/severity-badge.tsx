import { severityChip, severityDot, severityLabel, type Severity } from "@/lib/emergency";
import { cn } from "@/lib/utils";

export function SeverityBadge({
  severity,
  className,
  label,
}: {
  severity: Severity;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.6875rem] uppercase tracking-widest",
        severityChip[severity],
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", severityDot[severity])} />
      {label ?? severityLabel[severity]}
      <span className="sr-only"> severity</span>
    </span>
  );
}
