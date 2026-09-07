import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Users,
  UserPlus,
  Phone,
  MapPin,
  Shield,
  Info,
  X,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/family")({
  component: FamilyCirclePage,
});

type SafetyStatus = "safe" | "unknown" | "needs_help";

interface Contact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  location: string;
  status: SafetyStatus;
}

const DEMO_CONTACTS: Contact[] = [
  {
    id: "1",
    name: "Priya Sharma",
    relation: "Spouse",
    phone: "Demo — not a real number",
    location: "Lalitpur, Patan",
    status: "safe",
  },
  {
    id: "2",
    name: "Arjun Sharma",
    relation: "Child",
    phone: "Demo — not a real number",
    location: "Kathmandu, Baneshwor",
    status: "unknown",
  },
  {
    id: "3",
    name: "Meera Karki",
    relation: "Parent",
    phone: "Demo — not a real number",
    location: "Bhaktapur",
    status: "safe",
  },
];

const STATUS_CONFIG: Record<SafetyStatus, { label: string; classes: string }> = {
  safe: { label: "Safe", classes: "bg-safe-soft text-safe-foreground border-safe/20" },
  unknown: {
    label: "Unknown",
    classes: "bg-moderate-soft text-moderate-foreground border-moderate/20",
  },
  needs_help: {
    label: "Needs Help",
    classes: "bg-critical-soft text-critical border-critical/20",
  },
};

function ContactCard({
  contact,
  onUpdateStatus,
  onRemove,
}: {
  contact: Contact;
  onUpdateStatus: (id: string, s: SafetyStatus) => void;
  onRemove: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[contact.status];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
              {contact.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{contact.name}</p>
              <p className="text-xs text-muted-foreground">{contact.relation}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${cfg.classes}`}
            >
              {cfg.label}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onRemove(contact.id)}
              aria-label="Remove contact"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{contact.phone}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{contact.location}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["safe", "unknown", "needs_help"] as SafetyStatus[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={contact.status === s ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => onUpdateStatus(contact.id, s)}
            >
              {STATUS_CONFIG[s].label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FamilyCirclePage() {
  const [contacts, setContacts] = useState<Contact[]>(DEMO_CONTACTS);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    relation: "",
    phone: "",
    location: "",
  });

  function updateStatus(id: string, status: SafetyStatus) {
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
    toast.success("Safety status updated");
  }

  function removeContact(id: string) {
    setContacts((cs) => cs.filter((c) => c.id !== id));
    toast.success("Contact removed");
  }

  function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) return;
    setContacts((cs) => [
      ...cs,
      { id: Date.now().toString(), ...form, status: "unknown" as SafetyStatus },
    ]);
    setForm({ name: "", relation: "", phone: "", location: "" });
    setAddOpen(false);
    toast.success("Contact added");
  }

  const safe = contacts.filter((c) => c.status === "safe").length;
  const unknown = contacts.filter((c) => c.status === "unknown").length;
  const needsHelp = contacts.filter((c) => c.status === "needs_help").length;

  return (
    <div>
      <PageHeader
        title="Family Circle"
        description="Track the safety status of family members and close contacts"
      >
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-3.5 w-3.5" />
          Add contact
        </Button>
      </PageHeader>

      <div className="p-6 space-y-6">
        {/* Demo disclaimer */}
        <div className="flex items-start gap-3 rounded-lg border border-moderate/40 bg-moderate-soft px-4 py-3 text-sm text-moderate-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Demonstration feature</p>
            <p className="mt-0.5">
              This is a local UI-only demo. Contacts are stored in page state only and are not
              persisted. No SMS or push notifications are sent.
            </p>
          </div>
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="panel p-4 text-center border-safe/30 bg-safe-soft">
            <p className="label-caps mb-1 text-safe-foreground">Safe</p>
            <p className="text-3xl font-bold font-display text-safe-foreground">{safe}</p>
          </div>
          <div className="panel p-4 text-center border-moderate/30 bg-moderate-soft">
            <p className="label-caps mb-1 text-moderate-foreground">Unknown</p>
            <p className="text-3xl font-bold font-display text-moderate-foreground">{unknown}</p>
          </div>
          <div
            className={`panel p-4 text-center ${needsHelp > 0 ? "border-critical/30 bg-critical-soft" : "border-border"}`}
          >
            <p className={`label-caps mb-1 ${needsHelp > 0 ? "text-critical" : "text-muted-foreground"}`}>
              Needs Help
            </p>
            <p
              className={`text-3xl font-bold font-display ${needsHelp > 0 ? "text-critical" : "text-foreground"}`}
            >
              {needsHelp}
            </p>
          </div>
        </div>

        {/* How it works */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              How Family Circle works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {[
              "Add family members and close contacts to your safety circle.",
              "During an emergency, check in on each contact and update their safety status.",
              "If a contact needs help, create an SOS report with their location.",
              "Contacts can also update their own status by logging into the platform.",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-safe" />
                <span>{step}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Contact list */}
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No contacts added yet</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setAddOpen(true)}
            >
              Add your first contact
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {contacts.map((c) => (
              <ContactCard
                key={c.id}
                contact={c}
                onUpdateStatus={updateStatus}
                onRemove={removeContact}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add contact dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={addContact} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="fc-name">Full name *</Label>
              <Input
                id="fc-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Priya Sharma"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fc-rel">Relation</Label>
              <Input
                id="fc-rel"
                value={form.relation}
                onChange={(e) => setForm((f) => ({ ...f, relation: e.target.value }))}
                placeholder="e.g. Spouse, Parent, Child"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fc-phone">Phone (demo only)</Label>
              <Input
                id="fc-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="For display only — not dialled"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fc-loc">Last known location</Label>
              <Input
                id="fc-loc"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Lalitpur, Patan"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add contact</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
