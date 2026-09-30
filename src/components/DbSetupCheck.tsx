/**
 * DbSetupCheck — shows a dismissible banner when critical Supabase tables
 * are missing from the schema cache (i.e. migrations were never applied).
 *
 * Rendered once in the app root. Performs a lightweight probe on mount.
 * Dismissed per-session (localStorage).
 */
import { useEffect, useState } from "react";
import { AlertTriangle, X, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DISMISS_KEY = "reshmesq.dbSetupDismissed";

type CheckResult = "ok" | "missing_tables" | "checking";

const REQUIRED_TABLES = ["emergency_incidents", "missing_persons", "road_conditions"];

async function checkTables(): Promise<{ status: CheckResult; missing: string[] }> {
  const missing: string[] = [];
  for (const table of REQUIRED_TABLES) {
    const { error } = await (supabase.from(table as "emergency_incidents") as ReturnType<typeof supabase.from>)
      .select("id")
      .limit(1)
      .maybeSingle();
    // PGRST116 = no rows (table exists, just empty) — that's fine
    // 42P01 / "does not exist" / "schema cache" = table missing
    if (
      error &&
      (error.code === "42P01" ||
        error.message.includes("does not exist") ||
        error.message.includes("schema cache"))
    ) {
      missing.push(table);
    }
  }
  return { status: missing.length === 0 ? "ok" : "missing_tables", missing };
}

export function DbSetupCheck() {
  const [result, setResult] = useState<CheckResult>("checking");
  const [missingTables, setMissingTables] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (dismissed) return;
    checkTables().then(({ status, missing }) => {
      setResult(status);
      setMissingTables(missing);
    });
  }, [dismissed]);

  if (dismissed || result === "checking" || result === "ok") return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-[9999] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 rounded-xl border border-critical/40 bg-critical-soft shadow-xl text-critical"
    >
      <div className="flex items-start gap-3 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Database setup required</p>
          <p className="text-xs mt-1 text-critical/80">
            The following table{missingTables.length !== 1 ? "s are" : " is"} missing from your Supabase project:{" "}
            <code className="font-mono font-bold">{missingTables.join(", ")}</code>.
            Features like incident reporting and missing-person submissions will not work until the schema is applied.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-critical/40 bg-white/30 px-3 py-1.5 text-xs font-semibold hover:bg-white/50 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Open Supabase SQL Editor
            </a>
            <span className="text-xs self-center text-critical/70">
              Run: <code className="font-mono">drizzle/migrations/APPLY_ALL_IDEMPOTENT.sql</code>
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
          }}
          className="shrink-0 rounded-full p-0.5 hover:bg-critical/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Dismiss setup warning"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
