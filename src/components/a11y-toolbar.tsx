import { Accessibility, Contrast, Moon, Sun, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { usePreferences, type TextScale } from "@/lib/preferences";
import { cn } from "@/lib/utils";

const scales: { value: TextScale; label: string }[] = [
  { value: "base", label: "Normal" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Largest" },
];

export function A11yToolbar() {
  const prefs = usePreferences();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={prefs.voice ? "Turn voice guidance off" : "Turn voice guidance on"}
        aria-pressed={prefs.voice}
        onClick={() => {
          const next = !prefs.voice;
          prefs.setVoice(next);
          if (next) prefs.announce("Voice guidance on. RESH MESQ will read out alerts and directions.");
        }}
      >
        {prefs.voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label={prefs.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        aria-pressed={prefs.theme === "dark"}
        onClick={() => {
          prefs.toggleTheme();
          prefs.announce(prefs.theme === "dark" ? "Light theme" : "Dark theme");
        }}
      >
        {prefs.theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Accessibility settings">
            <Accessibility className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-4">
          <p className="label-caps">Accessibility</p>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="pref-voice" className="text-sm font-medium">
              Voice guidance
            </Label>
            <Switch
              id="pref-voice"
              checked={prefs.voice}
              onCheckedChange={(value) => {
                prefs.setVoice(value);
                if (value) prefs.announce("Voice guidance on.");
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="pref-contrast" className="flex items-center gap-2 text-sm font-medium">
              <Contrast className="size-4" aria-hidden="true" /> High contrast
            </Label>
            <Switch
              id="pref-contrast"
              checked={prefs.highContrast}
              onCheckedChange={(value) => {
                prefs.setHighContrast(value);
                prefs.announce(value ? "High contrast on" : "High contrast off");
              }}
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Text size</legend>
            <div className="flex gap-2" role="group">
              {scales.map((scale) => (
                <button
                  key={scale.value}
                  type="button"
                  aria-pressed={prefs.textScale === scale.value}
                  onClick={() => {
                    prefs.setTextScale(scale.value);
                    prefs.announce(`Text size ${scale.label}`);
                  }}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-sm transition-colors",
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
            Press <kbd className="rounded border px-1 font-mono">Shift</kbd> +{" "}
            <kbd className="rounded border px-1 font-mono">S</kbd> anywhere to open the SOS report.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
