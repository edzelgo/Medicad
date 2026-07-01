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
      activities: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          type?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          body: string | null
          created_at: string
          id: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      email_notifications_log: {
        Row: {
          context: string | null
          id: string
          kind: string
          sent_at: string
          user_id: string
        }
        Insert: {
          context?: string | null
          id?: string
          kind: string
          sent_at?: string
          user_id: string
        }
        Update: {
          context?: string | null
          id?: string
          kind?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      intake_cases: {
        Row: {
          agent: string | null
          case_id: string
          created_at: string
          date_received: string | null
          first_name: string | null
          follow_count: number
          follow_up_date: string | null
          id: string
          last_name: string | null
          marketer: string | null
          notes_count: number
          phone: string | null
          ref_source: string | null
          status: string | null
          status_date: string | null
          track_count: number
          updated_at: string
          workflow: string | null
        }
        Insert: {
          agent?: string | null
          case_id: string
          created_at?: string
          date_received?: string | null
          first_name?: string | null
          follow_count?: number
          follow_up_date?: string | null
          id?: string
          last_name?: string | null
          marketer?: string | null
          notes_count?: number
          phone?: string | null
          ref_source?: string | null
          status?: string | null
          status_date?: string | null
          track_count?: number
          updated_at?: string
          workflow?: string | null
        }
        Update: {
          agent?: string | null
          case_id?: string
          created_at?: string
          date_received?: string | null
          first_name?: string | null
          follow_count?: number
          follow_up_date?: string | null
          id?: string
          last_name?: string | null
          marketer?: string | null
          notes_count?: number
          phone?: string | null
          ref_source?: string | null
          status?: string | null
          status_date?: string | null
          track_count?: number
          updated_at?: string
          workflow?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          address: string | null
          assigned_to: string | null
          brochure_provided: string[] | null
          created_at: string
          created_by: string | null
          date_first_coverage: string | null
          dob: string | null
          email: string | null
          estimated_spend_down_remaining: number | null
          first_name: string | null
          full_name: string | null
          has_lri: boolean
          household_size: number | null
          id: string
          inquiry_type: string | null
          last_name: string | null
          lri_email: string | null
          lri_first_name: string | null
          lri_last_name: string | null
          lri_phone: string | null
          lri_status: string | null
          marital_status: string | null
          message: string | null
          middle_initial: string | null
          monthly_income: number | null
          notes: string | null
          phone: string | null
          referral_status: string | null
          retroactive_required: boolean | null
          sms_consent: boolean
          source: string | null
          spend_down_completed: boolean | null
          spouse_dob: string | null
          spouse_first_name: string | null
          spouse_last_name: string | null
          spouse_ssn: string | null
          ssn: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          state: string | null
          transfer_amount: number | null
          transferred_resources_60mo: boolean | null
          updated_at: string
          veteran_status: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          brochure_provided?: string[] | null
          created_at?: string
          created_by?: string | null
          date_first_coverage?: string | null
          dob?: string | null
          email?: string | null
          estimated_spend_down_remaining?: number | null
          first_name?: string | null
          full_name?: string | null
          has_lri?: boolean
          household_size?: number | null
          id?: string
          inquiry_type?: string | null
          last_name?: string | null
          lri_email?: string | null
          lri_first_name?: string | null
          lri_last_name?: string | null
          lri_phone?: string | null
          lri_status?: string | null
          marital_status?: string | null
          message?: string | null
          middle_initial?: string | null
          monthly_income?: number | null
          notes?: string | null
          phone?: string | null
          referral_status?: string | null
          retroactive_required?: boolean | null
          sms_consent?: boolean
          source?: string | null
          spend_down_completed?: boolean | null
          spouse_dob?: string | null
          spouse_first_name?: string | null
          spouse_last_name?: string | null
          spouse_ssn?: string | null
          ssn?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          state?: string | null
          transfer_amount?: number | null
          transferred_resources_60mo?: boolean | null
          updated_at?: string
          veteran_status?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          brochure_provided?: string[] | null
          created_at?: string
          created_by?: string | null
          date_first_coverage?: string | null
          dob?: string | null
          email?: string | null
          estimated_spend_down_remaining?: number | null
          first_name?: string | null
          full_name?: string | null
          has_lri?: boolean
          household_size?: number | null
          id?: string
          inquiry_type?: string | null
          last_name?: string | null
          lri_email?: string | null
          lri_first_name?: string | null
          lri_last_name?: string | null
          lri_phone?: string | null
          lri_status?: string | null
          marital_status?: string | null
          message?: string | null
          middle_initial?: string | null
          monthly_income?: number | null
          notes?: string | null
          phone?: string | null
          referral_status?: string | null
          retroactive_required?: boolean | null
          sms_consent?: boolean
          source?: string | null
          spend_down_completed?: boolean | null
          spouse_dob?: string | null
          spouse_first_name?: string | null
          spouse_last_name?: string | null
          spouse_ssn?: string | null
          ssn?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          state?: string | null
          transfer_amount?: number | null
          transferred_resources_60mo?: boolean | null
          updated_at?: string
          veteran_status?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          application_status: Database["public"]["Enums"]["application_status"]
          application_status_updated_at: string
          assigned_agent_id: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          application_status?: Database["public"]["Enums"]["application_status"]
          application_status_updated_at?: string
          assigned_agent_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          application_status?: Database["public"]["Enums"]["application_status"]
          application_status_updated_at?: string
          assigned_agent_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          sort_order: number
          status: string
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          status?: string
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["portal_role"]
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["portal_role"]
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["portal_role"]
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["portal_role"]
          _status?: string
          _user_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["portal_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      application_status:
        | "new_lead"
        | "documents_pending"
        | "under_review"
        | "submitted_to_medicaid"
        | "approved"
        | "denied"
      lead_stage:
        | "new"
        | "intake"
        | "screening"
        | "application"
        | "submitted"
        | "approved"
        | "denied"
        | "closed"
      portal_role: "agent" | "referral" | "client" | "admin"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      application_status: [
        "new_lead",
        "documents_pending",
        "under_review",
        "submitted_to_medicaid",
        "approved",
        "denied",
      ],
      lead_stage: [
        "new",
        "intake",
        "screening",
        "application",
        "submitted",
        "approved",
        "denied",
        "closed",
      ],
      portal_role: ["agent", "referral", "client", "admin"],
    },
  },
} as const
