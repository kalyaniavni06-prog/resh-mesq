import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Incident = Tables["emergency_incidents"]["Row"];
export type Vehicle = Tables["emergency_vehicles"]["Row"];
export type Road = Tables["road_conditions"]["Row"];
export type Alert = Tables["disaster_alerts"]["Row"];
export type Hospital = Tables["hospitals"]["Row"];
export type Shelter = Tables["shelters"]["Row"];
export type CameraFeed = Tables["camera_feeds"]["Row"];
export type FamilyContact = Tables["family_contacts"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const incidentsQuery = queryOptions({
  queryKey: ["incidents"],
  queryFn: () =>
    unwrap<Incident[]>(
      supabase.from("emergency_incidents").select("*").order("created_at", { ascending: false }),
    ),
  staleTime: 15_000,
});

export const vehiclesQuery = queryOptions({
  queryKey: ["vehicles"],
  queryFn: () => unwrap<Vehicle[]>(supabase.from("emergency_vehicles").select("*").order("code")),
  staleTime: 15_000,
});

export const roadsQuery = queryOptions({
  queryKey: ["roads"],
  queryFn: () => unwrap<Road[]>(supabase.from("road_conditions").select("*").order("road_name")),
  staleTime: 30_000,
});

export const alertsQuery = queryOptions({
  queryKey: ["alerts"],
  queryFn: () =>
    unwrap<Alert[]>(
      supabase.from("disaster_alerts").select("*").order("issued_at", { ascending: false }),
    ),
  staleTime: 30_000,
});

export const hospitalsQuery = queryOptions({
  queryKey: ["hospitals"],
  queryFn: () => unwrap<Hospital[]>(supabase.from("hospitals").select("*").order("name")),
  staleTime: 60_000,
});

export const sheltersQuery = queryOptions({
  queryKey: ["shelters"],
  queryFn: () => unwrap<Shelter[]>(supabase.from("shelters").select("*").order("name")),
  staleTime: 60_000,
});

export const camerasQuery = queryOptions({
  queryKey: ["cameras"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("camera_feeds")
      .select("*")
      .order("label");
    // Table may not exist in all deployments — return empty array gracefully
    if (error) return [] as CameraFeed[];
    return (data ?? []) as CameraFeed[];
  },
  staleTime: 60_000,
});

export function familyContactsQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ["family-contacts", userId ?? "anon"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_contacts")
        .select("*")
        .order("created_at", { ascending: true });
      // Table may not exist in all deployments — return empty array gracefully
      if (error) return [] as FamilyContact[];
      return (data ?? []) as FamilyContact[];
    },
    enabled: Boolean(userId),
  });
}

export function rolesQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ["roles", userId ?? "anon"],
    queryFn: async () => {
      const rows = await unwrap<{ role: AppRole }[]>(supabase.from("user_roles").select("role"));
      return rows.map((r) => r.role);
    },
    enabled: Boolean(userId),
  });
}
