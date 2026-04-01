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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          company_entity_id: string
          created_at: string
          id: string
          notes: string | null
          person_entity_id: string
          resignation_date: string | null
          role_category: Database["public"]["Enums"]["appointment_role_category"]
          role_title: string
          workspace_id: string
        }
        Insert: {
          appointment_date?: string
          company_entity_id: string
          created_at?: string
          id?: string
          notes?: string | null
          person_entity_id: string
          resignation_date?: string | null
          role_category: Database["public"]["Enums"]["appointment_role_category"]
          role_title: string
          workspace_id: string
        }
        Update: {
          appointment_date?: string
          company_entity_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          person_entity_id?: string
          resignation_date?: string | null
          role_category?: Database["public"]["Enums"]["appointment_role_category"]
          role_title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_company_entity_id_fkey"
            columns: ["company_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          country_of_issue: string | null
          created_at: string
          document_number: string | null
          document_type: string
          entity_id: string
          expiry_date: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          workspace_id: string
        }
        Insert: {
          country_of_issue?: string | null
          created_at?: string
          document_number?: string | null
          document_type: string
          entity_id: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          workspace_id: string
        }
        Update: {
          country_of_issue?: string | null
          created_at?: string
          document_number?: string | null
          document_type?: string
          entity_id?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          captable_status: Database["public"]["Enums"]["captable_status"]
          company_type: string | null
          created_at: string
          date_of_birth_or_incorporation: string | null
          email: string | null
          id: string
          name: string
          nationality_or_jurisdiction: string | null
          notes: string | null
          phone: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          registered_address: string | null
          registration_number: string | null
          type: Database["public"]["Enums"]["entity_type"]
          workspace_id: string
        }
        Insert: {
          captable_status?: Database["public"]["Enums"]["captable_status"]
          company_type?: string | null
          created_at?: string
          date_of_birth_or_incorporation?: string | null
          email?: string | null
          id?: string
          name: string
          nationality_or_jurisdiction?: string | null
          notes?: string | null
          phone?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          registered_address?: string | null
          registration_number?: string | null
          type: Database["public"]["Enums"]["entity_type"]
          workspace_id: string
        }
        Update: {
          captable_status?: Database["public"]["Enums"]["captable_status"]
          company_type?: string | null
          created_at?: string
          date_of_birth_or_incorporation?: string | null
          email?: string | null
          id?: string
          name?: string
          nationality_or_jurisdiction?: string | null
          notes?: string | null
          phone?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          registered_address?: string | null
          registration_number?: string | null
          type?: Database["public"]["Enums"]["entity_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      equity_links: {
        Row: {
          created_at: string
          effective_date: string
          end_date: string | null
          id: string
          notes: string | null
          owned_entity_id: string
          owner_entity_id: string
          percentage: number
          share_class_id: string | null
          share_count: number | null
          shares_owned: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          effective_date?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owned_entity_id: string
          owner_entity_id: string
          percentage: number
          share_class_id?: string | null
          share_count?: number | null
          shares_owned?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          effective_date?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          owned_entity_id?: string
          owner_entity_id?: string
          percentage?: number
          share_class_id?: string | null
          share_count?: number | null
          shares_owned?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equity_links_owned_entity_id_fkey"
            columns: ["owned_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equity_links_owner_entity_id_fkey"
            columns: ["owner_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equity_links_share_class_id_fkey"
            columns: ["share_class_id"]
            isOneToOne: false
            referencedRelation: "share_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equity_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      share_classes: {
        Row: {
          class_name: string
          company_entity_id: string
          created_at: string
          currency: string
          id: string
          notes: string | null
          par_value_per_share: number
          total_shares_issued: number
          voting_rights: boolean
          workspace_id: string
        }
        Insert: {
          class_name: string
          company_entity_id: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          par_value_per_share: number
          total_shares_issued: number
          voting_rights?: boolean
          workspace_id: string
        }
        Update: {
          class_name?: string
          company_entity_id?: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          par_value_per_share?: number
          total_shares_issued?: number
          voting_rights?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_classes_company_entity_id_fkey"
            columns: ["company_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_classes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _email: string }; Returns: string }
      create_workspace: { Args: { _name: string }; Returns: string }
      get_user_workspace_id: { Args: never; Returns: string }
      has_workspace_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "viewer"
      appointment_role_category: "board" | "management"
      captable_status: "setup" | "live"
      entity_type: "person" | "company"
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
      app_role: ["admin", "viewer"],
      appointment_role_category: ["board", "management"],
      captable_status: ["setup", "live"],
      entity_type: ["person", "company"],
    },
  },
} as const
