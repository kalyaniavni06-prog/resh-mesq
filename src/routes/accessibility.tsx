import { createFileRoute } from "@tanstack/react-router";
import {
  Sun,
  Moon,
  Contrast,
  Type,
  Volume2,
  VolumeX,
  CheckCircle2,
  Info,
  Keyboard,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { usePreferences, type TextScale, type ThemeMode } from "@/lib/preferences";

export const Route = createFileRoute("/accessibility")({
  component: AccessibilityPage,
});

function AccessibilityPage() {
  const { theme, highContrast, textScale, voice, setTheme, setHighContrast, setTextScale, setVoice, announce } =
    usePreferences();

  function handleTheme(t: ThemeMode) {
    setTheme(t);
    announce(`Theme changed to ${t} mode`, { speak: true });
  }

  function handleHighContrast(v: boolean) {
    setHighContrast(v);
    announce(`High contrast ${v ? "enabled" : "disabled"}`, { speak: true });
  }

  function handleTextScale(v: TextScale) {
    setTextScale(v);
    announce(`Text size set to ${v}`, { speak: true });
  }

  function handleVoice(v: boolean) {
    setVoice(v);
    if (v) announce("Voice guidance enabled", { speak: true });
  }

  return (
    <div>
      <PageHeader
        title="Accessibility Settings"
        description="Customise the platform for your visual and accessibility needs"
      />

      <div className="p-6 max-w-2xl space-y-6">
        {/* Theme */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Colour Theme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  { value: "light", label: "Light", icon: Sun },
                  { value: "dark", label: "Dark", icon: Moon },
                ] as { value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[]
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleTheme(value)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    theme === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50"
                  }`}
                  aria-pressed={theme === value}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {theme === value && <CheckCircle2 className="ml-auto h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* High contrast */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Contrast className="h-4 w-4" />
              High Contrast Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="hc-switch" className="text-sm font-medium cursor-pointer">
                  Enable high contrast
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Increases colour contrast for improved readability for low-vision users
                </p>
              </div>
              <Switch
                id="hc-switch"
                checked={highContrast}
                onCheckedChange={handleHighContrast}
                aria-label="Toggle high contrast mode"
              />
            </div>
          </CardContent>
        </Card>

        {/* Text scale */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Type className="h-4 w-4" />
              Text Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { value: "base", label: "Default", sample: "Aa" },
                  { value: "lg", label: "Large", sample: "Aa" },
                  { value: "xl", label: "Extra large", sample: "Aa" },
                ] as { value: TextScale; label: string; sample: string }[]
              ).map(({ value, label, sample }) => (
                <button
                  key={value}
                  onClick={() => handleTextScale(value)}
                  className={`flex flex-col items-center rounded-lg border px-4 py-3 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    textScale === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50"
                  }`}
                  aria-pressed={textScale === value}
                >
                  <span
                    className={`font-bold leading-none mb-1 ${
                      value === "base" ? "text-base" : value === "lg" ? "text-xl" : "text-2xl"
                    }`}
                  >
                    {sample}
                  </span>
                  <span className="text-xs">{label}</span>
                  {textScale === value && <CheckCircle2 className="mt-1 h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Voice guidance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              {voice ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              Voice Guidance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="voice-switch" className="text-sm font-medium cursor-pointer">
                  Enable voice announcements
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Uses the browser's speech synthesis API to read status changes and alerts aloud
                </p>
              </div>
              <Switch
                id="voice-switch"
                checked={voice}
                onCheckedChange={handleVoice}
                aria-label="Toggle voice guidance"
              />
            </div>
            {voice && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => announce("Voice guidance is working correctly. RESH MESQ is ready.", { speak: true })}
              >
                <Volume2 className="h-3.5 w-3.5" />
                Test voice
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Keyboard navigation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Keyboard Navigation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {[
              { key: "Tab", desc: "Move focus to next interactive element" },
              { key: "Shift + Tab", desc: "Move focus to previous element" },
              { key: "Enter / Space", desc: "Activate buttons and controls" },
              { key: "Esc", desc: "Close dialogs and dropdowns" },
              { key: "Arrow keys", desc: "Navigate within menus and lists" },
            ].map(({ key, desc }) => (
              <div key={key} className="flex items-center gap-3">
                <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs shrink-0">
                  {key}
                </kbd>
                <span>{desc}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Reduced motion info */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium text-foreground">Reduced motion</p>
            <p className="mt-0.5">
              RESH MESQ automatically detects and respects your operating system's
              "Reduce motion" preference. All animations are suppressed when enabled.
            </p>
          </div>
        </div>

        {/* Screen reader info */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium text-foreground">Screen reader support</p>
            <p className="mt-0.5">
              The platform uses semantic HTML, ARIA live regions, and descriptive labels throughout.
              Status changes and critical alerts are announced to screen readers automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
