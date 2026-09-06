import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  AlertTriangle,
  Truck,
  Route,
  MapPin,
  Hospital,
  BarChart3,
  Radio,
  Users,
  Settings,
  Menu,
  X,
  ShieldAlert,
  Bell,
  LogOut,
  Accessibility,
  Map,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const NAV_ITEMS = [
  { to: "/", label: "Command Centre", icon: LayoutDashboard },
  { to: "/incidents", label: "Incidents", icon: AlertTriangle },
  { to: "/vehicles", label: "Vehicles", icon: Truck },
  { to: "/routes", label: "Route Planner", icon: Route },
  { to: "/roads", label: "Road Conditions", icon: MapPin },
  { to: "/alerts", label: "Alert Centre", icon: Bell },
  { to: "/facilities", label: "Hospitals & Shelters", icon: Hospital },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/map", label: "Community Map", icon: Map },
  { to: "/sos", label: "SOS Report", icon: Radio },
  { to: "/family", label: "Family Circle", icon: Users },
] as const;

const BOTTOM_NAV = [
  { to: "/accessibility", label: "Accessibility", icon: Accessibility },
  { to: "/auth/sign-in", label: "Sign In", icon: LogOut },
] as const;

function NavLink({
  to,
  label,
  icon: Icon,
  onClick,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
}) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
          <ShieldAlert className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold text-sidebar-foreground tracking-wide">
            RESH MESQ
          </p>
          <p className="text-[10px] label-caps text-sidebar-foreground/50">Emergency Response</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            label={item.label}
            icon={item.icon}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      {/* Bottom links */}
      <div className="px-2 py-3 border-t border-sidebar-border space-y-0.5">
        {BOTTOM_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            label={item.label}
            icon={item.icon}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border shadow-xl">
            <div className="flex justify-end p-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="flex md:hidden items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <span className="font-display font-semibold text-sm">RESH MESQ</span>
          </div>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto"
          id="main-content"
          tabIndex={-1}
          aria-label="Page content"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
