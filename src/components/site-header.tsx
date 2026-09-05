import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, ShieldAlert, Siren } from "lucide-react";
import { useEffect, useState } from "react";

import { A11yToolbar } from "@/components/a11y-toolbar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/dashboard", label: "Command centre" },
  { to: "/route-planner", label: "Safe routes" },
  { to: "/alerts", label: "Alerts" },
  { to: "/resources", label: "Hospitals & shelters" },
  { to: "/accessibility", label: "Accessibility" },
] as const;

export function SiteHeader() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Shift+S opens the SOS report from anywhere, including screen-reader use.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.shiftKey && (event.key === "S" || event.key === "s")) {
        event.preventDefault();
        navigate({ to: "/report" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <a href="#main" className="sr-focusable rounded-md bg-primary px-3 py-2 text-primary-foreground">
        Skip to main content
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2" aria-label="RESH MESQ home">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShieldAlert className="size-5" aria-hidden="true" />
          </span>
          <span className="leading-none">
            <span className="block font-display text-base font-bold tracking-tight">RESH MESQ</span>
            <span className="label-caps text-[0.625rem]">Emergency Route Optimizer</span>
          </span>
        </Link>

        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "bg-accent text-foreground" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <A11yToolbar />
          <Button asChild variant="destructive" className="gap-2 font-semibold">
            <Link to="/report">
              <Siren className="size-4" aria-hidden="true" />
              SOS
            </Link>
          </Button>
          {!loading &&
            (user ? (
              <div className="hidden items-center gap-2 sm:flex">
                <Button asChild variant="outline" size="sm">
                  <Link to="/family">My circle</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate({ to: "/" });
                  }}
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link to="/auth">Responder sign in</Link>
              </Button>
            ))}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-6">
              <SheetTitle className="font-display">RESH MESQ</SheetTitle>
              <nav aria-label="Mobile" className="mt-6 flex flex-col gap-1">
                {links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  to={user ? "/family" : "/auth"}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
                >
                  {user ? "My circle" : "Responder sign in"}
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-lg font-bold">RESH MESQ</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Intelligent emergency response and disaster-safe route optimization.
          </p>
        </div>
        <div>
          <p className="label-caps">Respond</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/report" className="hover:underline">
                Raise an SOS
              </Link>
            </li>
            <li>
              <Link to="/dashboard" className="hover:underline">
                Command centre
              </Link>
            </li>
            <li>
              <Link to="/route-planner" className="hover:underline">
                Safe route planner
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="label-caps">Prepare</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link to="/alerts" className="hover:underline">
                Live alerts
              </Link>
            </li>
            <li>
              <Link to="/resources" className="hover:underline">
                Hospitals &amp; shelters
              </Link>
            </li>
            <li>
              <Link to="/accessibility" className="hover:underline">
                Accessibility features
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="label-caps">Remember</p>
          <p className="mt-3 font-display text-base font-bold uppercase tracking-wide">
            In an emergency, every second matters.
          </p>
        </div>
      </div>
    </footer>
  );
}
