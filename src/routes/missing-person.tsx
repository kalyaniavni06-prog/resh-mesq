import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  MapPin,
  Search,
  User,
  UserX,
  FileText,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
      {
        name: "description",
        content:
          "Report a missing or lost person during a disaster or emergency. Reports are securely stored and shared only with authorised emergency responders.",
      },
    ],
  }),
  component: MissingPersonPage,
});

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<Status, { label: string; icon: React.ReactNode; classes: string; step: number }> = {
  reported: {
    label: "Reported",
    icon: <FileText className="h-3.5 w-3.5" />,
    classes: "bg-moderate-soft text-moderate-foreground border-moderate/20",
    step: 1,
  },
  verified: {
    label: "Verified",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    classes: "bg-high-soft text-high-foreground border-high/20",
    step: 2,
  },
  search_in_progress: {
    label: "Search in Progress",
    icon: <Search className="h-3.5 w-3.5" />,
    classes: "bg-primary/10 text-primary border-primary/20",
    step: 3,
  },
  located: {
    label: "Located",
    icon: <MapPin className="h-3.5 w-3.5" />,
    classes: "bg-safe-soft text-safe-foreground border-safe/20",
    step: 4,
  },
  closed: {
    label: "Closed",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    classes: "bg-muted text-muted-foreground border-border",
    step: 5,
  },
};

const STATUS_FLOW: Status[] = ["reported", "verified", "search_in_progress", "located", "closed"];

// ── Queries ──────────────────────────────────────────────────────────────────
function useMissingPersons() {
  return useQuery({
    queryKey: ["missing_persons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missing_persons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        // Table may not exist yet (migration not applied) — return empty
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
      const { data, error } = await supabase
        .from("missing_persons")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as MissingPerson;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missing_persons"] }),
  });
}

function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: Status; notes?: string }) => {
      const { data, error } = await supabase
        .from("missing_persons")
        .update({ status, ...(notes ? { notes } : {}) })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as MissingPerson;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["missing_persons"] }),
  });
}

// ── Status progress bar ──────────────────────────────────────────────────────
function StatusFlow({ current }: { current: Status }) {
  const currentStep = STATUS_CONFIG[current].step;
  return (
    <div className="flex items-center gap-0" aria-label={`Case status: ${STATUS_CONFIG[current].label}`}>
      {STATUS_FLOW.map((s, i) => {
        const cfg = STATUS_CONFIG[s];
        const done = cfg.step <= currentStep;
        const active = s === current;
        return (
          <div key={s} className="flex items-center">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : done
                    ? "bg-safe text-white border-safe"
                    : "bg-muted text-muted-foreground border-border"
              }`}
              aria-current={active ? "step" : undefined}
              title={cfg.label}
            >
              {cfg.step}
            </div>
            {i < STATUS_FLOW.length - 1 && (
              <div
                className={`h-px w-5 sm:w-8 ${done && cfg.step < currentStep ? "bg-safe" : "bg-border"}`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Case card (responder view — no contact details shown publicly) ─────────────
function CaseCard({
  mp,
  isResponder,
}: {
  mp: MissingPerson;
  isResponder: boolean;
}) {
  const cfg = STATUS_CONFIG[mp.status];
  const updateMutation = useUpdateStatus();

  async function advance() {
    const nextIdx = STATUS_FLOW.indexOf(mp.status) + 1;
    const next = STATUS_FLOW[nextIdx];
    if (!next) return;
    try {
      await updateMutation.mutateAsync({ id: mp.id, status: next });
      toast.success(`Status updated to "${STATUS_CONFIG[next].label}"`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <User className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{mp.full_name}</p>
              <p className="text-[10px] text-muted-foreground">
                Age: {mp.approximate_age} · {mp.gender !== "not_specified" ? mp.gender : "Gender not specified"}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="font-mono text-[10px] text-muted-foreground">{mp.case_id}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${cfg.classes}`}
            >
              {cfg.icon}
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Status flow */}
        <StatusFlow current={mp.status} />

        {/* Details */}
        <div className="space-y-1 text-xs">
          <div className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
            <span><span className="font-medium">Last seen:</span> {mp.last_known_location}</span>
          </div>
          <div className="flex items-start gap-1.5">
            <Clock className="mt-0.5 h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>
              {new Date(mp.last_seen_at).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
          {mp.clothing_desc && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Clothing:</span> {mp.clothing_desc}
            </p>
          )}
          {mp.identifying_desc && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Description:</span> {mp.identifying_desc}
            </p>
          )}
          {mp.notes && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Notes:</span> {mp.notes}
            </p>
          )}
        </div>

        {/* Contact — only shown to authenticated responders */}
        {isResponder ? (
          <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
            <Lock className="mt-0.5 h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-semibold text-primary">Reporter (responders only)</p>
              <p className="text-muted-foreground">{mp.reporter_name}</p>
              <p className="text-muted-foreground">{mp.reporter_contact}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-[10px] text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
            Reporter contact details visible to authorised responders only.
          </div>
        )}

        {/* Advance status — responders only */}
        {isResponder && mp.status !== "closed" && mp.status !== "located" && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs"
            disabled={updateMutation.isPending}
            onClick={advance}
          >
            <ArrowRight className="h-3.5 w-3.5" />
            Mark as: {STATUS_CONFIG[STATUS_FLOW[STATUS_FLOW.indexOf(mp.status) + 1] ?? "closed"].label}
          </Button>
        )}
        {isResponder && (mp.status === "located" || mp.status === "closed") && mp.status !== "closed" && (
          <Button
            size="sm"
            className="w-full text-xs bg-safe hover:bg-safe/90 text-white"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutateAsync({ id: mp.id, status: "closed" })}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Close case
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Report form ───────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  full_name: "",
  approximate_age: 25,
  gender: "not_specified",
  clothing_desc: "",
  identifying_desc: "",
  last_known_location: "",
  last_seen_at: new Date().toISOString().slice(0, 16),
  lat: undefined as number | undefined,
  lng: undefined as number | undefined,
  reporter_name: "",
  reporter_contact: "",
  notes: "",
};

function ReportForm({ onSuccess }: { onSuccess: (caseId: string) => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [step, setStep] = useState<1 | 2>(1);
  const createMutation = useCreateReport();

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name || !form.last_known_location || !form.reporter_name || !form.reporter_contact) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        full_name: form.full_name,
        approximate_age: form.approximate_age,
        gender: form.gender,
        clothing_desc: form.clothing_desc || null,
        identifying_desc: form.identifying_desc || null,
        last_known_location: form.last_known_location,
        last_seen_at: new Date(form.last_seen_at).toISOString(),
        lat: form.lat ?? null,
        lng: form.lng ?? null,
        reporter_name: form.reporter_name,
        reporter_contact: form.reporter_contact,
        notes: form.notes || null,
      });
      onSuccess(result.case_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      toast.error(msg);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Missing person report form">
      {step === 1 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mp-name">Full name <span className="text-critical" aria-label="required">*</span></Label>
              <Input id="mp-name" required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Person's full name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-age">Approximate age <span className="text-critical" aria-label="required">*</span></Label>
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
              <Label htmlFor="mp-last-seen">Last seen (date &amp; time) <span className="text-critical" aria-label="required">*</span></Label>
              <Input id="mp-last-seen" type="datetime-local" required value={form.last_seen_at} onChange={(e) => set("last_seen_at", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mp-location">Last known location <span className="text-critical" aria-label="required">*</span></Label>
            <Input id="mp-location" required value={form.last_known_location} onChange={(e) => set("last_known_location", e.target.value)} placeholder="e.g. Balkhu riverside, near the market, Kathmandu" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mp-lat">Latitude (approx, optional)</Label>
              <Input id="mp-lat" type="number" step="0.0001" value={form.lat ?? ""} onChange={(e) => set("lat", parseFloat(e.target.value) || undefined)} placeholder="e.g. 27.7172" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-lng">Longitude (approx, optional)</Label>
              <Input id="mp-lng" type="number" step="0.0001" value={form.lng ?? ""} onChange={(e) => set("lng", parseFloat(e.target.value) || undefined)} placeholder="e.g. 85.3240" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mp-clothing">Clothing &amp; appearance</Label>
            <Textarea id="mp-clothing" value={form.clothing_desc} onChange={(e) => set("clothing_desc", e.target.value)} placeholder="e.g. Red jacket, jeans, blue backpack" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mp-desc">Any other identifying details</Label>
            <Textarea id="mp-desc" value={form.identifying_desc} onChange={(e) => set("identifying_desc", e.target.value)} placeholder="e.g. Glasses, distinctive birthmark, etc." rows={2} />
          </div>
          <Button type="button" className="w-full" onClick={() => setStep(2)}>
            Next — Your contact details
            <ArrowRight className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <Lock className="mt-0.5 h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <div className="text-sm text-primary">
              <p className="font-semibold">Your contact details are private</p>
              <p className="text-xs mt-0.5 text-muted-foreground">
                They will be shared only with authorised emergency responders and are never displayed publicly.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mp-rname">Your name <span className="text-critical" aria-label="required">*</span></Label>
              <Input id="mp-rname" required value={form.reporter_name} onChange={(e) => set("reporter_name", e.target.value)} placeholder="Your full name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-rcontact">Your phone / email <span className="text-critical" aria-label="required">*</span></Label>
              <Input id="mp-rcontact" required value={form.reporter_contact} onChange={(e) => set("reporter_contact", e.target.value)} placeholder="Phone number or email address" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mp-notes">Additional notes for responders</Label>
            <Textarea id="mp-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any other information that may help search teams" rows={3} />
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Submitting…" : "Submit Missing Person Report"}
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
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4" role="alert" aria-live="assertive">
      <div className="rounded-full bg-safe-soft p-5">
        <CheckCircle2 className="h-12 w-12 text-safe" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-bold font-display text-foreground">Report submitted</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Your missing person report has been securely logged and shared with emergency response teams.
        Keep this case ID for tracking.
      </p>
      <div className="rounded-xl border border-border bg-card px-6 py-4 text-center">
        <p className="label-caps mb-1">Case ID</p>
        <p className="font-mono text-3xl font-bold text-primary" aria-label={`Case ID: ${caseId}`}>{caseId}</p>
        <p className="mt-1 text-xs text-muted-foreground">Share this with the response team</p>
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onAnother}>Report another</Button>
        <Button asChild>
          <Link to="/command">View Command Centre</Link>
        </Button>
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

  // Detect responder (authenticated user) — simplified: check if session exists
  const [isResponder, setIsResponder] = useState(false);
  useMemo(() => {
    import("@/integrations/supabase/client").then(({ supabase: sb }) => {
      sb.auth.getSession().then(({ data }) => setIsResponder(!!data.session));
    });
  }, []);

  const activeReports = (reports ?? []).filter((r) => r.status !== "closed");
  const closedReports = (reports ?? []).filter((r) => r.status === "closed");

  function handleSuccess(id: string) {
    setCaseId(id);
    setSubmitted(true);
    setTab("track");
  }

  return (
    <div>
      <PageHeader
        title="Missing / Lost Person"
        description="Report a missing person during an emergency or disaster"
      >
        <Badge variant="outline" className="gap-1.5 border-moderate/50 bg-moderate-soft text-moderate-foreground text-[10px]">
          <Lock className="h-3 w-3" />
          Privacy-protected
        </Badge>
      </PageHeader>

      <div className="p-4 sm:p-6 max-w-5xl space-y-5">

        {/* Privacy notice */}
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 text-primary shrink-0" aria-hidden="true" />
          <div className="text-primary">
            <p className="font-semibold">Privacy &amp; safety notice</p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground list-disc pl-4">
              <li>Reports are stored securely in our emergency database.</li>
              <li>Contact details and sensitive information are visible only to authorised responders.</li>
              <li>No photos are stored in this system — describe the person in text.</li>
              <li>Reports are not publicly searchable.</li>
              <li>No facial recognition or automated identity matching is performed.</li>
            </ul>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border pb-0">
          {(["report", "track"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-2.5 px-1 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              aria-current={tab === t ? "page" : undefined}
            >
              {t === "report" ? "Submit Report" : `Active Cases (${activeReports.length})`}
            </button>
          ))}
        </div>

        {/* Report tab */}
        {tab === "report" && (
          submitted ? (
            <SuccessScreen caseId={caseId} onAnother={() => { setSubmitted(false); setCaseId(""); }} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <UserX className="h-4 w-4 text-critical" aria-hidden="true" />
                    Missing / Lost Person Report
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ReportForm onSuccess={handleSuccess} />
                </CardContent>
              </Card>

              {/* Workflow sidebar */}
              <div className="space-y-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">What happens after you report?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-3" role="list">
                      {[
                        { n: 1, label: "Report received", desc: "Case ID generated immediately", color: "bg-moderate" },
                        { n: 2, label: "Verified", desc: "Responder confirms details", color: "bg-high" },
                        { n: 3, label: "Search started", desc: "Field team dispatched to last location", color: "bg-primary" },
                        { n: 4, label: "Located", desc: "Person found — family notified", color: "bg-safe" },
                        { n: 5, label: "Case closed", desc: "Report archived securely", color: "bg-muted-foreground" },
                      ].map((s) => (
                        <li key={s.n} className="flex items-start gap-3">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${s.color}`} aria-hidden="true">{s.n}</span>
                          <div>
                            <p className="text-xs font-semibold text-foreground">{s.label}</p>
                            <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>

                <div className="rounded-lg border border-critical/20 bg-critical-soft px-4 py-3 text-xs text-critical">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Real emergency?
                  </p>
                  <p className="mt-1 text-critical/80">
                    If someone is in immediate danger, call <strong>112</strong> (Nepal emergency services) first.
                    This form is for tracking — it does not replace emergency calls.
                  </p>
                </div>
              </div>
            </div>
          )
        )}

        {/* Track tab */}
        {tab === "track" && (
          <div className="space-y-5">
            {!isResponder && (
              <div className="flex items-start gap-2 rounded-lg border border-moderate/30 bg-moderate-soft px-4 py-3 text-sm text-moderate-foreground">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Sign in as an authorised responder to view contact details and update case status.{" "}
                  <Link to="/auth/sign-in" className="font-semibold underline">Sign in</Link>
                </span>
              </div>
            )}

            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
              </div>
            ) : activeReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <UserX className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">No active missing person reports</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reports appear here once submitted. Data shown to authorised responders only.
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground italic">
                  Note: Run the SQL migration to enable this feature on your Supabase project.
                </p>
              </div>
            ) : (
              <>
                <p className="label-caps">{activeReports.length} active case{activeReports.length !== 1 ? "s" : ""}</p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {activeReports.map((mp) => (
                    <CaseCard key={mp.id} mp={mp} isResponder={isResponder} />
                  ))}
                </div>
                {closedReports.length > 0 && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      {closedReports.length} closed case{closedReports.length !== 1 ? "s" : ""}
                    </summary>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 opacity-60">
                      {closedReports.map((mp) => (
                        <CaseCard key={mp.id} mp={mp} isResponder={isResponder} />
                      ))}
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
