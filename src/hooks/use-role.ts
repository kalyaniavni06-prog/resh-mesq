import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { rolesQuery, type AppRole } from "@/lib/queries";

/** Role helpers for role-based access. Server-side RLS remains the real gate. */
export function useRole() {
  const { user, loading } = useAuth();
  const { data: roles = [], isLoading } = useQuery(rolesQuery(user?.id));

  const has = (role: AppRole) => roles.includes(role);
  return {
    user,
    roles,
    loading: loading || (Boolean(user) && isLoading),
    isAdmin: has("admin"),
    isDispatcher: has("dispatcher"),
    isResponder: has("responder"),
    /** Admins and dispatchers may edit roads, alerts, hospitals and incident status. */
    canManage: has("admin") || has("dispatcher"),
    /** Responders may also update vehicles. */
    canUpdateVehicles: has("admin") || has("dispatcher") || has("responder"),
  };
}
