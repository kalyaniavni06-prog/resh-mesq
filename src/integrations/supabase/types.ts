export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      disaster_alerts: {
        Row: {
          active: boolean
          area: string
          category: string
          detail: string | null
          id: string
          issued_at: string
          severity: Database["public"]["Enums"]["severity_level"]
          title: string
        }
        Insert: {
          active?: boolean
          area: string
          category: string
          detail?: string | null
          id?: string
          issued_at?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          title: string
        }
        Update: {
          active?: boolean
          area?: string
          category?: string
          detail?: string | null
          id?: string
          issued_at?: string
          severity?: Database["public"]["Enums"]["severity_level"]
          title?: string
        }
        Relationships: []
      }
      emergency_incidents: {
        Row: {
          ai_confidence: number
          assigned_vehicle: string | null
          created_at: string
          created_by: string | null
          id: string
          incident_type: string
          lat: number
          lng: number
          location_name: string
          people_affected: number
          reference: string
          reports_fused: number
          required_service: string
          resolved_at: string | null
          road_accessible: boolean
          severity: Database["public"]["Enums"]["severity_level"]
          status: Database["public"]["Enums"]["incident_status"]
          summary: string | null
        }
        Insert: {
          ai_confidence?: number
          assigned_vehicle?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          incident_type: string
          lat: number
          lng: number
          location_name: string
          people_affected?: number
          reference?: string
          reports_fused?: number
          required_service?: string
          resolved_at?: string | null
          road_accessible?: boolean
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["incident_status"]
          summary?: string | null
        }
        Update: {
          ai_confidence?: number
          assigned_vehicle?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          incident_type?: string
          lat?: number
          lng?: number
          location_name?: string
          people_affected?: number
          reference?: string
          reports_fused?: number
          required_service?: string
          resolved_at?: string | null
          road_accessible?: boolean
          severity?: Database["public"]["Enums"]["severity_level"]
          status?: Database["public"]["Enums"]["incident_status"]
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_incidents_assigned_vehicle_fkey"
            columns: ["assigned_vehicle"]
            isOneToOne: false
            referencedRelation: "emergency_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_vehicles: {
        Row: {
          code: string
          crew: number
          destination: string | null
          eta_minutes: number | null
          home_base: string | null
          id: string
          kind: string
          lat: number
          lng: number
          status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
        }
        Insert: {
          code: string
          crew?: number
          destination?: string | null
          eta_minutes?: number | null
          home_base?: string | null
          id?: string
          kind: string
          lat: number
          lng: number
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          crew?: number
          destination?: string | null
          eta_minutes?: number | null
          home_base?: string | null
          id?: string
          kind?: string
          lat?: number
          lng?: number
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
        }
        Relationships: []
      }
      hospitals: {
        Row: {
          beds_available: number
          contact_label: string
          created_at: string
          district: string
          id: string
          is_operational: boolean
          lat: number
          lng: number
          name: string
          trauma_center: boolean
        }
        Insert: {
          beds_available?: number
          contact_label?: string
          created_at?: string
          district: string
          id?: string
          is_operational?: boolean
          lat: number
          lng: number
          name: string
          trauma_center?: boolean
        }
        Update: {
          beds_available?: number
          contact_label?: string
          created_at?: string
          district?: string
          id?: string
          is_operational?: boolean
          lat?: number
          lng?: number
          name?: string
          trauma_center?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          agency?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
        }
        Update: {
          agency?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      road_conditions: {
        Row: {
          base_minutes: number
          distance_km: number
          from_node: string
          id: string
          note: string | null
          risk: Database["public"]["Enums"]["severity_level"]
          road_name: string
          state: Database["public"]["Enums"]["road_state"]
          to_node: string
          updated_at: string
        }
        Insert: {
          base_minutes: number
          distance_km: number
          from_node: string
          id?: string
          note?: string | null
          risk?: Database["public"]["Enums"]["severity_level"]
          road_name: string
          state?: Database["public"]["Enums"]["road_state"]
          to_node: string
          updated_at?: string
        }
        Update: {
          base_minutes?: number
          distance_km?: number
          from_node?: string
          id?: string
          note?: string | null
          risk?: Database["public"]["Enums"]["severity_level"]
          road_name?: string
          state?: Database["public"]["Enums"]["road_state"]
          to_node?: string
          updated_at?: string
        }
        Relationships: []
      }
      routes: {
        Row: {
          created_at: string
          destination: string
          distance_km: number
          eta_minutes: number
          id: string
          incident_id: string | null
          label: string
          origin: string
          path: string[]
          reason: string | null
          recommended: boolean
          risk: Database["public"]["Enums"]["severity_level"]
        }
        Insert: {
          created_at?: string
          destination: string
          distance_km?: number
          eta_minutes?: number
          id?: string
          incident_id?: string | null
          label: string
          origin: string
          path?: string[]
          reason?: string | null
          recommended?: boolean
          risk?: Database["public"]["Enums"]["severity_level"]
        }
        Update: {
          created_at?: string
          destination?: string
          distance_km?: number
          eta_minutes?: number
          id?: string
          incident_id?: string | null
          label?: string
          origin?: string
          path?: string[]
          reason?: string | null
          recommended?: boolean
          risk?: Database["public"]["Enums"]["severity_level"]
        }
        Relationships: [
          {
            foreignKeyName: "routes_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "emergency_incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      shelters: {
        Row: {
          capacity: number
          created_at: string
          district: string
          id: string
          kind: string
          lat: number
          lng: number
          name: string
          occupancy: number
        }
        Insert: {
          capacity?: number
          created_at?: string
          district: string
          id?: string
          kind?: string
          lat: number
          lng: number
          name: string
          occupancy?: number
        }
        Update: {
          capacity?: number
          created_at?: string
          district?: string
          id?: string
          kind?: string
          lat?: number
          lng?: number
          name?: string
          occupancy?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "dispatcher" | "responder"
      incident_status: "new" | "assigned" | "in_progress" | "resolved"
      road_state:
        | "open"
        | "flooded"
        | "landslide"
        | "bridge_damaged"
        | "blocked"
        | "high_risk"
      severity_level: "critical" | "high" | "moderate" | "safe"
      vehicle_status:
        | "available"
        | "en_route"
        | "on_scene"
        | "returning"
        | "offline"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "dispatcher", "responder"],
      incident_status: ["new", "assigned", "in_progress", "resolved"],
      road_state: [
        "open",
        "flooded",
        "landslide",
        "bridge_damaged",
        "blocked",
        "high_risk",
      ],
      severity_level: ["critical", "high", "moderate", "safe"],
      vehicle_status: [
        "available",
        "en_route",
        "on_scene",
        "returning",
        "offline",
      ],
    },
  },
} as const
