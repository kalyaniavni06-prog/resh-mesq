import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ── Type aliases ─────────────────────────────────────────────────────────────
export type Incident = Tables<"emergency_incidents">;
export type Vehicle = Tables<"emergency_vehicles">;
export type Road = Tables<"road_conditions">;
export type Alert = Tables<"disaster_alerts">;
export type Hospital = Tables<"hospitals">;
export type Shelter = Tables<"shelters">;
export type RouteRow = Tables<"routes">;
export type Profile = Tables<"profiles">;

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Turn a Supabase PostgREST error into a human-readable message.
 * Covers the most common causes so users see useful feedback.
 */
export function supabaseErrorMessage(error: { code?: string; message?: string; details?: string | null; hint?: string | null }): string {
  const code = error.code ?? "";
  const msg  = error.message ?? "";

  // Auth / RLS
  if (code === "42501" || msg.includes("row-level security") || msg.includes("permission denied"))
    return "Permission denied. You may need to sign in to perform this action.";
  if (msg.includes("JWT") || msg.includes("auth") || msg.includes("401"))
    return "Authentication required. Please sign in and try again.";

  // Missing table / column
  if (code === "42P01" || msg.includes("does not exist"))
    return "Database table not found. The schema may need to be applied.";
  if (code === "42703")
    return "Unknown database column. There may be a schema mismatch.";

  // Constraint violations
  if (code === "23505" || msg.includes("unique"))
    return "A record with this information already exists.";
  if (code === "23503" || msg.includes("foreign key"))
    return "Related record not found. Please check your input.";
  if (code === "23502" || msg.includes("not-null"))
    return "A required field is missing. Please fill in all required fields.";
  if (code === "23514" || msg.includes("check"))
    return "A field value is outside the allowed range or format.";

  // Storage
  if (msg.includes("bucket") || msg.includes("storage"))
    return "Photo storage unavailable. The report was saved without a photo.";

  // Network
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed to fetch"))
    return "Network error. Check your connection and try again.";

  // Unknown — show the actual message so devs can debug
  return msg || "An unexpected error occurred. Please try again.";
}

// ── Incidents ────────────────────────────────────────────────────────────────
export function useIncidents() {
  return useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emergency_incidents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(supabaseErrorMessage(error));
      return (data ?? []) as Incident[];
    },
  });
}

export function useIncident(id: string) {
  return useQuery({
    queryKey: ["incident", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emergency_incidents")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw new Error(supabaseErrorMessage(error));
      return data as Incident;
    },
    enabled: !!id,
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TablesInsert<"emergency_incidents">) => {
      // Attach the current user's ID if they are signed in, so the
      // "incidents insert authed" RLS policy (auth.uid() is not null) passes.
      const { data: { session } } = await supabase.auth.getSession();
      const enriched: TablesInsert<"emergency_incidents"> = {
        ...payload,
        // Only set created_by when authenticated; anon inserts use the separate
        // "incidents insert anon sos" policy that requires created_by IS NULL.
        created_by: session?.user.id ?? null,
      };

      const { data, error } = await supabase
        .from("emergency_incidents")
        .insert(enriched)
        .select()
        .single();

      if (error) throw new Error(supabaseErrorMessage(error));
      return data as Incident;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
    },
  });
}

export function useUpdateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: TablesUpdate<"emergency_incidents">;
    }) => {
      const { data, error } = await supabase
        .from("emergency_incidents")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(supabaseErrorMessage(error));
      return data as Incident;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["incident", id] });
    },
  });
}

// ── Vehicles ─────────────────────────────────────────────────────────────────
export function useVehicles() {
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emergency_vehicles")
        .select("*")
        .order("code");
      if (error) throw new Error(supabaseErrorMessage(error));
      return (data ?? []) as Vehicle[];
    },
  });
}

export function useUpdateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: TablesUpdate<"emergency_vehicles">;
    }) => {
      const { data, error } = await supabase
        .from("emergency_vehicles")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(supabaseErrorMessage(error));
      return data as Vehicle;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vehicles"] }),
  });
}

// ── Roads ─────────────────────────────────────────────────────────────────────
export function useRoads() {
  return useQuery({
    queryKey: ["roads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("road_conditions")
        .select("*")
        .order("road_name");
      if (error) throw new Error(supabaseErrorMessage(error));
      return (data ?? []) as Road[];
    },
  });
}

// ── Alerts ────────────────────────────────────────────────────────────────────
export function useAlerts(activeOnly = false) {
  return useQuery({
    queryKey: ["alerts", activeOnly],
    queryFn: async () => {
      let q = supabase
        .from("disaster_alerts")
        .select("*")
        .order("issued_at", { ascending: false });
      if (activeOnly) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw new Error(supabaseErrorMessage(error));
      return (data ?? []) as Alert[];
    },
  });
}

// ── Hospitals ────────────────────────────────────────────────────────────────
export function useHospitals() {
  return useQuery({
    queryKey: ["hospitals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospitals")
        .select("*")
        .order("name");
      if (error) throw new Error(supabaseErrorMessage(error));
      return (data ?? []) as Hospital[];
    },
  });
}

// ── Shelters ─────────────────────────────────────────────────────────────────
export function useShelters() {
  return useQuery({
    queryKey: ["shelters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shelters")
        .select("*")
        .order("name");
      if (error) throw new Error(supabaseErrorMessage(error));
      return (data ?? []) as Shelter[];
    },
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────
export function useRoutes(incidentId?: string) {
  return useQuery({
    queryKey: ["routes", incidentId],
    queryFn: async () => {
      let q = supabase.from("routes").select("*").order("created_at", { ascending: false });
      if (incidentId) q = q.eq("incident_id", incidentId);
      const { data, error } = await q;
      if (error) throw new Error(supabaseErrorMessage(error));
      return (data ?? []) as RouteRow[];
    },
  });
}

// ── Utility: haversine distance (km) between two lat/lng points ───────────────
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
