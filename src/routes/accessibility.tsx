import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useRef } from "react";
import {
  Sun, Moon, Contrast, Type, Volume2, VolumeX,
  CheckCircle2, Info, Keyboard, Repeat, FileText,
  Mic, MicOff, Languages,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePreferences, type TextScale, type ThemeMode } from "@/lib/preferences";
import { useAlerts, useIncidents, useRoads, useVehicles } from "@/hooks/useSupabaseData";

export const Route = createFileRoute("/accessibility")({
  component: AccessibilityPage,
});

function AccessibilityPage() {
  const {
    theme, highContrast, textScale, voice,
    setTheme, setHighContrast, setTextScale, setVoice, announce,
  } = usePreferences();

  // Data for voice summaries
  const { data: alerts } = useAlerts(true);
  const { data: incidents } = useIncidents();
  const { data: roads } = useRoads();
  const { data: vehicles } = useVehicles();

  const [lastMsg, setLastMsg] = useState("");
  const [voiceEmergencyActive, setVoiceEmergencyActive] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"en" | "ne">("en");
  const lastMsgRef = useRef("");

  const speak = useCallback((msg: string, assertive = false) => {
    setLastMsg(msg);
    lastMsgRef.current = msg;
    announce(msg, { assertive, speak: true });
  }, [announce]);

  // ── Voice summary builders ────────────────────────────────────────────────
  function buildPageSummary(): string {
    const openInc = (incidents ?? []).filter((i) => i.status !== "resolved").length;
    const critInc = (incidents ?? []).filter((i) => i.severity === "critical" && i.status !== "resolved").length;
    const blockedRoads = (roads ?? []).filter((r) => r.state !== "open" && r.state !== "high_risk").length;
    const availVeh = (vehicles ?? []).filter((v) => v.status === "available").length;
    const activeAlerts = (alerts ?? []).filter((a) => a.active).length;
    const critAlerts = (alerts ?? []).filter((a) => a.active && a.severity === "critical").length;

    if (voiceLang === "ne") {
      return `RESH MESQ अपरेशन सारांश। ${openInc} सक्रिय घटनाहरू, ${critInc} अत्यन्त जरुरी। ${blockedRoads} सडक अवरुद्ध। ${availVeh} सवारी उपलब्ध। ${activeAlerts} सक्रिय अलर्टहरू, ${critAlerts} अत्यन्त जरुरी।`;
    }
    return `RESH MESQ operations summary. ${openInc} active incident${openInc !== 1 ? "s" : ""}, ${critInc} critical. ${blockedRoads} road${blockedRoads !== 1 ? "s" : ""} blocked. ${availVeh} vehicle${availVeh !== 1 ? "s" : ""} available. ${activeAlerts} active alert${activeAlerts !== 1 ? "s" : ""}, ${critAlerts} critical.`;
  }

  function buildAlertSummary(): string {
    const critAlerts = (alerts ?? []).filter((a) => a.active && a.severity === "critical");
    const highAlerts = (alerts ?? []).filter((a) => a.active && a.severity === "high");
    if (critAlerts.length === 0 && highAlerts.length === 0) {
      return voiceLang === "ne"
        ? "हाल कुनै अत्यन्त जरुरी वा उच्च अलर्ट सक्रिय छैन।"
        : "No critical or high alerts are currently active.";
    }
    const parts: string[] = [];
    if (critAlerts.length > 0) {
      parts.push(`${critAlerts.length} critical alert${critAlerts.length !== 1 ? "s" : ""}: ${critAlerts.slice(0, 2).map((a) => a.title).join("; ")}`);
    }
    if (highAlerts.length > 0) {
      parts.push(`${highAlerts.length} high alert${highAlerts.length !== 1 ? "s" : ""}: ${highAlerts.slice(0, 2).map((a) => a.title).join("; ")}`);
    }
    return parts.join(". ");
  }

  function buildMapDescription(): string {
    const open = (roads ?? []).filter((r) => r.state === "open").length;
    const blocked = (roads ?? []).filter((r) => r.state === "blocked" || r.state === "bridge_damaged" || r.state === "flooded" || r.state === "landslide").length;
    const openInc = (incidents ?? []).filter((i) => i.status !== "resolved");
    const deployed = (vehicles ?? []).filter((v) => v.status === "en_route" || v.status === "on_scene").length;
    if (voiceLang === "ne") {
      return `नक्शा विवरण। ${open} सडक खुला, ${blocked} अवरुद्ध। ${openInc.length} सक्रिय घटनाहरू। ${deployed} सवारी तैनाथ।`;
    }
    return `Map description. ${open} road${open !== 1 ? "s" : ""} open, ${blocked} blocked or impassable. ${openInc.length} active incident${openInc.length !== 1 ? "s" : ""} on the map. ${deployed} vehicle${deployed !== 1 ? "s" : ""} currently deployed.`;
  }

  function buildRouteSummary(): string {
    // Generic route instructions (real route from planner would be passed here)
    return voiceLang === "ne"
      ? "मार्ग सारांश। सुरक्षित मार्ग योजनाकार खोल्नुहोस् र उत्पत्ति र गन्तव्य चयन गर्नुहोस्। सिस्टेमले सबैभन्दा सुरक्षित कोरिडोर सुझाव दिनेछ।"
      : "Route summary. Open the Safe Route Planner and select your origin and destination. The system will suggest the safest available corridor, avoiding flooded, blocked, or landslide-affected roads.";
  }

  // ── Voice emergency assistance flow ──────────────────────────────────────
  const [voiceStep, setVoiceStep] = useState(0);
  const VOICE_FLOW_EN = [
    "Voice emergency assistance activated. What type of emergency do you need to report?",
    "Choose from: Flood rescue. Road accident. Medical emergency. Landslide. Fire. Evacuation needed. Press the matching button or say the number.",
    "To submit your report, navigate to the SOS Report page. Press Shift S from any page to open it quickly.",
    "Voice assistance complete. Your safety is our priority.",
  ];
  const VOICE_FLOW_NE = [
    "भ्वाइस आपतकालीन सहायता सक्रिय। तपाईंलाई कुन प्रकारको आपातकाल रिपोर्ट गर्नु छ?",
    "छनोट गर्नुहोस्: बाढी उद्धार। सडक दुर्घटना। चिकित्सा आपतकाल। पहिरो। आगलागी। निकासी आवश्यक।",
    "रिपोर्ट पेश गर्न SOS रिपोर्ट पृष्ठमा जानुहोस्।",
    "भ्वाइस सहायता पूर्ण। तपाईंको सुरक्षा हाम्रो प्राथमिकता हो।",
  ];
  const voiceFlow = voiceLang === "ne" ? VOICE_FLOW_NE : VOICE_FLOW_EN;

  function startVoiceEmergency() {
    setVoiceEmergencyActive(true);
    setVoiceStep(0);
    setVoice(true);
    speak(voiceFlow[0]!, true);
  }

  function nextVoiceStep() {
    const next = voiceStep + 1;
    if (next >= voiceFlow.length) {
      setVoiceEmergencyActive(false);
      setVoiceStep(0);
      return;
    }
    setVoiceStep(next);
    speak(voiceFlow[next]!, true);
  }

  function handleTheme(t: ThemeMode) {
    setTheme(t);
    speak(`Theme changed to ${t} mode`);
  }
  function handleHighContrast(v: boolean) {
    setHighContrast(v);
    speak(`High contrast ${v ? "enabled" : "disabled"}`);
  }
  function handleTextScale(v: TextScale) {
    setTextScale(v);
    speak(`Text size set to ${v}`);
  }
  function handleVoice(v: boolean) {
    setVoice(v);
    if (v) speak("Voice guidance enabled. I will read important information aloud.");
  }

  return (
    <div>
      <PageHeader
        title="Accessibility Settings"
        description="Customise RESH MESQ for your visual and accessibility needs"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => speak(buildPageSummary(), true)}
          aria-label="Read current page summary aloud"
          className="gap-1.5"
        >
          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
          Read page
        </Button>
      </PageHeader>

      <div className="p-4 sm:p-6 max-w-2xl space-y-5">

        {/* Language selector for voice */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Languages className="h-4 w-4" aria-hidden="true" />
              Voice language / भाषा
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2" role="group" aria-label="Select voice language">
              {([
                { value: "en", label: "English" },
                { value: "ne", label: "नेपाली" },
              ] as const).map((l) => (
                <button
                  key={l.value}
                  onClick={() => { setVoiceLang(l.value); speak(l.value === "ne" ? "नेपाली भाषा चयन गरियो" : "English language selected"); }}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${voiceLang === l.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/50"}`}
                  aria-pressed={voiceLang === l.value}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Voice emergency flow */}
        <Card className={voiceEmergencyActive ? "border-critical/40 bg-critical-soft" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              {voiceEmergencyActive ? <MicOff className="h-4 w-4 text-critical" /> : <Mic className="h-4 w-4" />}
              Voice Emergency Assistance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {voiceEmergencyActive ? (
              <>
                <div
                  className="rounded-lg border border-critical/30 bg-white/60 dark:bg-black/20 px-4 py-3 text-sm"
                  role="status"
                  aria-live="assertive"
                  aria-atomic="true"
                >
                  <p className="font-semibold text-foreground mb-1">Step {voiceStep + 1} of {voiceFlow.length}</p>
                  <p className="text-foreground leading-relaxed">{voiceFlow[voiceStep]}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => speak(voiceFlow[voiceStep]!, true)} className="gap-1">
                    <Repeat className="h-3.5 w-3.5" /> Repeat
                  </Button>
                  <Button size="sm" onClick={nextVoiceStep} className="flex-1">
                    {voiceStep < voiceFlow.length - 1 ? "Next step" : "Finish"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setVoiceEmergencyActive(false); setVoiceStep(0); }}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Activate a step-by-step voice guide for reporting emergencies. Available in English and Nepali.
                </p>
                <Button onClick={startVoiceEmergency} className="w-full gap-2" disabled={!voice}>
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  Start voice emergency flow
                </Button>
                {!voice && (
                  <p className="text-xs text-muted-foreground">Enable voice guidance below to use this feature.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Voice guidance controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              {voice ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4" />}
              Voice Guidance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="voice-switch" className="text-sm font-medium cursor-pointer">
                  Enable voice announcements
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Uses the browser's Speech Synthesis API to read alerts, routes and status updates aloud.
                </p>
              </div>
              <Switch
                id="voice-switch"
                checked={voice}
                onCheckedChange={handleVoice}
                aria-label="Toggle voice guidance"
              />
            </div>

            {/* Quick-speak buttons */}
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Voice announcement shortcuts">
              {[
                { label: "Read page summary", fn: () => speak(buildPageSummary()) },
                { label: "Describe map", fn: () => speak(buildMapDescription()) },
                { label: "Read active alerts", fn: () => speak(buildAlertSummary(), true) },
                { label: "Read route instructions", fn: () => speak(buildRouteSummary()) },
              ].map(({ label, fn }) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  className="justify-start gap-1.5 h-auto py-2 text-xs"
                  onClick={fn}
                  disabled={!voice}
                  aria-label={`${label} aloud`}
                >
                  <Volume2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {label}
                </Button>
              ))}
            </div>

            {voice && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5"
                  onClick={() => speak(lastMsgRef.current || "Nothing to repeat yet")}
                  aria-label="Repeat last spoken message"
                >
                  <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
                  Repeat last
                </Button>
                <Button variant="ghost" size="sm" onClick={() => window.speechSynthesis?.cancel()}
                  aria-label="Stop speaking">
                  Stop speaking
                </Button>
              </div>
            )}

            {lastMsg && (
              <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
                <span className="font-medium text-foreground">Last announced: </span>{lastMsg}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Colour theme */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sun className="h-4 w-4" aria-hidden="true" />
              Colour Theme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
              ] as { value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleTheme(value)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${theme === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/50"}`}
                  aria-pressed={theme === value}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                  {theme === value && <CheckCircle2 className="ml-auto h-3.5 w-3.5" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* High contrast */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Contrast className="h-4 w-4" aria-hidden="true" />
              High Contrast
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="hc-switch" className="text-sm font-medium cursor-pointer">
                  Enable high contrast
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Maximises colour contrast. Critical, High, Moderate and Safe indicators also use icons and text labels — never colour alone.
                </p>
              </div>
              <Switch id="hc-switch" checked={highContrast} onCheckedChange={handleHighContrast} aria-label="Toggle high contrast" />
            </div>
          </CardContent>
        </Card>

        {/* Text size */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Type className="h-4 w-4" aria-hidden="true" />
              Text Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3" role="group" aria-label="Select text size">
              {([
                { value: "base", label: "Default", size: "text-base" },
                { value: "lg", label: "Large", size: "text-xl" },
                { value: "xl", label: "Largest", size: "text-2xl" },
              ] as { value: TextScale; label: string; size: string }[]).map(({ value, label, size }) => (
                <button
                  key={value}
                  onClick={() => handleTextScale(value)}
                  className={`flex flex-col items-center rounded-lg border px-4 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${textScale === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/50"}`}
                  aria-pressed={textScale === value}
                >
                  <span className={`font-bold ${size} leading-none mb-1`} aria-hidden="true">Aa</span>
                  <span className="text-xs">{label}</span>
                  {textScale === value && <CheckCircle2 className="mt-1 h-3.5 w-3.5" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Keyboard shortcuts */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Keyboard className="h-4 w-4" aria-hidden="true" />
              Keyboard Navigation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {[
              { key: "Tab", desc: "Move focus to next interactive element" },
              { key: "Shift + Tab", desc: "Move focus to previous element" },
              { key: "Enter / Space", desc: "Activate focused button or control" },
              { key: "Esc", desc: "Close dialogs and menus" },
              { key: "Arrow keys", desc: "Navigate within menus and lists" },
              { key: "Shift + S", desc: "Open SOS report from anywhere" },
            ].map(({ key, desc }) => (
              <div key={key} className="flex items-center gap-3">
                <kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs shrink-0 text-foreground">{key}</kbd>
                <span>{desc}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Screen-reader info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Screen Reader &amp; Accessibility Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {[
              { icon: CheckCircle2, text: "All severity levels (Critical / High / Moderate / Safe) use text labels and icons — never colour alone." },
              { icon: CheckCircle2, text: "Emergency maps provide a text alternative listing all incidents, roads, vehicles and facilities." },
              { icon: CheckCircle2, text: "Charts include ARIA labels and text summaries accessible to screen readers." },
              { icon: CheckCircle2, text: "ARIA live regions announce critical alerts and status changes automatically." },
              { icon: CheckCircle2, text: "Reduced motion: RESH MESQ respects the operating system's 'Reduce Motion' preference." },
              { icon: Info, text: "Full WCAG 2.1 AA compliance requires manual testing with assistive technologies. Automated coverage is provided; human review is recommended." },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-2">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-safe" aria-hidden="true" />
                <span>{text}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Demo / simulation notice */}
        <div className="flex items-start gap-2 rounded-lg border border-moderate/30 bg-moderate-soft px-4 py-3 text-xs text-moderate-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            RESH MESQ is a demonstration platform. Voice guidance uses your browser's built-in Speech Synthesis API.
            Availability and quality depend on your device and browser.
          </span>
        </div>

      </div>
    </div>
  );
}
