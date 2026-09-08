import { useCallback } from "react";
import { Accessibility, Contrast, Moon, Sun, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { usePreferences, type TextScale } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { useAlerts, useIncidents, useRoads, useVehicles } from "@/hooks/useSupabaseData";

const scales: { value: TextScale; label: string }[] = [
  { value: "base", label: "Normal" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Largest" },
];

export function A11yToolbar() {
  const prefs = usePreferences();

  // Data for page description
  const { data: alerts } = useAlerts(true);
  const { data: incidents } = useIncidents();
  const { data: roads } = useRoads();
  const { data: vehicles } = useVehicles();

  const describePage = useCallback(() => {
    const openInc = (incidents ?? []).filter((i) => i.status !== "resolved").length;
    const critInc = (incidents ?? []).filter((i) => i.severity === "critical" && i.status !== "resolved").length;
    const blocked = (roads ?? []).filter((r) => r.state !== "open" && r.state !== "high_risk").length;
    const avail = (vehicles ?? []).filter((v) => v.status === "available").length;
    const activeAlerts = (alerts ?? []).filter((a) => a.active).length;
    const critAlerts = (alerts ?? []).filter((a) => a.active && a.severity === "critical").length;

    const msg = [
      `RESH MESQ status.`,
      `${openInc} active incident${openInc !== 1 ? "s" : ""}, ${critInc} critical.`,
      `${blocked} road${blocked !== 1 ? "s" : ""} blocked.`,
      `${avail} vehicle${avail !== 1 ? "s" : ""} available.`,
      `${activeAlerts} alert${activeAlerts !== 1 ? "s" : ""} active, ${critAlerts} critical.`,
    ].join(" ");

    prefs.announce(msg, { assertive: true, speak: true });
  }, [prefs, alerts, incidents, roads, vehicles]);

  return (
    <div className="flex items-center gap-1" role="toolbar" aria-label="Accessibility controls">
      {/* Describe page — screen reader + voice shortcut */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Describe current page status aloud"
        title="Describe page (voice summary)"
        onClick={describePage}
      >
        <Volume2 className="size-4" aria-hidden="true" />
      </Button>

      {/* Voice on/off toggle */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={prefs.voice ? "Turn voice guidance off" : "Turn voice guidance on"}
        aria-pressed={prefs.voice}
        title={prefs.voice ? "Voice guidance: on" : "Voice guidance: off"}
        onClick={() => {
          const next = !prefs.voice;
          prefs.setVoice(next);
          if (next) {
            prefs.announce(
              "Voice guidance on. RESH MESQ will read out alerts, status changes and route information.",
              { speak: true },
            );
          }
        }}
      >
        {prefs.voice ? (
          <Volume2 className="size-4 text-primary" aria-hidden="true" />
        ) : (
          <VolumeX className="size-4" aria-hidden="true" />
        )}
      </Button>

      {/* Light / dark toggle */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={prefs.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        aria-pressed={prefs.theme === "dark"}
        onClick={() => {
          prefs.toggleTheme();
          prefs.announce(prefs.theme === "dark" ? "Light theme" : "Dark theme", { speak: true });
        }}
      >
        {prefs.theme === "dark" ? (
          <Sun className="size-4" aria-hidden="true" />
        ) : (
          <Moon className="size-4" aria-hidden="true" />
        )}
      </Button>

      {/* Full accessibility panel */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open accessibility settings panel"
            title="Accessibility settings"
          >
            <Accessibility className="size-4" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 space-y-4" role="dialog" aria-label="Accessibility settings">
          <p className="label-caps">Accessibility</p>

          {/* Voice guidance */}
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="pref-voice" className="text-sm font-medium cursor-pointer">
              Voice guidance
            </Label>
            <Switch
              id="pref-voice"
              checked={prefs.voice}
              onCheckedChange={(value) => {
                prefs.setVoice(value);
                if (value) prefs.announce("Voice guidance on.", { speak: true });
              }}
            />
          </div>

          {/* Describe page button in panel */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 justify-start"
            onClick={describePage}
            disabled={!prefs.voice}
            aria-label="Describe current page status aloud"
          >
            <Volume2 className="size-4" aria-hidden="true" />
            Describe current page
          </Button>

          {/* High contrast */}
          <div className="flex items-center justify-between gap-3">
            <Label
              htmlFor="pref-contrast"
              className="flex items-center gap-2 text-sm font-medium cursor-pointer"
            >
              <Contrast className="size-4" aria-hidden="true" />
              High contrast
            </Label>
            <Switch
              id="pref-contrast"
              checked={prefs.highContrast}
              onCheckedChange={(value) => {
                prefs.setHighContrast(value);
                prefs.announce(value ? "High contrast on" : "High contrast off", { speak: true });
              }}
            />
          </div>

          {/* Text size */}
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Text size</legend>
            <div className="flex gap-2" role="group" aria-label="Text size options">
              {scales.map((scale) => (
                <button
                  key={scale.value}
                  type="button"
                  aria-pressed={prefs.textScale === scale.value}
                  onClick={() => {
                    prefs.setTextScale(scale.value);
                    prefs.announce(`Text size ${scale.label}`, { speak: true });
                  }}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    prefs.textScale === scale.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:bg-accent",
                  )}
                >
                  {scale.label}
                </button>
              ))}
            </div>
          </fieldset>

          <p className="text-xs text-muted-foreground">
            Press{" "}
            <kbd className="rounded border border-border bg-muted px-1 font-mono">Shift</kbd>{" "}
            +{" "}
            <kbd className="rounded border border-border bg-muted px-1 font-mono">S</kbd>{" "}
            anywhere to open the SOS report.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
