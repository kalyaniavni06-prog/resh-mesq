import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bell,
  BellOff,
  Search,
  Info,
  Droplets,
  Mountain,
  Car,
  CloudRain,
  Flame,
  Cross,
  PersonStanding,
  Languages,
} from "lucide-react";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { SeverityBadge, SeverityDot } from "@/components/SeverityBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAlerts, type Alert } from "@/hooks/useSupabaseData";
import { formatDistanceToNow, format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Severity = Database["public"]["Enums"]["severity_level"];
type Lang = "en" | "ne";

export const Route = createFileRoute("/alerts")({
  component: AlertCentrePage,
});

// ── Universal category icons (language-agnostic) ──────────────────────────────
export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  flood: <Droplets className="h-5 w-5" aria-label="Flood" />,
  landslide: <Mountain className="h-5 w-5" aria-label="Landslide" />,
  bridge_damage: <Car className="h-5 w-5" aria-label="Bridge damage" />,
  weather: <CloudRain className="h-5 w-5" aria-label="Severe weather" />,
  fire: <Flame className="h-5 w-5" aria-label="Fire" />,
  medical: <Cross className="h-5 w-5" aria-label="Medical emergency" />,
  trapped: <PersonStanding className="h-5 w-5" aria-label="People trapped" />,
  accessibility: <Car className="h-5 w-5" aria-label="Accessibility" />,
};

// ── Colour strip per category (language-agnostic visual cue) ─────────────────
const CATEGORY_COLOR: Record<string, string> = {
  flood: "bg-blue-500",
  landslide: "bg-amber-700",
  bridge_damage: "bg-orange-500",
  weather: "bg-sky-500",
  fire: "bg-red-600",
  medical: "bg-green-600",
  trapped: "bg-purple-600",
  accessibility: "bg-teal-500",
};

// ── Translations: only fields that vary per language ─────────────────────────
// Key = alert.title (exact match from seeded data). Fallback = English original.
const TRANSLATIONS: Record<string, { ne: { title: string; detail?: string; area: string } }> = {
  "Bagmati basin flood surge": {
    ne: {
      title: "बागमती बेसिन बाढी उछाल",
      detail:
        "नदी चेतावनी सीमाभन्दा १.८ मिटर माथि। तल्लो वडाहरूका लागि निकासी सल्लाह।",
      area: "काठमाडौं / ललितपुर",
    },
  },
  "Landslide activity - Malekhu": {
    ne: {
      title: "पहिरो गतिविधि - मालेखु",
      detail:
        "पृथ्वी राजमार्गमा दुई सक्रिय स्लाइड क्षेत्र; रुकावट जारी छ।",
      area: "धादिङ कोरिडोर",
    },
  },
  "Bridge structural damage - Balkhu": {
    ne: {
      title: "पुल संरचनात्मक क्षति - बल्खु",
      detail: "बाग्मती पुल इन्जिनियरिङ मूल्यांकन पेन्डिङ; सबै ट्राफिकका लागि बन्द।",
      area: "काठमाडौं",
    },
  },
  "Heavy rainfall warning": {
    ne: {
      title: "भारी वर्षाको चेतावनी",
      detail: "अर्को २४ घन्टामा १२०–१८० मिमी अपेक्षित। नयाँ सडक बन्द हुने सम्भावना।",
      area: "केन्द्रीय र पूर्वी नेपाल",
    },
  },
  "Koshi embankment watch": {
    ne: {
      title: "कोशी तटबन्ध निगरानी",
      detail: "तटबन्धमा सिपेज अनुगमन; कुनै उल्लंघन रिपोर्ट भएको छैन।",
      area: "मोरङ",
    },
  },
  "Dhulikhel corridor reopened": {
    ne: {
      title: "धुलिखेल कोरिडोर पुनः खुल्यो",
      detail: "ग्राभेल बाइपास एम्बुलेन्सका लागि पहुँचयोग्य प्रमाणित।",
      area: "काभ्रे",
    },
  },
};

const LANG_LABELS: Record<Lang, string> = { en: "English", ne: "नेपाली" };

// ── Translated field helper ───────────────────────────────────────────────────
function tx(alert: Alert, lang: Lang, field: "title" | "detail" | "area"): string {
  if (lang === "en") {
    if (field === "title") return alert.title;
    if (field === "detail") return alert.detail ?? "";
    return alert.area;
  }
  const t = TRANSLATIONS[alert.title]?.ne;
  if (!t) {
    // Fallback to English when no translation exists
    if (field === "title") return alert.title;
    if (field === "detail") return alert.detail ?? "";
    return alert.area;
  }
  if (field === "title") return t.title;
  if (field === "detail") return t.detail ?? alert.detail ?? "";
  return t.area;
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "moderate", "safe"];

// ── Alert card ────────────────────────────────────────────────────────────────
function AlertCard({ alert, lang }: { alert: Alert; lang: Lang }) {
  const icon = CATEGORY_ICONS[alert.category] ?? <Info className="h-5 w-5" />;
  const colorBar = CATEGORY_COLOR[alert.category] ?? "bg-muted";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex">
          {/* Colour strip — language-agnostic visual category cue */}
          <div
            className={`w-1.5 shrink-0 ${colorBar}`}
            role="presentation"
            aria-hidden="true"
          />
          <div className="flex flex-1 items-start gap-3 p-4">
            {/* Universal icon */}
            <div
              className={`mt-0.5 shrink-0 rounded-md p-1.5 ${colorBar} bg-opacity-15 text-foreground`}
              aria-hidden="true"
            >
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <SeverityBadge severity={alert.severity} />
                  <Badge variant="outline" className="text-xs capitalize">
                    {alert.category.replace(/_/g, " ")}
                  </Badge>
                  {!alert.active && (
                    <Badge variant="secondary" className="text-xs">
                      {lang === "ne" ? "निष्क्रिय" : "Inactive"}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(alert.issued_at), { addSuffix: true })}
                </span>
              </div>
              <h3 className="mt-1.5 text-sm font-semibold text-foreground">
                {tx(alert, lang, "title")}
              </h3>
              {alert.detail && (
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {tx(alert, lang, "detail")}
                </p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="font-medium text-foreground">
                    {lang === "ne" ? "क्षेत्र:" : "Area:"}
                  </span>{" "}
                  {tx(alert, lang, "area")}
                </span>
                <span>·</span>
                <span>{format(new Date(alert.issued_at), "dd MMM yyyy, HH:mm")}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function AlertCentrePage() {
  const { data: allAlerts, isLoading } = useAlerts();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"active" | "all">("active");
  const [lang, setLang] = useState<Lang>("en");

  const baseAlerts = (allAlerts ?? []).filter((a) => (tab === "active" ? a.active : true));

  const filtered = baseAlerts.filter((a) => {
    const q = search.toLowerCase();
    // Search in both English and Nepali title/area
    const neTitle = TRANSLATIONS[a.title]?.ne?.title ?? "";
    const neArea = TRANSLATIONS[a.title]?.ne?.area ?? "";
    return (
      a.title.toLowerCase().includes(q) ||
      a.area.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q) ||
      (a.detail ?? "").toLowerCase().includes(q) ||
      neTitle.toLowerCase().includes(q) ||
      neArea.toLowerCase().includes(q)
    );
  });

  const bySeverity = SEVERITY_ORDER.reduce<Record<Severity, Alert[]>>(
    (acc, s) => { acc[s] = filtered.filter((a) => a.severity === s); return acc; },
    { critical: [], high: [], moderate: [], safe: [] },
  );

  const active = allAlerts?.filter((a) => a.active) ?? [];
  const critical = active.filter((a) => a.severity === "critical");
  const high = active.filter((a) => a.severity === "high");

  return (
    <div>
      <PageHeader
        title="Alert Centre"
        description="Disaster alerts — Nepal flood scenario"
      >
        {/* Language switcher */}
        <div
          className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5"
          role="group"
          aria-label="Select language"
        >
          <Languages className="ml-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          {(["en", "ne"] as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                lang === l
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-pressed={lang === l}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="p-6 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          ) : (
            <>
              <StatCard
                label={lang === "ne" ? "सक्रिय अलर्टहरू" : "Active Alerts"}
                value={active.length}
                icon={<Bell className="h-5 w-5" />}
                variant={critical.length > 0 ? "critical" : "default"}
              />
              <StatCard
                label={lang === "ne" ? "अत्यन्त जरुरी" : "Critical"}
                value={critical.length}
                icon={<SeverityDot severity="critical" />}
                variant={critical.length > 0 ? "critical" : "default"}
              />
              <StatCard
                label={lang === "ne" ? "उच्च" : "High"}
                value={high.length}
                icon={<SeverityDot severity="high" />}
                variant={high.length > 0 ? "high" : "default"}
              />
              <StatCard
                label={lang === "ne" ? "कुल जारी" : "Total Issued"}
                value={allAlerts?.length ?? 0}
                icon={<BellOff className="h-5 w-5" />}
              />
            </>
          )}
        </div>

        {/* Search + tabs */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "all")}>
            <TabsList>
              <TabsTrigger value="active">
                {lang === "ne" ? "सक्रिय मात्र" : "Active only"}
              </TabsTrigger>
              <TabsTrigger value="all">
                {lang === "ne" ? "सबै अलर्ट" : "All alerts"}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder={lang === "ne" ? "अलर्ट खोज्नुहोस्…" : "Search alerts…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Icon legend */}
        <div className="flex flex-wrap gap-3">
          {Object.entries(CATEGORY_ICONS).map(([cat, icon]) => (
            <div
              key={cat}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground"
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded ${CATEGORY_COLOR[cat] ?? "bg-muted"} bg-opacity-20`}
                aria-hidden="true"
              >
                {icon}
              </span>
              <span className="capitalize">{cat.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>

        {/* Alert list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <BellOff className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {lang === "ne" ? "कुनै अलर्ट फेला परेन" : "No alerts match your search"}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {SEVERITY_ORDER.map((sev) =>
              bySeverity[sev].length === 0 ? null : (
                <section key={sev}>
                  <div className="mb-3 flex items-center gap-2">
                    <SeverityDot severity={sev} />
                    <h2 className="text-sm font-semibold capitalize text-foreground">{sev}</h2>
                    <span className="label-caps">({bySeverity[sev].length})</span>
                  </div>
                  <div className="space-y-3">
                    {bySeverity[sev].map((alert) => (
                      <AlertCard key={alert.id} alert={alert} lang={lang} />
                    ))}
                  </div>
                </section>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
