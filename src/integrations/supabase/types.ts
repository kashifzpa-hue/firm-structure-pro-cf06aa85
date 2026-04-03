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
      alert_rules: {
        Row: {
          additional_emails: string[] | null
          created_at: string
          id: string
          is_active: boolean
          notify_email: boolean
          notify_in_app: boolean
          rule_type: Database["public"]["Enums"]["notification_type"]
          sender_email: string | null
          threshold_days: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          additional_emails?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          notify_email?: boolean
          notify_in_app?: boolean
          rule_type: Database["public"]["Enums"]["notification_type"]
          sender_email?: string | null
          threshold_days?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          additional_emails?: string[] | null
          created_at?: string
          id?: string
          is_active?: boolean
          notify_email?: boolean
          notify_in_app?: boolean
          rule_type?: Database["public"]["Enums"]["notification_type"]
          sender_email?: string | null
          threshold_days?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
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
      bank_account_documents: {
        Row: {
          bank_account_id: string
          description: string | null
          document_type: string
          file_url: string | null
          id: string
          notes: string | null
          uploaded_at: string
          workspace_id: string
        }
        Insert: {
          bank_account_id: string
          description?: string | null
          document_type: string
          file_url?: string | null
          id?: string
          notes?: string | null
          uploaded_at?: string
          workspace_id: string
        }
        Update: {
          bank_account_id?: string
          description?: string | null
          document_type?: string
          file_url?: string | null
          id?: string
          notes?: string | null
          uploaded_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_account_documents_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_account_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string
          account_status: Database["public"]["Enums"]["bank_account_status"]
          account_type: Database["public"]["Enums"]["bank_account_type"]
          bank_name: string
          bank_name_custom: string | null
          branch_code: string | null
          branch_name: string | null
          closing_date: string | null
          company_entity_id: string
          created_at: string
          currency: string
          iban: string | null
          id: string
          notes: string | null
          opening_date: string | null
          relationship_manager: string | null
          rm_email: string | null
          rm_phone: string | null
          swift_code: string | null
          workspace_id: string
        }
        Insert: {
          account_number: string
          account_status?: Database["public"]["Enums"]["bank_account_status"]
          account_type?: Database["public"]["Enums"]["bank_account_type"]
          bank_name: string
          bank_name_custom?: string | null
          branch_code?: string | null
          branch_name?: string | null
          closing_date?: string | null
          company_entity_id: string
          created_at?: string
          currency?: string
          iban?: string | null
          id?: string
          notes?: string | null
          opening_date?: string | null
          relationship_manager?: string | null
          rm_email?: string | null
          rm_phone?: string | null
          swift_code?: string | null
          workspace_id: string
        }
        Update: {
          account_number?: string
          account_status?: Database["public"]["Enums"]["bank_account_status"]
          account_type?: Database["public"]["Enums"]["bank_account_type"]
          bank_name?: string
          bank_name_custom?: string | null
          branch_code?: string | null
          branch_name?: string | null
          closing_date?: string | null
          company_entity_id?: string
          created_at?: string
          currency?: string
          iban?: string | null
          id?: string
          notes?: string | null
          opening_date?: string | null
          relationship_manager?: string | null
          rm_email?: string | null
          rm_phone?: string | null
          swift_code?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_company_entity_id_fkey"
            columns: ["company_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      banking_activity_log: {
        Row: {
          action_type: string
          bank_account_id: string
          created_at: string
          details: string
          done_by: string | null
          id: string
          workspace_id: string
        }
        Insert: {
          action_type: string
          bank_account_id: string
          created_at?: string
          details: string
          done_by?: string | null
          id?: string
          workspace_id: string
        }
        Update: {
          action_type?: string
          bank_account_id?: string
          created_at?: string
          details?: string
          done_by?: string | null
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "banking_activity_log_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banking_activity_log_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banking_activity_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          document_id: string
          expiry_date: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          notes: string | null
          uploaded_at: string
          uploaded_by: string | null
          version_number: number
          workspace_id: string
        }
        Insert: {
          document_id: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          version_number?: number
          workspace_id: string
        }
        Update: {
          document_id?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          notes?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          auto_suggest_expiry: boolean
          country_of_issue: string | null
          created_at: string
          document_number: string | null
          document_type: string
          entity_id: string
          expiry_date: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          renewal_frequency:
            | Database["public"]["Enums"]["document_renewal_frequency"]
            | null
          renewal_months: number | null
          workspace_id: string
        }
        Insert: {
          auto_suggest_expiry?: boolean
          country_of_issue?: string | null
          created_at?: string
          document_number?: string | null
          document_type: string
          entity_id: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          renewal_frequency?:
            | Database["public"]["Enums"]["document_renewal_frequency"]
            | null
          renewal_months?: number | null
          workspace_id: string
        }
        Update: {
          auto_suggest_expiry?: boolean
          country_of_issue?: string | null
          created_at?: string
          document_number?: string | null
          document_type?: string
          entity_id?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          renewal_frequency?:
            | Database["public"]["Enums"]["document_renewal_frequency"]
            | null
          renewal_months?: number | null
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
          deactivated_at: string | null
          deactivated_by: string | null
          deactivation_reason: string | null
          email: string | null
          entity_status: Database["public"]["Enums"]["entity_status"]
          id: string
          languages_spoken: string[] | null
          linkedin_url: string | null
          name: string
          nationality_or_jurisdiction: string | null
          notes: string | null
          phone: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          professional_bio: string | null
          profile_photo_thumb: string | null
          profile_photo_url: string | null
          qualifications: string | null
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
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          email?: string | null
          entity_status?: Database["public"]["Enums"]["entity_status"]
          id?: string
          languages_spoken?: string[] | null
          linkedin_url?: string | null
          name: string
          nationality_or_jurisdiction?: string | null
          notes?: string | null
          phone?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          professional_bio?: string | null
          profile_photo_thumb?: string | null
          profile_photo_url?: string | null
          qualifications?: string | null
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
          deactivated_at?: string | null
          deactivated_by?: string | null
          deactivation_reason?: string | null
          email?: string | null
          entity_status?: Database["public"]["Enums"]["entity_status"]
          id?: string
          languages_spoken?: string[] | null
          linkedin_url?: string | null
          name?: string
          nationality_or_jurisdiction?: string | null
          notes?: string | null
          phone?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          professional_bio?: string | null
          profile_photo_thumb?: string | null
          profile_photo_url?: string | null
          qualifications?: string | null
          registered_address?: string | null
          registration_number?: string | null
          type?: Database["public"]["Enums"]["entity_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_deactivated_by_fkey"
            columns: ["deactivated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_field_history: {
        Row: {
          change_reason: string | null
          changed_at: string
          changed_by: string | null
          entity_id: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          workspace_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          entity_id: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          workspace_id: string
        }
        Update: {
          change_reason?: string | null
          changed_at?: string
          changed_by?: string | null
          entity_id?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_field_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_field_history_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_field_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      equity_links: {
        Row: {
          circular_ownership_doc_url: string | null
          circular_ownership_notes: string | null
          circular_ownership_type:
            | Database["public"]["Enums"]["circular_ownership_exception_type"]
            | null
          created_at: string
          disposal_deadline: string | null
          disposal_jurisdiction: string | null
          disposal_required: boolean
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
          circular_ownership_doc_url?: string | null
          circular_ownership_notes?: string | null
          circular_ownership_type?:
            | Database["public"]["Enums"]["circular_ownership_exception_type"]
            | null
          created_at?: string
          disposal_deadline?: string | null
          disposal_jurisdiction?: string | null
          disposal_required?: boolean
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
          circular_ownership_doc_url?: string | null
          circular_ownership_notes?: string | null
          circular_ownership_type?:
            | Database["public"]["Enums"]["circular_ownership_exception_type"]
            | null
          created_at?: string
          disposal_deadline?: string | null
          disposal_jurisdiction?: string | null
          disposal_required?: boolean
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
      movement_documents: {
        Row: {
          document_type: Database["public"]["Enums"]["movement_document_type"]
          file_url: string
          id: string
          movement_id: string
          notes: string | null
          uploaded_at: string
          workspace_id: string
        }
        Insert: {
          document_type?: Database["public"]["Enums"]["movement_document_type"]
          file_url: string
          id?: string
          movement_id: string
          notes?: string | null
          uploaded_at?: string
          workspace_id: string
        }
        Update: {
          document_type?: Database["public"]["Enums"]["movement_document_type"]
          file_url?: string
          id?: string
          movement_id?: string
          notes?: string | null
          uploaded_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movement_documents_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      movements: {
        Row: {
          company_entity_id: string
          confirmed_at: string | null
          created_at: string
          created_by: string
          currency: string | null
          from_entity_id: string | null
          id: string
          movement_date: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          price_per_share: number | null
          reference_number: string | null
          share_class_id: string
          shares_transferred: number
          status: Database["public"]["Enums"]["movement_status"]
          to_entity_id: string | null
          total_consideration: number | null
          void_reason: string | null
          voided_at: string | null
          workspace_id: string
        }
        Insert: {
          company_entity_id: string
          confirmed_at?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          from_entity_id?: string | null
          id?: string
          movement_date: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          price_per_share?: number | null
          reference_number?: string | null
          share_class_id: string
          shares_transferred: number
          status?: Database["public"]["Enums"]["movement_status"]
          to_entity_id?: string | null
          total_consideration?: number | null
          void_reason?: string | null
          voided_at?: string | null
          workspace_id: string
        }
        Update: {
          company_entity_id?: string
          confirmed_at?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          from_entity_id?: string | null
          id?: string
          movement_date?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          price_per_share?: number | null
          reference_number?: string | null
          share_class_id?: string
          shares_transferred?: number
          status?: Database["public"]["Enums"]["movement_status"]
          to_entity_id?: string | null
          total_consideration?: number | null
          void_reason?: string | null
          voided_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movements_company_entity_id_fkey"
            columns: ["company_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_from_entity_id_fkey"
            columns: ["from_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_share_class_id_fkey"
            columns: ["share_class_id"]
            isOneToOne: false
            referencedRelation: "share_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_to_entity_id_fkey"
            columns: ["to_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movements_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          created_at: string
          document_id: string | null
          entity_id: string | null
          id: string
          is_read: boolean
          movement_id: string | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          read_at: string | null
          recipient_user_id: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          action_url?: string | null
          body: string
          created_at?: string
          document_id?: string | null
          entity_id?: string | null
          id?: string
          is_read?: boolean
          movement_id?: string | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          read_at?: string | null
          recipient_user_id?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          action_url?: string | null
          body?: string
          created_at?: string
          document_id?: string | null
          entity_id?: string | null
          id?: string
          is_read?: boolean
          movement_id?: string | null
          notification_type?: Database["public"]["Enums"]["notification_type"]
          read_at?: string | null
          recipient_user_id?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      previous_positions: {
        Row: {
          company_name: string
          created_at: string
          display_order: number
          entity_id: string
          from_date: string | null
          id: string
          is_current: boolean
          notes: string | null
          role_title: string
          to_date: string | null
          workspace_id: string
        }
        Insert: {
          company_name: string
          created_at?: string
          display_order?: number
          entity_id: string
          from_date?: string | null
          id?: string
          is_current?: boolean
          notes?: string | null
          role_title: string
          to_date?: string | null
          workspace_id: string
        }
        Update: {
          company_name?: string
          created_at?: string
          display_order?: number
          entity_id?: string
          from_date?: string | null
          id?: string
          is_current?: boolean
          notes?: string | null
          role_title?: string
          to_date?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "previous_positions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "previous_positions_workspace_id_fkey"
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
      signatories: {
        Row: {
          authorised_for: string[]
          bank_account_id: string
          bank_acknowledged_date: string | null
          board_resolution_doc: string | null
          board_resolution_ref: string | null
          created_at: string
          designation: string
          effective_date: string
          expiry_date: string | null
          id: string
          individual_limit: number | null
          individual_limit_currency: string | null
          notes: string | null
          person_entity_id: string
          revocation_date: string | null
          revocation_reason: string | null
          signatory_group_id: string | null
          signature_image_url: string | null
          signature_original_url: string | null
          status: Database["public"]["Enums"]["signatory_status"]
          title: string | null
          workspace_id: string
        }
        Insert: {
          authorised_for?: string[]
          bank_account_id: string
          bank_acknowledged_date?: string | null
          board_resolution_doc?: string | null
          board_resolution_ref?: string | null
          created_at?: string
          designation: string
          effective_date?: string
          expiry_date?: string | null
          id?: string
          individual_limit?: number | null
          individual_limit_currency?: string | null
          notes?: string | null
          person_entity_id: string
          revocation_date?: string | null
          revocation_reason?: string | null
          signatory_group_id?: string | null
          signature_image_url?: string | null
          signature_original_url?: string | null
          status?: Database["public"]["Enums"]["signatory_status"]
          title?: string | null
          workspace_id: string
        }
        Update: {
          authorised_for?: string[]
          bank_account_id?: string
          bank_acknowledged_date?: string | null
          board_resolution_doc?: string | null
          board_resolution_ref?: string | null
          created_at?: string
          designation?: string
          effective_date?: string
          expiry_date?: string | null
          id?: string
          individual_limit?: number | null
          individual_limit_currency?: string | null
          notes?: string | null
          person_entity_id?: string
          revocation_date?: string | null
          revocation_reason?: string | null
          signatory_group_id?: string | null
          signature_image_url?: string | null
          signature_original_url?: string | null
          status?: Database["public"]["Enums"]["signatory_status"]
          title?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signatories_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatories_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatories_signatory_group_id_fkey"
            columns: ["signatory_group_id"]
            isOneToOne: false
            referencedRelation: "signatory_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      signatory_groups: {
        Row: {
          bank_account_id: string
          created_at: string
          description: string | null
          display_order: number
          group_label: string
          id: string
          workspace_id: string
        }
        Insert: {
          bank_account_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          group_label: string
          id?: string
          workspace_id: string
        }
        Update: {
          bank_account_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          group_label?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signatory_groups_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatory_groups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      signing_matrix_rules: {
        Row: {
          applies_to: string[]
          bank_account_id: string
          created_at: string
          daily_limit: number | null
          display_order: number
          group_a_id: string | null
          group_b_id: string | null
          id: string
          limit_currency: string
          min_signatories_from_a: number
          min_signatories_from_b: number | null
          notes: string | null
          rule_name: string
          rule_type: Database["public"]["Enums"]["signing_rule_type"]
          transaction_limit: number | null
          workspace_id: string
        }
        Insert: {
          applies_to?: string[]
          bank_account_id: string
          created_at?: string
          daily_limit?: number | null
          display_order?: number
          group_a_id?: string | null
          group_b_id?: string | null
          id?: string
          limit_currency?: string
          min_signatories_from_a?: number
          min_signatories_from_b?: number | null
          notes?: string | null
          rule_name: string
          rule_type: Database["public"]["Enums"]["signing_rule_type"]
          transaction_limit?: number | null
          workspace_id: string
        }
        Update: {
          applies_to?: string[]
          bank_account_id?: string
          created_at?: string
          daily_limit?: number | null
          display_order?: number
          group_a_id?: string | null
          group_b_id?: string | null
          id?: string
          limit_currency?: string
          min_signatories_from_a?: number
          min_signatories_from_b?: number | null
          notes?: string | null
          rule_name?: string
          rule_type?: Database["public"]["Enums"]["signing_rule_type"]
          transaction_limit?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signing_matrix_rules_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signing_matrix_rules_group_a_id_fkey"
            columns: ["group_a_id"]
            isOneToOne: false
            referencedRelation: "signatory_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signing_matrix_rules_group_b_id_fkey"
            columns: ["group_b_id"]
            isOneToOne: false
            referencedRelation: "signatory_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signing_matrix_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ubo_snapshots: {
        Row: {
          calculated_at: string
          calculation_error: boolean
          circular_detected: boolean
          circular_type: Database["public"]["Enums"]["circular_type"] | null
          company_entity_id: string
          effective_economic_pct: number
          effective_voting_pct: number
          error_reason: string | null
          id: string
          is_above_threshold: boolean
          ownership_chain: Json
          person_entity_id: string | null
          snapshot_date: string | null
          snapshot_type: Database["public"]["Enums"]["ubo_snapshot_type"]
          terminal_entity_id: string | null
          unresolved_chain: boolean
          workspace_id: string
        }
        Insert: {
          calculated_at?: string
          calculation_error?: boolean
          circular_detected?: boolean
          circular_type?: Database["public"]["Enums"]["circular_type"] | null
          company_entity_id: string
          effective_economic_pct?: number
          effective_voting_pct?: number
          error_reason?: string | null
          id?: string
          is_above_threshold?: boolean
          ownership_chain?: Json
          person_entity_id?: string | null
          snapshot_date?: string | null
          snapshot_type?: Database["public"]["Enums"]["ubo_snapshot_type"]
          terminal_entity_id?: string | null
          unresolved_chain?: boolean
          workspace_id: string
        }
        Update: {
          calculated_at?: string
          calculation_error?: boolean
          circular_detected?: boolean
          circular_type?: Database["public"]["Enums"]["circular_type"] | null
          company_entity_id?: string
          effective_economic_pct?: number
          effective_voting_pct?: number
          error_reason?: string | null
          id?: string
          is_above_threshold?: boolean
          ownership_chain?: Json
          person_entity_id?: string | null
          snapshot_date?: string | null
          snapshot_type?: Database["public"]["Enums"]["ubo_snapshot_type"]
          terminal_entity_id?: string | null
          unresolved_chain?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ubo_snapshots_company_entity_id_fkey"
            columns: ["company_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ubo_snapshots_person_entity_id_fkey"
            columns: ["person_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ubo_snapshots_terminal_entity_id_fkey"
            columns: ["terminal_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ubo_snapshots_workspace_id_fkey"
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
      workspace_encryption_keys: {
        Row: {
          created_at: string
          encryption_version: number
          id: string
          key_reference: string
          rotated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          encryption_version?: number
          id?: string
          key_reference: string
          rotated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          encryption_version?: number
          id?: string
          key_reference?: string
          rotated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_encryption_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
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
          banking_enabled: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          banking_enabled?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          banking_enabled?: boolean
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
      activate_live_mode: { Args: { p_entity_id: string }; Returns: undefined }
      calculate_ubo: { Args: { p_company_entity_id: string }; Returns: Json }
      check_circular_ownership: {
        Args: { p_company_entity_id: string; p_potential_owner_id: string }
        Returns: boolean
      }
      confirm_movement: { Args: { p_movement_id: string }; Returns: undefined }
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
      trigger_ubo_recalculate_for_company: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      vault_insert_secret: {
        Args: { _name: string; _secret: string }
        Returns: undefined
      }
      vault_read_secret: { Args: { _name: string }; Returns: string }
      void_movement: {
        Args: { p_movement_id: string; p_reason: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "viewer"
      appointment_role_category: "board" | "management"
      bank_account_status: "active" | "dormant" | "closed"
      bank_account_type:
        | "current"
        | "savings"
        | "call_deposit"
        | "trade_finance"
      captable_status: "setup" | "live"
      circular_ownership_exception_type:
        | "legal_representative"
        | "trustee"
        | "pre_existing"
        | "other"
      circular_type: "illegal" | "legal_exception"
      document_renewal_frequency:
        | "none"
        | "annual"
        | "biennial"
        | "triennial"
        | "quinquennial"
        | "decennial"
        | "custom"
      entity_status: "active" | "inactive" | "archived"
      entity_type: "person" | "company"
      movement_document_type:
        | "Share Transfer Deed"
        | "Share Purchase Agreement"
        | "Board Resolution"
        | "Shareholder Resolution"
        | "Share Certificate"
        | "Court Order"
        | "Gift Deed"
        | "Inheritance Certificate"
        | "Other"
      movement_status: "draft" | "confirmed" | "voided"
      movement_type:
        | "TRANSFER"
        | "ISSUANCE"
        | "CANCELLATION"
        | "INHERITANCE"
        | "GIFT"
        | "COURT_ORDER"
        | "CAPITAL_INCREASE"
        | "CAPITAL_DECREASE"
      notification_type:
        | "DOCUMENT_EXPIRED"
        | "DOCUMENT_EXPIRING_SOON"
        | "MOVEMENT_DRAFT_PENDING"
        | "UBO_THRESHOLD_BREACH"
        | "SHAREHOLDING_GAP"
        | "UNRESOLVED_UBO_CHAIN"
        | "LIVE_MODE_ACTIVATED"
        | "ENTITY_DEACTIVATED"
        | "SYSTEM_ALERT"
        | "SIGNATORY_EXPIRING"
        | "BANK_ACK_PENDING"
        | "CIRCULAR_DISPOSAL_DUE"
        | "CIRCULAR_DISPOSAL_OVERDUE"
      signatory_status: "active" | "suspended" | "revoked"
      signing_rule_type: "solo" | "joint_same_group" | "joint_cross_group"
      ubo_snapshot_type: "live" | "historical"
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
      bank_account_status: ["active", "dormant", "closed"],
      bank_account_type: [
        "current",
        "savings",
        "call_deposit",
        "trade_finance",
      ],
      captable_status: ["setup", "live"],
      circular_ownership_exception_type: [
        "legal_representative",
        "trustee",
        "pre_existing",
        "other",
      ],
      circular_type: ["illegal", "legal_exception"],
      document_renewal_frequency: [
        "none",
        "annual",
        "biennial",
        "triennial",
        "quinquennial",
        "decennial",
        "custom",
      ],
      entity_status: ["active", "inactive", "archived"],
      entity_type: ["person", "company"],
      movement_document_type: [
        "Share Transfer Deed",
        "Share Purchase Agreement",
        "Board Resolution",
        "Shareholder Resolution",
        "Share Certificate",
        "Court Order",
        "Gift Deed",
        "Inheritance Certificate",
        "Other",
      ],
      movement_status: ["draft", "confirmed", "voided"],
      movement_type: [
        "TRANSFER",
        "ISSUANCE",
        "CANCELLATION",
        "INHERITANCE",
        "GIFT",
        "COURT_ORDER",
        "CAPITAL_INCREASE",
        "CAPITAL_DECREASE",
      ],
      notification_type: [
        "DOCUMENT_EXPIRED",
        "DOCUMENT_EXPIRING_SOON",
        "MOVEMENT_DRAFT_PENDING",
        "UBO_THRESHOLD_BREACH",
        "SHAREHOLDING_GAP",
        "UNRESOLVED_UBO_CHAIN",
        "LIVE_MODE_ACTIVATED",
        "ENTITY_DEACTIVATED",
        "SYSTEM_ALERT",
        "SIGNATORY_EXPIRING",
        "BANK_ACK_PENDING",
        "CIRCULAR_DISPOSAL_DUE",
        "CIRCULAR_DISPOSAL_OVERDUE",
      ],
      signatory_status: ["active", "suspended", "revoked"],
      signing_rule_type: ["solo", "joint_same_group", "joint_cross_group"],
      ubo_snapshot_type: ["live", "historical"],
    },
  },
} as const
