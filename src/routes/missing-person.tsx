import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { getSpeechRecognition, type SpeechRecognitionEvent } from "@/lib/speech";
import {
  AlertTriangle, ArrowRight, Camera, CheckCircle2, Clock,
  FileText, Lock, MapPin, Mic, MicOff, Navigation,
  Search, Upload, User, UserX, X,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type MissingPerson = Tables<"missing_persons">;
type Status = MissingPerson["status"];

export const Route = createFileRoute("/missing-person")({
  head: () => ({
    meta: [
      { title: "Missing Person Report — RESH MESQ" },
      { name: "description", content: "Report a missing or lost person during a disaster or emergency." },
    ],
  }),
  component: MissingPersonPage,
});

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<Status, { label: string; icon: React.ReactNode; cls: string; step: number }> = {
  reported:           { label: "Reported",           icon: <FileText className="h-3.5 w-3.5" />, cls: "bg-moderate-soft text-moderate-foreground border-moderate/20", step: 1 },
  verified:           { label: "Verified",           icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: "bg-high-soft text-high-foreground border-high/20", step: 2 },
  search_in_progress: { label: "Search in Progress", icon: <Search className="h-3.5 w-3.5" />, cls: "bg-primary/10 text-primary border-primary/20", step: 3 },
  located:            { label: "Located",            icon: <MapPin className="h-3.5 w-3.5" />, cls: "bg-safe-soft text-safe-foreground border-safe/20", step: 4 },
  closed:             { label: "Closed",             icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: "bg-muted text-muted-foreground border-border", step: 5 },
};
const STATUS_FLOW: Status[] = ["reported","verified","search_in_progress","located","closed"];

// ── DB helpers ───────────────────────────────────────────────────────────────
function useMissingPersons() {
  return useQuery({
    queryKey: ["missing_persons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missing_persons").select("*").order("created_at", { ascending: false });
      if (error) {
        if (error.message.includes("relation") || error.message.includes("does not exist")) return [] as MissingPerson[];
        throw error;
      }
      return (data ?? []) as MissingPerson[];
    },
    staleTime: 30_000,
  });
}
function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TablesInsert<"missing_persons">) => {
      const { data, error } = await supabase.from("missing_persons").insert(payload).select().single();
      if (error) throw error;
      return data as MissingPerson;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missing_persons"] }),
  });
}
function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { data, error } = await supabase.from("missing_persons").update({ status }).eq("id", id).select().single();
      if (error) throw error;
      return data as MissingPerson;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missing_persons"] }),
  });
}

// ── Photo upload via Supabase Storage ────────────────────────────────────────
async function uploadPhoto(file: File, caseId: string): Promise<string | null> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `missing-persons/${caseId}.${ext}`;
  const { error } = await supabase.storage.from("emergency-photos").upload(path, file, { upsert: true });
  if (error) { console.error("Photo upload failed:", error.message); return null; }
  const { data } = supabase.storage.from("emergency-photos").getPublicUrl(path);
  return data.publicUrl;
}

// ── Voice input hook (Web Speech API) ────────────────────────────────────────
function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const SR = getSpeechRecognition();
  const supported = SR !== null;

  function start() {
    if (!SR) { toast.error("Voice input not supported in this browser"); return; }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      onResult(e.results[0]?.[0]?.transcript ?? "");
    };
    rec.onerror = () => { toast.error("Voice input error — please try again"); setListening(false); };
    rec.onend = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recRef.current = rec as any;
    rec.start();
    setListening(true);
  }
  function stop() { recRef.current?.stop(); setListening(false); }
  return { listening, start, stop, supported };
}

// ── GPS location helper ───────────────────────────────────────────────────────
function useGPS(onFix: (lat: number, lng: number, address: string) => void) {
  const [fetching, setFetching] = useState(false);
  function getLocation() {
    if (!navigator.geolocation) { toast.error("Geolocation not available"); return; }
    setFetching(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        // Reverse-geocode via OpenStreetMap Nominatim (free, no API key)
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const json = await res.json() as { display_name?: string };
          onFix(lat, lng, json.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        } catch {
          onFix(lat, lng, `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
        setFetching(false);
      },
      (err) => { toast.error(`Location error: ${err.message}`); setFetching(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  return { getLocation, fetching };
}

// ── Status flow component ────────────────────────────────────────────────────
function StatusFlow({ current }: { current: Status }) {
  const step = STATUS_CFG[current].step;
  return (
    <div className="flex items-center" aria-label={`Status: ${STATUS_CFG[current].label}`}>
      {STATUS_FLOW.map((s, i) => {
        const cfg = STATUS_CFG[s];
        const done = cfg.step <= step;
        const active = s === current;
        return (
          <div key={s} className="flex items-center">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full border text-[9px] font-bold ${active ? "bg-primary text-primary-foreground border-primary" : done ? "bg-safe text-white border-safe" : "bg-muted text-muted-foreground border-border"}`} aria-current={active ? "step" : undefined} title={cfg.label}>
              {cfg.step}
            </div>
            {i < STATUS_FLOW.length - 1 && <div className={`h-px w-4 sm:w-6 ${done && cfg.step < step ? "bg-safe" : "bg-border"}`} aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

// ── Case card ────────────────────────────────────────────────────────────────
function CaseCard({ mp, isResponder }: { mp: MissingPerson; isResponder: boolean }) {
  const cfg = STATUS_CFG[mp.status];
  const update = useUpdateStatus();
  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(mp.status) + 1];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Photo + header */}
        <div className="flex items-start gap-3">
          {mp.photo_url ? (
            <img src={mp.photo_url} alt={`Photo of ${mp.full_name}`} className="h-14 w-14 rounded-lg object-cover border border-border shrink-0" />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-secondary"><User className="h-6 w-6 text-muted-foreground" /></div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground truncate">{mp.full_name}</p>
              <span className="font-mono text-[10px] text-muted-foreground shrink-0">{mp.case_id}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Age ~{mp.approximate_age} · {mp.gender !== "not_specified" ? mp.gender : "Gender not specified"}</p>
            <span className={`mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>{cfg.icon}{cfg.label}</span>
          </div>
        </div>

        <StatusFlow current={mp.status} />

        <div className="space-y-1 text-xs">
          <div className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3 w-3 text-muted-foreground shrink-0" /><span><strong>Last seen:</strong> {mp.last_known_location}</span></div>
          {mp.lat && mp.lng && (
            <div className="flex items-start gap-1.5"><Navigation className="mt-0.5 h-3 w-3 text-muted-foreground shrink-0" /><a href={`https://www.openstreetmap.org/?mlat=${mp.lat}&mlon=${mp.lng}#map=16/${mp.lat}/${mp.lng}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{mp.lat.toFixed(5)}, {mp.lng.toFixed(5)} — View on map</a></div>
          )}
          <div className="flex items-start gap-1.5"><Clock className="mt-0.5 h-3 w-3 text-muted-foreground shrink-0" /><span>{new Date(mp.last_seen_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span></div>
          {mp.clothing_desc && <p className="text-muted-foreground"><strong className="text-foreground">Clothing:</strong> {mp.clothing_desc}</p>}
          {mp.identifying_desc && <p className="text-muted-foreground"><strong className="text-foreground">Description:</strong> {mp.identifying_desc}</p>}
          {mp.notes && <p className="text-muted-foreground"><strong className="text-foreground">Notes:</strong> {mp.notes}</p>}
        </div>

        {isResponder ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
            <p className="font-semibold text-primary flex items-center gap-1"><Lock className="h-3 w-3" />Reporter (responders only)</p>
            <p className="text-muted-foreground mt-0.5">{mp.reporter_name} · {mp.reporter_contact}</p>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-md border bg-muted px-3 py-2 text-[10px] text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />Reporter contact visible to authorised responders only.</div>
        )}

        {isResponder && nextStatus && mp.status !== "closed" && (
          <Button size="sm" variant="outline" className="w-full text-xs" disabled={update.isPending}
            onClick={async () => { await update.mutateAsync({ id: mp.id, status: nextStatus }); toast.success(`Marked as: ${STATUS_CFG[nextStatus].label}`); }}>
            <ArrowRight className="h-3.5 w-3.5" />
            Mark as: {STATUS_CFG[nextStatus].label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Report form ───────────────────────────────────────────────────────────────
const EMPTY = {
  full_name: "", approximate_age: 25, gender: "not_specified",
  clothing_desc: "", identifying_desc: "",
  last_known_location: "", last_seen_at: new Date().toISOString().slice(0, 16),
  lat: undefined as number | undefined, lng: undefined as number | undefined,
  reporter_name: "", reporter_contact: "", notes: "",
};

function ReportForm({ onSuccess }: { onSuccess: (caseId: string) => void }) {
  const [form, setForm] = useState(EMPTY);
  const [step, setStep] = useState<1 | 2>(1);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const createMutation = useCreateReport();

  const gps = useGPS((lat, lng, address) => {
    setForm((f) => ({ ...f, lat, lng, last_known_location: address }));
    toast.success("Location captured");
  });

  const voiceLocation = useVoiceInput((text) => setForm((f) => ({ ...f, last_known_location: text })));
  const voiceName = useVoiceInput((text) => setForm((f) => ({ ...f, full_name: text })));
  const voiceClothing = useVoiceInput((text) => setForm((f) => ({ ...f, clothing_desc: text })));

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5 MB"); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name || !form.last_known_location || !form.reporter_name || !form.reporter_contact) {
      toast.error("Please fill all required fields"); return;
    }
    try {
      // Create report first to get caseId, then upload photo
      const result = await createMutation.mutateAsync({
        full_name: form.full_name, approximate_age: form.approximate_age, gender: form.gender,
        clothing_desc: form.clothing_desc || null, identifying_desc: form.identifying_desc || null,
        last_known_location: form.last_known_location,
        last_seen_at: new Date(form.last_seen_at).toISOString(),
        lat: form.lat ?? null, lng: form.lng ?? null,
        reporter_name: form.reporter_name, reporter_contact: form.reporter_contact,
        notes: form.notes || null, photo_url: null,
      });

      // Upload photo if selected (non-blocking — report already saved)
      if (photoFile) {
        const url = await uploadPhoto(photoFile, result.case_id);
        if (url) {
          await supabase.from("missing_persons").update({ photo_url: url }).eq("id", result.id);
        }
      }
      onSuccess(result.case_id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Missing person report form">
      {step === 1 ? (
        <>
          {/* Photo upload */}
          <div className="space-y-1.5">
            <Label>Photo of missing person (optional)</Label>
            <div className="flex items-center gap-3">
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Preview" className="h-20 w-20 rounded-lg object-cover border border-border" />
                  <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="absolute -top-1.5 -right-1.5 rounded-full bg-background border border-border p-0.5 hover:bg-accent" aria-label="Remove photo">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-muted-foreground transition-colors">
                  <Camera className="h-5 w-5 mb-1" aria-hidden="true" />
                  <span className="text-[10px]">Add photo</span>
                </button>
              )}
              <div className="flex-1 text-xs text-muted-foreground space-y-1">
                <p>Uploading a photo helps responders identify the person.</p>
                <p className="text-[10px]">Max 5 MB · JPG/PNG/WEBP · Stored securely, visible only to responders.</p>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3 w-3" />Choose file
                </Button>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhoto} aria-label="Upload photo" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Name with voice */}
            <div className="space-y-1.5">
              <Label htmlFor="mp-name">Full name <span className="text-critical">*</span></Label>
              <div className="flex gap-1.5">
                <Input id="mp-name" required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Person's full name" />
                {voiceName.supported && (
                  <Button type="button" variant="outline" size="icon" className="shrink-0 h-9 w-9"
                    onClick={() => voiceName.listening ? voiceName.stop() : voiceName.start()}
                    aria-label={voiceName.listening ? "Stop voice input for name" : "Speak person's name"}>
                    {voiceName.listening ? <MicOff className="h-3.5 w-3.5 text-critical" /> : <Mic className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-age">Approximate age <span className="text-critical">*</span></Label>
              <Input id="mp-age" type="number" min={0} max={120} required value={form.approximate_age} onChange={(e) => set("approximate_age", parseInt(e.target.value, 10) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-gender">Gender</Label>
              <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                <SelectTrigger id="mp-gender"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_specified">Not specified</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-last-seen">Last seen (date &amp; time) <span className="text-critical">*</span></Label>
              <Input id="mp-last-seen" type="datetime-local" required value={form.last_seen_at} onChange={(e) => set("last_seen_at", e.target.value)} />
            </div>
          </div>

          {/* Location with GPS + voice */}
          <div className="space-y-1.5">
            <Label htmlFor="mp-location">Last known location <span className="text-critical">*</span></Label>
            <div className="flex gap-1.5">
              <Input id="mp-location" required value={form.last_known_location} onChange={(e) => set("last_known_location", e.target.value)} placeholder="e.g. Balkhu riverside, Kathmandu" className="flex-1" />
              <Button type="button" variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={gps.getLocation} disabled={gps.fetching} aria-label="Use my GPS location" title="Use GPS">
                {gps.fetching ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Navigation className="h-3.5 w-3.5" />}
              </Button>
              {voiceLocation.supported && (
                <Button type="button" variant="outline" size="icon" className="shrink-0 h-9 w-9"
                  onClick={() => voiceLocation.listening ? voiceLocation.stop() : voiceLocation.start()}
                  aria-label={voiceLocation.listening ? "Stop voice input" : "Speak location"}>
                  {voiceLocation.listening ? <MicOff className="h-3.5 w-3.5 text-critical" /> : <Mic className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
            {form.lat && form.lng && (
              <p className="text-[10px] text-safe-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />GPS coordinates captured: {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
              </p>
            )}
          </div>

          {/* Clothing with voice */}
          <div className="space-y-1.5">
            <Label htmlFor="mp-clothing">Clothing &amp; appearance</Label>
            <div className="flex gap-1.5">
              <Textarea id="mp-clothing" value={form.clothing_desc} onChange={(e) => set("clothing_desc", e.target.value)} placeholder="e.g. Red jacket, jeans, blue backpack" rows={2} className="flex-1" />
              {voiceClothing.supported && (
                <Button type="button" variant="outline" size="icon" className="shrink-0 h-9 w-9 self-start"
                  onClick={() => voiceClothing.listening ? voiceClothing.stop() : voiceClothing.start()}
                  aria-label="Speak clothing description">
                  {voiceClothing.listening ? <MicOff className="h-3.5 w-3.5 text-critical" /> : <Mic className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-desc">Other identifying details</Label>
            <Textarea id="mp-desc" value={form.identifying_desc} onChange={(e) => set("identifying_desc", e.target.value)} placeholder="e.g. Glasses, distinctive birthmark, hearing aid…" rows={2} />
          </div>

          <Button type="button" className="w-full" onClick={() => setStep(2)}>
            Next — Your contact details <ArrowRight className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <Lock className="mt-0.5 h-4 w-4 text-primary shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-primary">Your contact details are private</p>
              <p className="text-xs text-muted-foreground mt-0.5">Visible only to authorised emergency responders — never publicly displayed.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mp-rname">Your name <span className="text-critical">*</span></Label>
              <Input id="mp-rname" required value={form.reporter_name} onChange={(e) => set("reporter_name", e.target.value)} placeholder="Your full name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-rcontact">Phone / email <span className="text-critical">*</span></Label>
              <Input id="mp-rcontact" required value={form.reporter_contact} onChange={(e) => set("reporter_contact", e.target.value)} placeholder="Phone number or email" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-notes">Additional notes for responders</Label>
            <Textarea id="mp-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any other information that may help search teams" rows={3} />
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Submitting…" : "Submit Report"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen({ caseId, onAnother }: { caseId: string; onAnother: () => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center space-y-4" role="alert" aria-live="assertive">
      <div className="rounded-full bg-safe-soft p-5"><CheckCircle2 className="h-12 w-12 text-safe" /></div>
      <h2 className="text-xl font-bold font-display">Report submitted</h2>
      <p className="text-sm text-muted-foreground max-w-sm">Your report has been logged securely and shared with emergency response teams.</p>
      <div className="rounded-xl border border-border bg-card px-6 py-4">
        <p className="label-caps mb-1">Case ID</p>
        <p className="font-mono text-3xl font-bold text-primary" aria-label={`Case ID ${caseId}`}>{caseId}</p>
        <p className="mt-1 text-xs text-muted-foreground">Share with the response team</p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onAnother}>Report another</Button>
        <Button asChild><Link to="/command">Command Centre</Link></Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function MissingPersonPage() {
  const { data: reports, isLoading } = useMissingPersons();
  const [submitted, setSubmitted] = useState(false);
  const [caseId, setCaseId] = useState("");
  const [tab, setTab] = useState<"report" | "track">("report");
  const [isResponder, setIsResponder] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setIsResponder(!!data.session));
  }, []);

  const active = (reports ?? []).filter((r) => r.status !== "closed");
  const closed = (reports ?? []).filter((r) => r.status === "closed");

  return (
    <div>
      <PageHeader title="Missing / Lost Person" description="Report and track missing persons during emergencies">
        <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary text-[10px]">
          <Lock className="h-3 w-3" /> Privacy-protected
        </Badge>
      </PageHeader>

      <div className="p-4 sm:p-6 max-w-5xl space-y-5">
        {/* Privacy notice — concise */}
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <Lock className="mt-0.5 h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="font-semibold text-primary">Privacy &amp; safety</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reports are stored securely. Contact details and photos are visible only to authorised responders.
              No facial recognition. No public exposure of personal data.
              For immediate danger, call <strong>112</strong> first.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border">
          {(["report", "track"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              aria-current={tab === t ? "page" : undefined}>
              {t === "report" ? "Submit Report" : `Active Cases (${active.length})`}
            </button>
          ))}
        </div>

        {/* Report tab */}
        {tab === "report" && (
          submitted
            ? <SuccessScreen caseId={caseId} onAnother={() => { setSubmitted(false); setCaseId(""); }} />
            : (
              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <UserX className="h-4 w-4 text-critical" />Missing / Lost Person Report
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ReportForm onSuccess={(id) => { setCaseId(id); setSubmitted(true); setTab("track"); }} />
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">What happens next?</CardTitle></CardHeader>
                    <CardContent>
                      <ol className="space-y-3">
                        {[
                          { n:1, label:"Report received", desc:"Case ID generated immediately", bg:"bg-moderate" },
                          { n:2, label:"Verified",        desc:"Responder confirms details",    bg:"bg-high" },
                          { n:3, label:"Search started",  desc:"Field team dispatched",         bg:"bg-primary" },
                          { n:4, label:"Located",         desc:"Person found",                  bg:"bg-safe" },
                          { n:5, label:"Case closed",     desc:"Archived securely",             bg:"bg-muted-foreground" },
                        ].map((s) => (
                          <li key={s.n} className="flex items-start gap-3">
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${s.bg}`}>{s.n}</span>
                            <div>
                              <p className="text-xs font-semibold">{s.label}</p>
                              <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                  <div className="rounded-lg border border-critical/20 bg-critical-soft px-4 py-3 text-xs text-critical">
                    <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />Immediate danger?</p>
                    <p className="mt-1 text-critical/80">Call <strong>112</strong> (Nepal emergency services) first. This form is for tracking purposes.</p>
                  </div>
                </div>
              </div>
            )
        )}

        {/* Track tab */}
        {tab === "track" && (
          <div className="space-y-4">
            {!isResponder && (
              <div className="flex items-start gap-2 rounded-lg border border-moderate/30 bg-moderate-soft px-4 py-3 text-sm text-moderate-foreground">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Sign in as an authorised responder to view contact details and update cases. <Link to="/auth/sign-in" className="font-semibold underline">Sign in</Link></span>
              </div>
            )}

            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
              </div>
            ) : active.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <UserX className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">No active missing person reports</p>
                <p className="mt-1 text-xs text-muted-foreground">Reports submitted via this form will appear here.</p>
              </div>
            ) : (
              <>
                <p className="label-caps">{active.length} active case{active.length !== 1 ? "s" : ""}</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {active.map((mp) => <CaseCard key={mp.id} mp={mp} isResponder={isResponder} />)}
                </div>
                {closed.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground mt-4">{closed.length} closed case{closed.length !== 1 ? "s" : ""}</summary>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 opacity-60">
                      {closed.map((mp) => <CaseCard key={mp.id} mp={mp} isResponder={isResponder} />)}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
