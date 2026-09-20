/**
 * Scenario incidents — Bihar / Nepal flood disaster response demonstration data.
 *
 * These are FICTIONAL records created for presentation and testing purposes only.
 * They do NOT represent real events, real casualties, official government reports,
 * or verified emergency information.
 *
 * Used only when Demo / Scenario Mode is active (see src/lib/demo-mode.tsx).
 * In Normal Mode the app shows only real user-submitted incidents.
 */

import type { Database } from "@/integrations/supabase/types";

type Incident = Database["public"]["Tables"]["emergency_incidents"]["Row"];
type Severity = Database["public"]["Enums"]["severity_level"];
type IncidentStatus = Database["public"]["Enums"]["incident_status"];

// ── Scenario incident shape ───────────────────────────────────────────────────
// We extend the DB type with a scenario-specific ID prefix and a richer
// description field that is stored in the `summary` column.

export const SCENARIO_INCIDENTS: Incident[] = [
  {
    id: "sc-00000001-0000-0000-0000-000000000001",
    reference: "INC-SC-001",
    incident_type: "flood_rescue",
    location_name: "Darbhanga Low-lying Residential Area, Bihar",
    lat: 26.1542,
    lng: 85.8918,
    severity: "critical" as Severity,
    people_affected: 120,
    road_accessible: false,
    required_service: "rescue_team",
    status: "in_progress" as IncidentStatus,
    ai_confidence: 90,
    reports_fused: 3,
    summary:
      "Residential colony flooded after Bagmati river embankment breach. Approximately 120 residents stranded on rooftops. Road access cut off — boat rescue in progress. [Scenario data — not a real event]",
    assigned_vehicle: null,
    created_by: null,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 h ago
    resolved_at: null,
  },
  {
    id: "sc-00000001-0000-0000-0000-000000000002",
    reference: "INC-SC-002",
    incident_type: "road_accident",
    location_name: "NH-57 Near Muzaffarpur–Darbhanga Junction, Bihar",
    lat: 26.3645,
    lng: 85.4237,
    severity: "high" as Severity,
    people_affected: 18,
    road_accessible: true,
    required_service: "ambulance",
    status: "assigned" as IncidentStatus,
    ai_confidence: 85,
    reports_fused: 2,
    summary:
      "National Highway 57 submerged under 1.2 m floodwater near Muzaffarpur junction. Multiple vehicles stranded. Ambulance unit dispatched — access via elevated service road. [Scenario data — not a real event]",
    assigned_vehicle: null,
    created_by: null,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 h ago
    resolved_at: null,
  },
  {
    id: "sc-00000001-0000-0000-0000-000000000003",
    reference: "INC-SC-003",
    incident_type: "evacuation",
    location_name: "Balkhu Riverside Settlement, Kathmandu Valley",
    lat: 27.6812,
    lng: 85.2991,
    severity: "critical" as Severity,
    people_affected: 65,
    road_accessible: false,
    required_service: "rescue_team",
    status: "new" as IncidentStatus,
    ai_confidence: 78,
    reports_fused: 1,
    summary:
      "65 residents stranded in low-lying area after Bagmati river overflow. Water level rising. Evacuation route blocked by debris — verification in progress to confirm accessible corridor. [Scenario data — not a real event]",
    assigned_vehicle: null,
    created_by: null,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 min ago
    resolved_at: null,
  },
  {
    id: "sc-00000001-0000-0000-0000-000000000004",
    reference: "INC-SC-004",
    incident_type: "landslide",
    location_name: "Prithvi Highway Malekhu Segment, Dhading",
    lat: 27.8644,
    lng: 84.9102,
    severity: "high" as Severity,
    people_affected: 8,
    road_accessible: false,
    required_service: "rescue_team",
    status: "in_progress" as IncidentStatus,
    ai_confidence: 92,
    reports_fused: 4,
    summary:
      "Major landslide blocking Prithvi Highway at Malekhu. Emergency route to Chitwan cut off. 8 people reported trapped in vehicles. Debris-clearance crew on site — alternate bypass via Kanti Rajpath active. [Scenario data — not a real event]",
    assigned_vehicle: null,
    created_by: null,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 h ago
    resolved_at: null,
  },
  {
    id: "sc-00000001-0000-0000-0000-000000000005",
    reference: "INC-SC-005",
    incident_type: "bridge_failure",
    location_name: "Bagmati Bridge – Balkhu Crossing, Kathmandu",
    lat: 27.6784,
    lng: 85.2943,
    severity: "high" as Severity,
    people_affected: 0,
    road_accessible: false,
    required_service: "rescue_team",
    status: "assigned" as IncidentStatus,
    ai_confidence: 95,
    reports_fused: 5,
    summary:
      "Structural deck cracking detected after flood surge. Bridge closed to all traffic — diverts evacuation convoys to Sanga Bypass. Engineering assessment team dispatched. No casualties reported. [Scenario data — not a real event]",
    assigned_vehicle: null,
    created_by: null,
    created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), // 10 h ago
    resolved_at: null,
  },
  {
    id: "sc-00000001-0000-0000-0000-000000000006",
    reference: "INC-SC-006",
    incident_type: "flood_rescue",
    location_name: "Tundikhel Relief Camp Access Road, Kathmandu",
    lat: 27.7031,
    lng: 85.3157,
    severity: "moderate" as Severity,
    people_affected: 340,
    road_accessible: true,
    required_service: "all",
    status: "new" as IncidentStatus,
    ai_confidence: 72,
    reports_fused: 2,
    summary:
      "Primary access road to Tundikhel evacuation shelter partially submerged. Shelter is operational — alternate entry via Ratna Park road confirmed passable. 340 displaced persons awaiting entry. [Scenario data — not a real event]",
    assigned_vehicle: null,
    created_by: null,
    created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // 90 min ago
    resolved_at: null,
  },
];

/** IDs of the scenario incidents — used to distinguish them from real DB records. */
export const SCENARIO_IDS = new Set(SCENARIO_INCIDENTS.map((i) => i.id));

/** Whether an incident row originated from the scenario dataset. */
export function isScenarioIncident(id: string): boolean {
  return SCENARIO_IDS.has(id);
}
