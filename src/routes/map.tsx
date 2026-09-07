import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { MapPin, Plus, Trash2, RefreshCw, Info, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDistanceToNow } from "date-fns";
import {
  PIN_CATEGORIES,
  PIN_INCIDENT_TYPES,
  type PinCategory,
} from "@/lib/pin-categories";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Community Needs Map — RESH MESQ" },
      {
        name: "description",
        content:
          "Drop a pin on the RESH MESQ community needs map to mark where help is required during a disaster response.",
      },
      { property: "og:title", content: "Community Needs Map — RESH MESQ" },
      {
        property: "og:description",
        content: "Mark where help is needed so responders can see it on the operations map.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CrowdMapPage,
});

// Leaflet touches `window` at import time, so it must only load in the browser.
const CommunityMapCanvas = lazy(() => import("@/components/community-map-canvas"));

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <p className="text-xs text-muted-foreground">Loading map…</p>
    </div>
  );
}

// ── DB row type (community pins are stored as emergency_incidents) ─────────────
type CommunityPin = Tables<"emergency_incidents"> & {
  incident_type: PinCategory | string; // we filter to PinCategory values
};


// ── Main page ──────────────────────────────────────────────────────────────────
function CrowdMapPage() {
  const [pins, setPins] = useState<CommunityPin[]>([]);
  const [loading, setLoading] = useState(true);

  // Drop-pin UI state
  const [dropMode, setDropMode] = useState(false);
  const [pendingLatLng, setPendingLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [pinCategory, setPinCategory] = useState<PinCategory>("trapped");
  const [pinNote, setPinNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Load existing pins ────────────────────────────────────────────────────
  const loadPins = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("emergency_incidents")
      .select("*")
      .in("incident_type", PIN_INCIDENT_TYPES)
      .order("created_at", { ascending: false });
    if (!error && data) setPins(data as CommunityPin[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  // ── Supabase Realtime subscription ───────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("community-pins-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "emergency_incidents",
          filter: `incident_type=in.(${PIN_INCIDENT_TYPES.join(",")})`,
        },
        (payload) => {
          const newPin = payload.new as CommunityPin;
          setPins((prev) => {
            // avoid duplicates
            if (prev.find((p) => p.id === newPin.id)) return prev;
            return [newPin, ...prev];
          });
          toast.info(`New pin: ${PIN_CATEGORIES[newPin.incident_type as PinCategory]?.label ?? newPin.incident_type} at ${newPin.location_name}`);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "emergency_incidents",
          filter: `incident_type=in.(${PIN_INCIDENT_TYPES.join(",")})`,
        },
        (payload) => {
          setPins((prev) => prev.filter((p) => p.id !== (payload.old as { id: string }).id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Handle map click while in drop mode ──────────────────────────────────
  function handleMapClick(lat: number, lng: number) {
    setPendingLatLng({ lat, lng });
  }

  // ── Submit new pin ────────────────────────────────────────────────────────
  async function submitPin() {
    if (!pendingLatLng) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("emergency_incidents").insert({
        incident_type: pinCategory,
        location_name: `Community pin — ${PIN_CATEGORIES[pinCategory].label}`,
        lat: pendingLatLng.lat,
        lng: pendingLatLng.lng,
        severity: pinCategory === "trapped" ? "critical" : pinCategory === "medical" ? "high" : "moderate",
        people_affected: 1,
        road_accessible: true,
        required_service: pinCategory === "medical" ? "ambulance" : pinCategory === "trapped" ? "rescue_team" : "all",
        summary: pinNote.trim() || null,
        status: "new",
      });
      if (error) throw error;
      toast.success("Pin dropped — visible to all responders in real time");
      setPendingLatLng(null);
      setPinNote("");
      setDropMode(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to drop pin";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete pin ────────────────────────────────────────────────────────────
  async function deletePin(id: string) {
    const { error } = await supabase.from("emergency_incidents").delete().eq("id", id);
    if (error) toast.error("Could not remove pin");
    else toast.success("Pin removed");
  }

  const categoryCounts = PIN_INCIDENT_TYPES.map((cat) => ({
    cat,
    count: pins.filter((p) => p.incident_type === cat).length,
  })).filter((x) => x.count > 0);

  return (
    <AppShell>
      <PageHeader
        title="Community Needs Map"
        description="Drop a pin to mark where help is needed — visible in real time to responders"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={loadPins}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button
          size="sm"
          variant={dropMode ? "destructive" : "default"}
          onClick={() => {
            setDropMode((v) => !v);
            setPendingLatLng(null);
          }}
        >
          {dropMode ? (
            <>
              <X className="h-3.5 w-3.5" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              Drop pin
            </>
          )}
        </Button>
      </PageHeader>

      <div className="flex h-[calc(100vh-7rem)] overflow-hidden">
        {/* ── Map ─────────────────────────────────────────────────────────── */}
        <div className="relative flex-1">
          {/* Drop-mode banner */}
          {dropMode && !pendingLatLng && (
            <div className="absolute top-3 left-1/2 z-[1000] -translate-x-1/2 rounded-lg border border-primary/40 bg-primary/90 px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
              Click anywhere on the map to place your pin
            </div>
          )}

          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <CommunityMapCanvas
                pins={pins}
                dropMode={dropMode}
                pendingLatLng={pendingLatLng}
                pinCategory={pinCategory}
                onMapClick={handleMapClick}
                onDeletePin={deletePin}
              />
            </Suspense>
          </ClientOnly>

        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-card lg:flex">
          {/* Drop-pin form */}
          {dropMode && (
            <Card className="m-3 border-primary/40 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-primary">
                  <Plus className="h-4 w-4" />
                  {pendingLatLng ? "Confirm pin" : "Select type then click map"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Select
                    value={pinCategory}
                    onValueChange={(v) => setPinCategory(v as PinCategory)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIN_INCIDENT_TYPES.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-xs">
                          {PIN_CATEGORIES[cat].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {pendingLatLng && (
                  <>
                    <div className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                      📍 {pendingLatLng.lat.toFixed(4)}, {pendingLatLng.lng.toFixed(4)}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Note (optional)</Label>
                      <Textarea
                        value={pinNote}
                        onChange={(e) => setPinNote(e.target.value)}
                        placeholder="e.g. 3 people on rooftop, no boat access"
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={submitPin}
                        disabled={submitting}
                      >
                        {submitting ? "Saving…" : "Confirm pin"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPendingLatLng(null)}
                      >
                        Re-pick
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Category legend */}
          <div className="px-3 pt-3">
            <p className="label-caps mb-2">Pin categories</p>
            <div className="space-y-1.5">
              {PIN_INCIDENT_TYPES.map((cat) => {
                const meta = PIN_CATEGORIES[cat];
                const count = pins.filter((p) => p.incident_type === cat).length;
                return (
                  <div key={cat} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="inline-block h-3 w-3 rounded-full border border-white/40 shrink-0"
                        style={{ background: meta.hex }}
                        aria-hidden="true"
                      />
                      {meta.label}
                    </div>
                    {count > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {count}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active pin count */}
          <div className="mx-3 mt-3 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{pins.length}</span> community pin
            {pins.length !== 1 ? "s" : ""} on the map
            {pins.length > 0 && (
              <span className="ml-1 text-safe-foreground">· live via Realtime</span>
            )}
          </div>

          {/* Pin list */}
          <div className="mt-3 flex-1 overflow-y-auto">
            {loading ? (
              <p className="px-3 text-xs text-muted-foreground">Loading…</p>
            ) : pins.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <MapPin className="mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  No pins yet. Drop a pin to mark where help is needed.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {pins.map((pin) => {
                  const meta = PIN_CATEGORIES[pin.incident_type as PinCategory];
                  return (
                    <li key={pin.id} className="flex items-start gap-2.5 px-3 py-2.5">
                      <span
                        className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: meta?.hex ?? "#888" }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground leading-tight">
                          {meta?.label ?? pin.incident_type}
                        </p>
                        {pin.summary && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">
                            {pin.summary}
                          </p>
                        )}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {pin.lat.toFixed(3)}, {pin.lng.toFixed(3)} ·{" "}
                          {formatDistanceToNow(new Date(pin.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <button
                        onClick={() => deletePin(pin.id)}
                        className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        aria-label="Remove pin"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Disclaimer */}
          <div className="m-3 flex items-start gap-2 rounded-lg border border-moderate/30 bg-moderate-soft px-3 py-2 text-[10px] text-moderate-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            Demo system. Pins are stored in the shared demo database and are visible to all users.
            Do not submit personal or sensitive information.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
