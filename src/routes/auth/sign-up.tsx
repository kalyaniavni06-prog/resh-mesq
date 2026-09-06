import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldAlert, Eye, EyeOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUpPage,
});

const ROLES: { value: AppRole; label: string; desc: string }[] = [
  { value: "responder", label: "Responder", desc: "Field responder — can update incidents" },
  { value: "dispatcher", label: "Dispatcher", desc: "Dispatcher — can manage resources" },
  { value: "admin", label: "Admin", desc: "Full access — all operations" },
];

function SignUpPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    agency: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "responder" as AppRole,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            agency: form.agency,
            role: form.role,
          },
        },
      });
      if (error) throw error;
      toast.success("Account created — please check your email to confirm");
      navigate({ to: "/auth/sign-in" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-md">
            <ShieldAlert className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">RESH MESQ</h1>
          <p className="mt-1 text-sm text-muted-foreground">Register as an operator</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold text-foreground">Create your account</h2>
            <p className="text-xs text-muted-foreground">
              Register to access the emergency response platform
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="su-name">Full name *</Label>
                <Input
                  id="su-name"
                  required
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-agency">Agency / Organisation</Label>
                <Input
                  id="su-agency"
                  value={form.agency}
                  onChange={(e) => set("agency", e.target.value)}
                  placeholder="e.g. Nepal Red Cross, NDRRMA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-role">Role</Label>
                <Select value={form.role} onValueChange={(v) => set("role", v as AppRole)}>
                  <SelectTrigger id="su-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <span className="font-medium">{r.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{r.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-email">Email address *</Label>
                <Input
                  id="su-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="you@agency.gov.np"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-pwd">Password *</Label>
                <div className="relative">
                  <Input
                    id="su-pwd"
                    type={showPwd ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder="Min. 6 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPwd((v) => !v)}
                    aria-label={showPwd ? "Hide password" : "Show password"}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-cpwd">Confirm password *</Label>
                <Input
                  id="su-cpwd"
                  type={showPwd ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={form.confirmPassword}
                  onChange={(e) => set("confirmPassword", e.target.value)}
                  placeholder="Repeat password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <UserPlus className="h-4 w-4" />
                {loading ? "Creating account…" : "Create account"}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Already registered?{" "}
              <Link to="/auth/sign-in" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
