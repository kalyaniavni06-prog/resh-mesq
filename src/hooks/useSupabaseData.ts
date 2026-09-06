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

// ── Incidents ────────────────────────────────────────────────────────────────
export function useIncidents() {
  return useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emergency_incidents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Incident[];
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
      if (error) throw error;
      return data as Incident;
    },
    enabled: !!id,
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TablesInsert<"emergency_incidents">) => {
      const { data, error } = await supabase
        .from("emergency_incidents")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Incident;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
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
      if (error) throw error;
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
      if (error) throw error;
      return data as Vehicle[];
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
      if (error) throw error;
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
      if (error) throw error;
      return data as Road[];
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
      if (error) throw error;
      return data as Alert[];
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
      if (error) throw error;
      return data as Hospital[];
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
      if (error) throw error;
      return data as Shelter[];
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
      if (error) throw error;
      return data as RouteRow[];
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
