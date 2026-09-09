/**
 * Demo Mode — global toggle for Nepal flood scenario seed data.
 *
 * When ON  → pages show the seeded Nepal demonstration data.
 * When OFF → pages show only real user-submitted data (empty states when none).
 *
 * One small persistent banner appears at the bottom of the viewport when
 * demo mode is active so the state is always visible.  The banner can be
 * dismissed per-session (it reappears on next load).
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "reshmesq.demoMode";

type DemoModeCtx = {
  demoMode: boolean;
  toggleDemoMode: () => void;
};

const Ctx = createContext<DemoModeCtx>({ demoMode: false, toggleDemoMode: () => {} });

export function DemoModeProvider({ children }: { children: ReactNode }) {
  // Default: OFF (real data).  User can turn ON for presentation.
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setDemoMode(true);
    } catch { /* ignore */ }
  }, []);

  function toggleDemoMode() {
    setDemoMode((v) => {
      try { localStorage.setItem(STORAGE_KEY, v ? "0" : "1"); } catch { /* ignore */ }
      return !v;
    });
  }

  return (
    <Ctx.Provider value={{ demoMode, toggleDemoMode }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDemoMode() {
  return useContext(Ctx);
}

/** Floating banner shown only when demo mode is active. */
export function DemoModeBanner() {
  const { demoMode, toggleDemoMode } = useDemoMode();
  const [dismissed, setDismissed] = useState(false);

  if (!demoMode || dismissed) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-full border border-moderate/40 bg-moderate-soft px-4 py-2 shadow-lg text-sm text-moderate-foreground"
      role="status"
      aria-live="polite"
    >
      <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="font-medium">Nepal flood demo data active</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs rounded-full hover:bg-moderate/20"
        onClick={toggleDemoMode}
      >
        Turn off
      </Button>
      <button
        onClick={() => setDismissed(true)}
        className="rounded-full p-0.5 hover:bg-moderate/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-label="Dismiss demo mode banner"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Small inline chip — use this ONCE per page instead of repeating banners. */
export function DemoChip({ label = "Demo data" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-moderate/30 bg-moderate-soft px-2 py-0.5 text-[10px] font-medium text-moderate-foreground">
      <FlaskConical className="h-2.5 w-2.5" aria-hidden="true" />
      {label}
    </span>
  );
}
