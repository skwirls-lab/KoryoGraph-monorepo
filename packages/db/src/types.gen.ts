export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          scopes: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          prefix: string
          revoked_at?: string | null
          scopes?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          scopes?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      attendance: {
        Row: {
          checked_in_at: string
          checked_in_by_user_id: string | null
          created_at: string
          id: string
          note: string | null
          person_id: string
          session_id: string
          source: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          checked_in_at?: string
          checked_in_by_user_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          person_id: string
          session_id: string
          source?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          checked_in_at?: string
          checked_in_by_user_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          person_id?: string
          session_id?: string
          source?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_session_id_fkey"
            columns: ["tenant_id", "session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_session_id_fkey"
            columns: ["tenant_id", "session_id"]
            isOneToOne: false
            referencedRelation: "v_session_stats"
            referencedColumns: ["tenant_id", "session_id"]
          },
          {
            foreignKeyName: "attendance_tenant_id_session_id_fkey"
            columns: ["tenant_id", "session_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_for_person"
            referencedColumns: ["tenant_id", "session_id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_role: string | null
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          note: string | null
          request_id: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_role?: string | null
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: string | null
          note?: string | null
          request_id?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_role?: string | null
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          note?: string | null
          request_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          context: Json
          created_at: string
          dedupe_key: string
          id: string
          log: Json
          person_id: string | null
          resume_at: string | null
          status: string
          step: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          automation_id: string
          context?: Json
          created_at?: string
          dedupe_key: string
          id?: string
          log?: Json
          person_id?: string | null
          resume_at?: string | null
          status?: string
          step?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          automation_id?: string
          context?: Json
          created_at?: string
          dedupe_key?: string
          id?: string
          log?: Json
          person_id?: string | null
          resume_at?: string | null
          status?: string
          step?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_tenant_id_automation_id_fkey"
            columns: ["tenant_id", "automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: Json
          active: boolean
          conditions: Json
          created_at: string
          description: string
          id: string
          last_run_at: string | null
          name: string
          runs: number
          template_key: string | null
          tenant_id: string
          trigger: Json
          updated_at: string
        }
        Insert: {
          actions?: Json
          active?: boolean
          conditions?: Json
          created_at?: string
          description?: string
          id?: string
          last_run_at?: string | null
          name: string
          runs?: number
          template_key?: string | null
          tenant_id: string
          trigger: Json
          updated_at?: string
        }
        Update: {
          actions?: Json
          active?: boolean
          conditions?: Json
          created_at?: string
          description?: string
          id?: string
          last_run_at?: string | null
          name?: string
          runs?: number
          template_key?: string | null
          tenant_id?: string
          trigger?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      billing_runs: {
        Row: {
          amount_cents: number
          charges_attempted: number
          created_at: string
          errors: Json
          id: string
          invoices_created: number
          job_run_id: string | null
          run_date: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          charges_attempted?: number
          created_at?: string
          errors?: Json
          id?: string
          invoices_created?: number
          job_run_id?: string | null
          run_date: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          charges_attempted?: number
          created_at?: string
          errors?: Json
          id?: string
          invoices_created?: number
          job_run_id?: string | null
          run_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_runs_job_run_id_fkey"
            columns: ["job_run_id"]
            isOneToOne: false
            referencedRelation: "job_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "billing_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      bookings: {
        Row: {
          booked_by_user_id: string | null
          cancelled_at: string | null
          created_at: string
          credit_id: string | null
          id: string
          person_id: string
          session_id: string
          source: string
          status: string
          tenant_id: string
          updated_at: string
          waitlist_position: number | null
        }
        Insert: {
          booked_by_user_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          credit_id?: string | null
          id?: string
          person_id: string
          session_id: string
          source?: string
          status?: string
          tenant_id: string
          updated_at?: string
          waitlist_position?: number | null
        }
        Update: {
          booked_by_user_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          credit_id?: string | null
          id?: string
          person_id?: string
          session_id?: string
          source?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_tenant_id_credit_id_fkey"
            columns: ["tenant_id", "credit_id"]
            isOneToOne: false
            referencedRelation: "makeup_credits"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_session_id_fkey"
            columns: ["tenant_id", "session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_session_id_fkey"
            columns: ["tenant_id", "session_id"]
            isOneToOne: false
            referencedRelation: "v_session_stats"
            referencedColumns: ["tenant_id", "session_id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_session_id_fkey"
            columns: ["tenant_id", "session_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_for_person"
            referencedColumns: ["tenant_id", "session_id"]
          },
        ]
      }
      campaigns: {
        Row: {
          body: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          scheduled_at: string | null
          segment: Json
          sent_at: string | null
          stats: Json
          subject: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          scheduled_at?: string | null
          segment?: Json
          sent_at?: string | null
          stats?: Json
          subject?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          scheduled_at?: string | null
          segment?: Json
          sent_at?: string | null
          stats?: Json
          subject?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      cash_drawers: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_cents: number | null
          created_at: string
          expected_cents: number | null
          id: string
          location_id: string
          opened_at: string
          opened_by: string | null
          opening_cents: number
          tenant_id: string
          updated_at: string
          variance_cents: number | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_cents?: number | null
          created_at?: string
          expected_cents?: number | null
          id?: string
          location_id: string
          opened_at?: string
          opened_by?: string | null
          opening_cents: number
          tenant_id: string
          updated_at?: string
          variance_cents?: number | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_cents?: number | null
          created_at?: string
          expected_cents?: number | null
          id?: string
          location_id?: string
          opened_at?: string
          opened_by?: string | null
          opening_cents?: number
          tenant_id?: string
          updated_at?: string
          variance_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_drawers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_drawers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "cash_drawers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "cash_drawers_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          background_path: string | null
          body: string
          created_at: string
          id: string
          is_default: boolean
          layout: Json
          name: string
          signature_path: string | null
          signer_name: string | null
          signer_title: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          background_path?: string | null
          body?: string
          created_at?: string
          id?: string
          is_default?: boolean
          layout?: Json
          name: string
          signature_path?: string | null
          signer_name?: string | null
          signer_title?: string | null
          tenant_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          background_path?: string | null
          body?: string
          created_at?: string
          id?: string
          is_default?: boolean
          layout?: Json
          name?: string
          signature_path?: string | null
          signer_name?: string | null
          signer_title?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "certificate_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      class_packs: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          membership_id: string | null
          person_id: string
          tenant_id: string
          total: number
          updated_at: string
          used: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          membership_id?: string | null
          person_id: string
          tenant_id: string
          total: number
          updated_at?: string
          used?: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          membership_id?: string | null
          person_id?: string
          tenant_id?: string
          total?: number
          updated_at?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_packs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_packs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "class_packs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "class_packs_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "class_packs_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "class_packs_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "class_packs_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          action_board_status: string | null
          audio_path: string | null
          bookable: boolean
          cancel_reason: string | null
          cancellation_window_min: number
          capacity: number | null
          created_at: string
          detached: boolean
          ends_at: string
          id: string
          instructor_ids: string[]
          lesson_plan_id: string | null
          location_id: string
          name: string
          notes: string | null
          occurrence_date: string
          program_ids: string[]
          room: string | null
          starts_at: string
          status: string
          substitute_ids: string[]
          template_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          action_board_status?: string | null
          audio_path?: string | null
          bookable?: boolean
          cancel_reason?: string | null
          cancellation_window_min?: number
          capacity?: number | null
          created_at?: string
          detached?: boolean
          ends_at: string
          id?: string
          instructor_ids?: string[]
          lesson_plan_id?: string | null
          location_id: string
          name: string
          notes?: string | null
          occurrence_date: string
          program_ids?: string[]
          room?: string | null
          starts_at: string
          status?: string
          substitute_ids?: string[]
          template_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          action_board_status?: string | null
          audio_path?: string | null
          bookable?: boolean
          cancel_reason?: string | null
          cancellation_window_min?: number
          capacity?: number | null
          created_at?: string
          detached?: boolean
          ends_at?: string
          id?: string
          instructor_ids?: string[]
          lesson_plan_id?: string | null
          location_id?: string
          name?: string
          notes?: string | null
          occurrence_date?: string
          program_ids?: string[]
          room?: string | null
          starts_at?: string
          status?: string
          substitute_ids?: string[]
          template_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_lesson_plan_id_fkey"
            columns: ["tenant_id", "lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_template_id_fkey"
            columns: ["tenant_id", "template_id"]
            isOneToOne: false
            referencedRelation: "class_templates"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      class_templates: {
        Row: {
          active: boolean
          age_max: number | null
          age_min: number | null
          bookable: boolean
          cancellation_window_min: number
          capacity: number | null
          color: string | null
          created_at: string
          duration_min: number
          id: string
          instructor_ids: string[]
          location_id: string
          name: string
          program_ids: string[]
          rank_max_position: number | null
          rank_min_position: number | null
          room: string | null
          rrule: string
          start_date: string
          start_time: string
          tenant_id: string
          until_date: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          age_max?: number | null
          age_min?: number | null
          bookable?: boolean
          cancellation_window_min?: number
          capacity?: number | null
          color?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          instructor_ids?: string[]
          location_id: string
          name: string
          program_ids?: string[]
          rank_max_position?: number | null
          rank_min_position?: number | null
          room?: string | null
          rrule: string
          start_date: string
          start_time: string
          tenant_id: string
          until_date?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          age_max?: number | null
          age_min?: number | null
          bookable?: boolean
          cancellation_window_min?: number
          capacity?: number | null
          color?: string | null
          created_at?: string
          duration_min?: number
          id?: string
          instructor_ids?: string[]
          location_id?: string
          name?: string
          program_ids?: string[]
          rank_max_position?: number | null
          rank_min_position?: number | null
          room?: string | null
          rrule?: string
          start_date?: string
          start_time?: string
          tenant_id?: string
          until_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "class_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "class_templates_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      communications: {
        Row: {
          approval_item_id: string | null
          automation_run_id: string | null
          body_html: string | null
          body_text: string
          campaign_id: string | null
          channel: string
          created_at: string
          created_by: string | null
          data: Json
          direction: string
          error: string | null
          household_id: string | null
          id: string
          person_id: string | null
          provider: string | null
          provider_message_id: string | null
          related_id: string | null
          related_type: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_key: string | null
          tenant_id: string
          thread_id: string | null
          to_address: string | null
          updated_at: string
        }
        Insert: {
          approval_item_id?: string | null
          automation_run_id?: string | null
          body_html?: string | null
          body_text?: string
          campaign_id?: string | null
          channel: string
          created_at?: string
          created_by?: string | null
          data?: Json
          direction?: string
          error?: string | null
          household_id?: string | null
          id?: string
          person_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          related_id?: string | null
          related_type?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_key?: string | null
          tenant_id: string
          thread_id?: string | null
          to_address?: string | null
          updated_at?: string
        }
        Update: {
          approval_item_id?: string | null
          automation_run_id?: string | null
          body_html?: string | null
          body_text?: string
          campaign_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          direction?: string
          error?: string | null
          household_id?: string | null
          id?: string
          person_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          related_id?: string | null
          related_type?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_key?: string | null
          tenant_id?: string
          thread_id?: string | null
          to_address?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_automation_run_fk"
            columns: ["tenant_id", "automation_run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "communications_campaign_fk"
            columns: ["tenant_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "communications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "communications_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "communications_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "communications_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "communications_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "communications_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "communications_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "communications_tenant_id_thread_id_fkey"
            columns: ["tenant_id", "thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      consents: {
        Row: {
          created_at: string
          document_path: string | null
          granted: boolean
          granted_at: string
          guardian_person_id: string | null
          id: string
          ip: string | null
          kind: string
          method: string
          person_id: string
          recorded_by: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_path?: string | null
          granted: boolean
          granted_at?: string
          guardian_person_id?: string | null
          id?: string
          ip?: string | null
          kind: string
          method?: string
          person_id: string
          recorded_by?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_path?: string | null
          granted?: boolean
          granted_at?: string
          guardian_person_id?: string | null
          id?: string
          ip?: string | null
          kind?: string
          method?: string
          person_id?: string
          recorded_by?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "consents_tenant_id_guardian_person_id_fkey"
            columns: ["tenant_id", "guardian_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "consents_tenant_id_guardian_person_id_fkey"
            columns: ["tenant_id", "guardian_person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "consents_tenant_id_guardian_person_id_fkey"
            columns: ["tenant_id", "guardian_person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "consents_tenant_id_guardian_person_id_fkey"
            columns: ["tenant_id", "guardian_person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "consents_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "consents_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "consents_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "consents_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      credits: {
        Row: {
          amount_cents: number
          created_at: string
          expires_at: string | null
          household_id: string
          id: string
          reason: string
          remaining_cents: number
          source_ref: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          expires_at?: string | null
          household_id: string
          id?: string
          reason: string
          remaining_cents: number
          source_ref?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          expires_at?: string | null
          household_id?: string
          id?: string
          reason?: string
          remaining_cents?: number
          source_ref?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "credits_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "credits_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
        ]
      }
      discounts: {
        Row: {
          active: boolean
          applies_to: string
          code: string | null
          created_at: string
          ends_at: string | null
          id: string
          kind: string
          max_uses: number | null
          name: string
          starts_at: string | null
          tenant_id: string
          updated_at: string
          uses: number
          value: number
        }
        Insert: {
          active?: boolean
          applies_to?: string
          code?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          kind: string
          max_uses?: number | null
          name: string
          starts_at?: string | null
          tenant_id: string
          updated_at?: string
          uses?: number
          value: number
        }
        Update: {
          active?: boolean
          applies_to?: string
          code?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: string
          max_uses?: number | null
          name?: string
          starts_at?: string | null
          tenant_id?: string
          updated_at?: string
          uses?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "discounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      document_templates: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          kind: string
          name: string
          published_at: string
          published_by: string | null
          required_for: Json
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: string
          kind?: string
          name: string
          published_at?: string
          published_by?: string | null
          required_for?: Json
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          published_at?: string
          published_by?: string | null
          required_for?: Json
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "document_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          expires_at: string | null
          household_id: string | null
          id: string
          kind: string
          mime: string | null
          name: string
          person_id: string | null
          size: number | null
          storage_path: string
          tenant_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          household_id?: string | null
          id?: string
          kind?: string
          mime?: string | null
          name: string
          person_id?: string | null
          size?: number | null
          storage_path: string
          tenant_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          household_id?: string | null
          id?: string
          kind?: string
          mime?: string | null
          name?: string
          person_id?: string | null
          size?: number | null
          storage_path?: string
          tenant_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "documents_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "documents_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "documents_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "documents_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "documents_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "documents_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      dunning_policies: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          steps: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          steps: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          steps?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dunning_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dunning_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "dunning_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      enrollments: {
        Row: {
          classes_since_promotion: number
          created_at: string
          current_rank_id: string | null
          id: string
          last_promoted_at: string | null
          person_id: string
          program_id: string
          started_at: string
          status: string
          stripes: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          classes_since_promotion?: number
          created_at?: string
          current_rank_id?: string | null
          id?: string
          last_promoted_at?: string | null
          person_id: string
          program_id: string
          started_at?: string
          status?: string
          stripes?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          classes_since_promotion?: number
          created_at?: string
          current_rank_id?: string | null
          id?: string
          last_promoted_at?: string | null
          person_id?: string
          program_id?: string
          started_at?: string
          status?: string
          stripes?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_tenant_id_current_rank_id_fkey"
            columns: ["tenant_id", "current_rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_program_id_fkey"
            columns: ["tenant_id", "program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      exports: {
        Row: {
          by_user_id: string | null
          created_at: string
          error: string | null
          expires_at: string | null
          file_path: string | null
          id: string
          kind: string
          params: Json
          stats: Json
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          by_user_id?: string | null
          created_at?: string
          error?: string | null
          expires_at?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          params?: Json
          stats?: Json
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          by_user_id?: string | null
          created_at?: string
          error?: string | null
          expires_at?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          params?: Json
          stats?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "exports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      gear_fulfilments: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivered_by: string | null
          household_id: string
          id: string
          membership_id: string | null
          notes: string | null
          person_id: string
          sizes: Json
          status: string
          tenant_id: string
          updated_at: string
          variant_ids: string[]
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivered_by?: string | null
          household_id: string
          id?: string
          membership_id?: string | null
          notes?: string | null
          person_id: string
          sizes?: Json
          status?: string
          tenant_id: string
          updated_at?: string
          variant_ids?: string[]
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivered_by?: string | null
          household_id?: string
          id?: string
          membership_id?: string | null
          notes?: string | null
          person_id?: string
          sizes?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
          variant_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "gear_fulfilments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "v_deferred_revenue"
            referencedColumns: ["tenant_id", "membership_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "v_membership_mrr"
            referencedColumns: ["tenant_id", "membership_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "v_mrr"
            referencedColumns: ["tenant_id", "membership_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          location_id: string | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          location_id?: string | null
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          location_id?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holidays_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "holidays_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "holidays_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      household_members: {
        Row: {
          can_pickup: boolean
          created_at: string
          household_id: string
          id: string
          is_primary_guardian: boolean
          person_id: string
          receives_billing: boolean
          relationship: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          can_pickup?: boolean
          created_at?: string
          household_id: string
          id?: string
          is_primary_guardian?: boolean
          person_id: string
          receives_billing?: boolean
          relationship: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          can_pickup?: boolean
          created_at?: string
          household_id?: string
          id?: string
          is_primary_guardian?: boolean
          person_id?: string
          receives_billing?: boolean
          relationship?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "household_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "household_members_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "household_members_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "household_members_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "household_members_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "household_members_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "household_members_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      households: {
        Row: {
          archived_at: string | null
          balance_cents: number
          billing_email: string | null
          created_at: string
          external_id: string | null
          id: string
          name: string
          notes: string | null
          primary_payer_person_id: string | null
          stripe_customer_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          balance_cents?: number
          billing_email?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          name: string
          notes?: string | null
          primary_payer_person_id?: string | null
          stripe_customer_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          balance_cents?: number
          billing_email?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          primary_payer_person_id?: string | null
          stripe_customer_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "households_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "households_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "households_tenant_id_primary_payer_person_id_fkey"
            columns: ["tenant_id", "primary_payer_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "households_tenant_id_primary_payer_person_id_fkey"
            columns: ["tenant_id", "primary_payer_person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "households_tenant_id_primary_payer_person_id_fkey"
            columns: ["tenant_id", "primary_payer_person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "households_tenant_id_primary_payer_person_id_fkey"
            columns: ["tenant_id", "primary_payer_person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      inventory_levels: {
        Row: {
          created_at: string
          id: string
          location_id: string
          on_hand: number
          reorder_point: number
          reserved: number
          tenant_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          on_hand?: number
          reorder_point?: number
          reserved?: number
          tenant_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          on_hand?: number
          reorder_point?: number
          reserved?: number
          tenant_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_levels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "inventory_levels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "inventory_levels_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "inventory_levels_tenant_id_variant_id_fkey"
            columns: ["tenant_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "inventory_levels_tenant_id_variant_id_fkey"
            columns: ["tenant_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory"
            referencedColumns: ["tenant_id", "variant_id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          by_user_id: string | null
          created_at: string
          delta: number
          id: string
          location_id: string
          note: string | null
          reason: string
          ref_id: string | null
          ref_type: string | null
          tenant_id: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          by_user_id?: string | null
          created_at?: string
          delta: number
          id?: string
          location_id: string
          note?: string | null
          reason: string
          ref_id?: string | null
          ref_type?: string | null
          tenant_id: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          by_user_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          location_id?: string
          note?: string | null
          reason?: string
          ref_id?: string | null
          ref_type?: string | null
          tenant_id?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "inventory_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "inventory_movements_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "inventory_movements_tenant_id_variant_id_fkey"
            columns: ["tenant_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "inventory_movements_tenant_id_variant_id_fkey"
            columns: ["tenant_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory"
            referencedColumns: ["tenant_id", "variant_id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          kind: string
          quantity: number
          ref_id: string | null
          ref_type: string | null
          tax_cents: number
          tax_rate: number | null
          tenant_id: string
          total_cents: number
          unit_cents: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          kind: string
          quantity?: number
          ref_id?: string | null
          ref_type?: string | null
          tax_cents?: number
          tax_rate?: number | null
          tenant_id: string
          total_cents: number
          unit_cents: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          kind?: string
          quantity?: number
          ref_id?: string | null
          ref_type?: string | null
          tax_cents?: number
          tax_rate?: number | null
          tenant_id?: string
          total_cents?: number
          unit_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "invoice_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "invoice_lines_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "invoice_lines_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_ar_aging"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
          {
            foreignKeyName: "invoice_lines_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_dunning"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
          {
            foreignKeyName: "invoice_lines_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_lines"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance_cents: number
          created_at: string
          currency: string
          discount_cents: number
          due_at: string
          dunning_state: Json
          household_id: string
          id: string
          issued_at: string
          membership_id: string | null
          memo: string | null
          number: number
          paid_cents: number
          period_end: string | null
          period_start: string | null
          person_id: string | null
          source: string
          status: string
          stripe_payment_intent_id: string | null
          subtotal_cents: number
          tax_cents: number
          tenant_id: string
          total_cents: number
          updated_at: string
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          balance_cents?: number
          created_at?: string
          currency?: string
          discount_cents?: number
          due_at?: string
          dunning_state?: Json
          household_id: string
          id?: string
          issued_at?: string
          membership_id?: string | null
          memo?: string | null
          number: number
          paid_cents?: number
          period_end?: string | null
          period_start?: string | null
          person_id?: string | null
          source?: string
          status?: string
          stripe_payment_intent_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          tenant_id: string
          total_cents?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          balance_cents?: number
          created_at?: string
          currency?: string
          discount_cents?: number
          due_at?: string
          dunning_state?: Json
          household_id?: string
          id?: string
          issued_at?: string
          membership_id?: string | null
          memo?: string | null
          number?: number
          paid_cents?: number
          period_end?: string | null
          period_start?: string | null
          person_id?: string | null
          source?: string
          status?: string
          stripe_payment_intent_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          tenant_id?: string
          total_cents?: number
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "v_deferred_revenue"
            referencedColumns: ["tenant_id", "membership_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "v_membership_mrr"
            referencedColumns: ["tenant_id", "membership_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "v_mrr"
            referencedColumns: ["tenant_id", "membership_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      job_runs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          for_tenant_id: string | null
          id: string
          job_name: string
          started_at: string
          stats: Json
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          for_tenant_id?: string | null
          id?: string
          job_name: string
          started_at?: string
          stats?: Json
          status?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          for_tenant_id?: string | null
          id?: string
          job_name?: string
          started_at?: string
          stats?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_runs_for_tenant_id_fkey"
            columns: ["for_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_runs_for_tenant_id_fkey"
            columns: ["for_tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "job_runs_for_tenant_id_fkey"
            columns: ["for_tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "job_runs_job_name_fkey"
            columns: ["job_name"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["name"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          name: string
          schedule: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          enabled?: boolean
          name: string
          schedule: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          name?: string
          schedule?: string
          updated_at?: string
        }
        Relationships: []
      }
      kiosk_devices: {
        Row: {
          created_at: string
          device_user_id: string | null
          id: string
          last_seen_at: string | null
          location_id: string
          name: string
          paired_by: string | null
          revoked_at: string | null
          settings: Json
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_user_id?: string | null
          id?: string
          last_seen_at?: string | null
          location_id: string
          name: string
          paired_by?: string | null
          revoked_at?: string | null
          settings?: Json
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_user_id?: string | null
          id?: string
          last_seen_at?: string | null
          location_id?: string
          name?: string
          paired_by?: string | null
          revoked_at?: string | null
          settings?: Json
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "kiosk_devices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "kiosk_devices_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      kiosk_pins: {
        Row: {
          created_at: string
          failed_attempts: number
          household_id: string | null
          id: string
          locked_until: string | null
          person_id: string | null
          pin_hash: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          household_id?: string | null
          id?: string
          locked_until?: string | null
          person_id?: string | null
          pin_hash: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          household_id?: string | null
          id?: string
          locked_until?: string | null
          person_id?: string | null
          pin_hash?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_pins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_pins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "kiosk_pins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "kiosk_pins_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "kiosk_pins_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "kiosk_pins_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "kiosk_pins_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "kiosk_pins_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "kiosk_pins_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          at: string
          body: string | null
          by_user_id: string | null
          created_at: string
          id: string
          kind: string
          lead_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          at?: string
          body?: string | null
          by_user_id?: string | null
          created_at?: string
          id?: string
          kind: string
          lead_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          at?: string
          body?: string | null
          by_user_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "lead_activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "lead_activities_tenant_id_lead_id_fkey"
            columns: ["tenant_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_run_id: string | null
          converted_household_id: string | null
          created_at: string
          id: string
          lost_reason: string | null
          message: string | null
          next_action: string | null
          next_action_at: string | null
          owner_user_id: string | null
          person_id: string
          program_interest: string[]
          score: number | null
          source: string | null
          stage_changed_at: string
          stage_id: string
          tenant_id: string
          trial_booking_id: string | null
          updated_at: string
          utm: Json
          value_cents: number | null
        }
        Insert: {
          ai_run_id?: string | null
          converted_household_id?: string | null
          created_at?: string
          id?: string
          lost_reason?: string | null
          message?: string | null
          next_action?: string | null
          next_action_at?: string | null
          owner_user_id?: string | null
          person_id: string
          program_interest?: string[]
          score?: number | null
          source?: string | null
          stage_changed_at?: string
          stage_id: string
          tenant_id: string
          trial_booking_id?: string | null
          updated_at?: string
          utm?: Json
          value_cents?: number | null
        }
        Update: {
          ai_run_id?: string | null
          converted_household_id?: string | null
          created_at?: string
          id?: string
          lost_reason?: string | null
          message?: string | null
          next_action?: string | null
          next_action_at?: string | null
          owner_user_id?: string | null
          person_id?: string
          program_interest?: string[]
          score?: number | null
          source?: string | null
          stage_changed_at?: string
          stage_id?: string
          tenant_id?: string
          trial_booking_id?: string | null
          updated_at?: string
          utm?: Json
          value_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_tenant_id_converted_household_id_fkey"
            columns: ["tenant_id", "converted_household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leads_tenant_id_converted_household_id_fkey"
            columns: ["tenant_id", "converted_household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "leads_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leads_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "leads_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "leads_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leads_tenant_id_stage_id_fkey"
            columns: ["tenant_id", "stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leads_tenant_id_trial_booking_id_fkey"
            columns: ["tenant_id", "trial_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      lesson_plans: {
        Row: {
          ai_run_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_template: boolean
          name: string
          program_id: string | null
          sections: Json
          source: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ai_run_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_template?: boolean
          name: string
          program_id?: string | null
          sections?: Json
          source?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ai_run_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_template?: boolean
          name?: string
          program_id?: string | null
          sections?: Json
          source?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "lesson_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "lesson_plans_tenant_id_program_id_fkey"
            columns: ["tenant_id", "program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      locations: {
        Row: {
          address: Json
          archived_at: string | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          phone: string | null
          rooms: Json
          tenant_id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: Json
          archived_at?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          phone?: string | null
          rooms?: Json
          tenant_id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json
          archived_at?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          phone?: string | null
          rooms?: Json
          tenant_id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      makeup_credits: {
        Row: {
          created_at: string
          earned_from_session_id: string | null
          expires_at: string
          id: string
          person_id: string
          reason: string
          tenant_id: string
          updated_at: string
          used_booking_id: string | null
        }
        Insert: {
          created_at?: string
          earned_from_session_id?: string | null
          expires_at?: string
          id?: string
          person_id: string
          reason?: string
          tenant_id: string
          updated_at?: string
          used_booking_id?: string | null
        }
        Update: {
          created_at?: string
          earned_from_session_id?: string | null
          expires_at?: string
          id?: string
          person_id?: string
          reason?: string
          tenant_id?: string
          updated_at?: string
          used_booking_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "makeup_credits_tenant_id_earned_from_session_id_fkey"
            columns: ["tenant_id", "earned_from_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "makeup_credits_tenant_id_earned_from_session_id_fkey"
            columns: ["tenant_id", "earned_from_session_id"]
            isOneToOne: false
            referencedRelation: "v_session_stats"
            referencedColumns: ["tenant_id", "session_id"]
          },
          {
            foreignKeyName: "makeup_credits_tenant_id_earned_from_session_id_fkey"
            columns: ["tenant_id", "earned_from_session_id"]
            isOneToOne: false
            referencedRelation: "v_upcoming_for_person"
            referencedColumns: ["tenant_id", "session_id"]
          },
          {
            foreignKeyName: "makeup_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "makeup_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "makeup_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "makeup_credits_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "makeup_credits_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "makeup_credits_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "makeup_credits_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "makeup_credits_used_booking_fk"
            columns: ["tenant_id", "used_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          active: boolean
          attendance_rule: Json
          auto_renew: boolean
          class_pack_size: number | null
          contract_months: number | null
          created_at: string
          description: string
          early_termination_fee_cents: number | null
          enrollment_fee_cents: number
          family_discount: Json
          gear_package_product_ids: string[]
          id: string
          interval: string | null
          interval_count: number
          kind: string
          name: string
          price_cents: number
          program_ids: string[]
          public: boolean
          sort: number
          tax_class: string
          tenant_id: string
          term_months: number | null
          trial_days: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          attendance_rule?: Json
          auto_renew?: boolean
          class_pack_size?: number | null
          contract_months?: number | null
          created_at?: string
          description?: string
          early_termination_fee_cents?: number | null
          enrollment_fee_cents?: number
          family_discount?: Json
          gear_package_product_ids?: string[]
          id?: string
          interval?: string | null
          interval_count?: number
          kind: string
          name: string
          price_cents: number
          program_ids?: string[]
          public?: boolean
          sort?: number
          tax_class?: string
          tenant_id: string
          term_months?: number | null
          trial_days?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          attendance_rule?: Json
          auto_renew?: boolean
          class_pack_size?: number | null
          contract_months?: number | null
          created_at?: string
          description?: string
          early_termination_fee_cents?: number | null
          enrollment_fee_cents?: number
          family_discount?: Json
          gear_package_product_ids?: string[]
          id?: string
          interval?: string | null
          interval_count?: number
          kind?: string
          name?: string
          price_cents?: number
          program_ids?: string[]
          public?: boolean
          sort?: number
          tax_class?: string
          tenant_id?: string
          term_months?: number | null
          trial_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "membership_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      memberships: {
        Row: {
          autopay: boolean
          billing_day: number | null
          cancel_at: string | null
          cancel_reason: string | null
          class_pack_remaining: number | null
          contract_ends_at: string | null
          created_at: string
          discount_ids: string[]
          ends_at: string | null
          hold_from: string | null
          hold_until: string | null
          household_id: string
          id: string
          next_bill_at: string | null
          notes: string | null
          payment_method_id: string | null
          person_id: string
          plan_id: string
          price_override_cents: number | null
          starts_at: string
          status: string
          stripe_subscription_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          autopay?: boolean
          billing_day?: number | null
          cancel_at?: string | null
          cancel_reason?: string | null
          class_pack_remaining?: number | null
          contract_ends_at?: string | null
          created_at?: string
          discount_ids?: string[]
          ends_at?: string | null
          hold_from?: string | null
          hold_until?: string | null
          household_id: string
          id?: string
          next_bill_at?: string | null
          notes?: string | null
          payment_method_id?: string | null
          person_id: string
          plan_id: string
          price_override_cents?: number | null
          starts_at: string
          status?: string
          stripe_subscription_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          autopay?: boolean
          billing_day?: number | null
          cancel_at?: string | null
          cancel_reason?: string | null
          class_pack_remaining?: number | null
          contract_ends_at?: string | null
          created_at?: string
          discount_ids?: string[]
          ends_at?: string | null
          hold_from?: string | null
          hold_until?: string | null
          household_id?: string
          id?: string
          next_bill_at?: string | null
          notes?: string | null
          payment_method_id?: string | null
          person_id?: string
          plan_id?: string
          price_override_cents?: number | null
          starts_at?: string
          status?: string
          stripe_subscription_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_payment_method_id_fkey"
            columns: ["tenant_id", "payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_plan_id_fkey"
            columns: ["tenant_id", "plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      message_templates: {
        Row: {
          active: boolean
          body: string
          channel: string
          created_at: string
          id: string
          key: string
          subject: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          channel: string
          created_at?: string
          id?: string
          key: string
          subject?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          channel?: string
          created_at?: string
          id?: string
          key?: string
          subject?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "message_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      message_threads: {
        Row: {
          assigned_user_id: string | null
          created_at: string
          household_id: string
          id: string
          last_message_at: string
          status: string
          subject: string
          tenant_id: string
          unread_household: number
          unread_staff: number
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          created_at?: string
          household_id: string
          id?: string
          last_message_at?: string
          status?: string
          subject?: string
          tenant_id: string
          unread_household?: number
          unread_staff?: number
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          created_at?: string
          household_id?: string
          id?: string
          last_message_at?: string
          status?: string
          subject?: string
          tenant_id?: string
          unread_household?: number
          unread_staff?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "message_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "message_threads_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "message_threads_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string
          key: string
          name: string
          required: boolean
          sort: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          key: string
          name: string
          required?: boolean
          sort?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          key?: string
          name?: string
          required?: boolean
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          body: string
          by_user_id: string | null
          created_at: string
          id: string
          kind: string
          person_id: string
          pinned: boolean
          source: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body: string
          by_user_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          person_id: string
          pinned?: boolean
          source?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          by_user_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          person_id?: string
          pinned?: boolean
          source?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "notes_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "notes_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "notes_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "notes_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          invoice_id: string
          payment_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "payment_allocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "payment_allocations_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "payment_allocations_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_ar_aging"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
          {
            foreignKeyName: "payment_allocations_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_dunning"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
          {
            foreignKeyName: "payment_allocations_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_lines"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
          {
            foreignKeyName: "payment_allocations_tenant_id_payment_id_fkey"
            columns: ["tenant_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          exp_month: number | null
          exp_year: number | null
          household_id: string
          id: string
          is_default: boolean
          kind: string
          last4: string | null
          status: string
          stripe_payment_method_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          household_id: string
          id?: string
          is_default?: boolean
          kind: string
          last4?: string | null
          status?: string
          stripe_payment_method_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          household_id?: string
          id?: string
          is_default?: boolean
          kind?: string
          last4?: string | null
          status?: string
          stripe_payment_method_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "payment_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "payment_methods_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "payment_methods_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          failure_code: string | null
          failure_message: string | null
          household_id: string
          id: string
          invoice_id: string | null
          memo: string | null
          method: string
          payment_method_id: string | null
          received_at: string
          received_by_user_id: string | null
          refunded_cents: number
          status: string
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          household_id: string
          id?: string
          invoice_id?: string | null
          memo?: string | null
          method: string
          payment_method_id?: string | null
          received_at?: string
          received_by_user_id?: string | null
          refunded_cents?: number
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          household_id?: string
          id?: string
          invoice_id?: string | null
          memo?: string | null
          method?: string
          payment_method_id?: string | null
          received_at?: string
          received_by_user_id?: string | null
          refunded_cents?: number
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "payments_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "payments_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "payments_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "payments_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_ar_aging"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
          {
            foreignKeyName: "payments_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_dunning"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
          {
            foreignKeyName: "payments_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_lines"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
          {
            foreignKeyName: "payments_tenant_id_payment_method_id_fkey"
            columns: ["tenant_id", "payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      people: {
        Row: {
          address: Json
          allergies: string[]
          archived_at: string | null
          belt_size: string | null
          created_at: string
          custom: Json
          dob: string | null
          email: string | null
          email_consent: boolean
          emergency_contacts: Json
          external_id: string | null
          first_name: string
          gender: string | null
          id: string
          injury_flags: string[]
          kukkiwon_id: string | null
          last_name: string
          name_native: string | null
          nationality: string | null
          phone: string | null
          phone_sms_consent: boolean
          photo_path: string | null
          preferred_name: string | null
          primary_location_id: string | null
          referred_by_person_id: string | null
          source: string | null
          status: string
          status_changed_at: string
          status_reason: string | null
          tags: string[]
          tcon_id: string | null
          tenant_id: string
          type_flags: string[]
          uniform_size: string | null
          updated_at: string
          user_id: string | null
          utm: Json
        }
        Insert: {
          address?: Json
          allergies?: string[]
          archived_at?: string | null
          belt_size?: string | null
          created_at?: string
          custom?: Json
          dob?: string | null
          email?: string | null
          email_consent?: boolean
          emergency_contacts?: Json
          external_id?: string | null
          first_name: string
          gender?: string | null
          id?: string
          injury_flags?: string[]
          kukkiwon_id?: string | null
          last_name?: string
          name_native?: string | null
          nationality?: string | null
          phone?: string | null
          phone_sms_consent?: boolean
          photo_path?: string | null
          preferred_name?: string | null
          primary_location_id?: string | null
          referred_by_person_id?: string | null
          source?: string | null
          status?: string
          status_changed_at?: string
          status_reason?: string | null
          tags?: string[]
          tcon_id?: string | null
          tenant_id: string
          type_flags?: string[]
          uniform_size?: string | null
          updated_at?: string
          user_id?: string | null
          utm?: Json
        }
        Update: {
          address?: Json
          allergies?: string[]
          archived_at?: string | null
          belt_size?: string | null
          created_at?: string
          custom?: Json
          dob?: string | null
          email?: string | null
          email_consent?: boolean
          emergency_contacts?: Json
          external_id?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          injury_flags?: string[]
          kukkiwon_id?: string | null
          last_name?: string
          name_native?: string | null
          nationality?: string | null
          phone?: string | null
          phone_sms_consent?: boolean
          photo_path?: string | null
          preferred_name?: string | null
          primary_location_id?: string | null
          referred_by_person_id?: string | null
          source?: string | null
          status?: string
          status_changed_at?: string
          status_reason?: string | null
          tags?: string[]
          tcon_id?: string | null
          tenant_id?: string
          type_flags?: string[]
          uniform_size?: string | null
          updated_at?: string
          user_id?: string | null
          utm?: Json
        }
        Relationships: [
          {
            foreignKeyName: "people_referred_by_fk"
            columns: ["tenant_id", "referred_by_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "people_referred_by_fk"
            columns: ["tenant_id", "referred_by_person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "people_referred_by_fk"
            columns: ["tenant_id", "referred_by_person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "people_referred_by_fk"
            columns: ["tenant_id", "referred_by_person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "people_tenant_id_primary_location_id_fkey"
            columns: ["tenant_id", "primary_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      people_medical: {
        Row: {
          created_at: string
          id: string
          medical_notes: string
          person_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          medical_notes?: string
          person_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          medical_notes?: string
          person_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_medical_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_medical_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "people_medical_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "people_medical_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "people_medical_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "people_medical_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "people_medical_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string
          domain: string
          key: string
        }
        Insert: {
          description?: string
          domain: string
          key: string
        }
        Update: {
          description?: string
          domain?: string
          key?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          created_at: string
          id: string
          key: string | null
          kind: string
          name: string
          position: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          key?: string | null
          kind?: string
          name: string
          position?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string | null
          kind?: string
          name?: string
          position?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "pipeline_stages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      plan_modules: {
        Row: {
          module_key: string
          plan_key: string
        }
        Insert: {
          module_key: string
          plan_key: string
        }
        Update: {
          module_key?: string
          plan_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_modules_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "plan_modules_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["key"]
          },
        ]
      }
      plans: {
        Row: {
          annual_cents: number
          created_at: string
          description: string
          is_bundle: boolean
          key: string
          monthly_cents: number
          name: string
          public: boolean
          sort: number
          updated_at: string
        }
        Insert: {
          annual_cents: number
          created_at?: string
          description?: string
          is_bundle?: boolean
          key: string
          monthly_cents: number
          name: string
          public?: boolean
          sort?: number
          updated_at?: string
        }
        Update: {
          annual_cents?: number
          created_at?: string
          description?: string
          is_bundle?: boolean
          key?: string
          monthly_cents?: number
          name?: string
          public?: boolean
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pos_sale_lines: {
        Row: {
          created_at: string
          discount_cents: number
          id: string
          original_line_id: string | null
          qty: number
          sale_id: string
          tax_cents: number
          tenant_id: string
          total_cents: number
          unit_cents: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          discount_cents?: number
          id?: string
          original_line_id?: string | null
          qty: number
          sale_id: string
          tax_cents?: number
          tenant_id: string
          total_cents: number
          unit_cents: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          discount_cents?: number
          id?: string
          original_line_id?: string | null
          qty?: number
          sale_id?: string
          tax_cents?: number
          tenant_id?: string
          total_cents?: number
          unit_cents?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sale_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "pos_sale_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "pos_sale_lines_tenant_id_sale_id_fkey"
            columns: ["tenant_id", "sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "pos_sale_lines_tenant_id_variant_id_fkey"
            columns: ["tenant_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "pos_sale_lines_tenant_id_variant_id_fkey"
            columns: ["tenant_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory"
            referencedColumns: ["tenant_id", "variant_id"]
          },
        ]
      }
      pos_sales: {
        Row: {
          cashier_user_id: string | null
          created_at: string
          discount_cents: number
          drawer_id: string | null
          household_id: string | null
          id: string
          invoice_id: string | null
          kind: string
          location_id: string
          original_sale_id: string | null
          person_id: string | null
          receipt_number: number | null
          status: string
          subtotal_cents: number
          tax_cents: number
          tenant_id: string
          terminal_reader_id: string | null
          total_cents: number
          updated_at: string
        }
        Insert: {
          cashier_user_id?: string | null
          created_at?: string
          discount_cents?: number
          drawer_id?: string | null
          household_id?: string | null
          id?: string
          invoice_id?: string | null
          kind?: string
          location_id: string
          original_sale_id?: string | null
          person_id?: string | null
          receipt_number?: number | null
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          tenant_id: string
          terminal_reader_id?: string | null
          total_cents?: number
          updated_at?: string
        }
        Update: {
          cashier_user_id?: string | null
          created_at?: string
          discount_cents?: number
          drawer_id?: string | null
          household_id?: string | null
          id?: string
          invoice_id?: string | null
          kind?: string
          location_id?: string
          original_sale_id?: string | null
          person_id?: string | null
          receipt_number?: number | null
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          tenant_id?: string
          terminal_reader_id?: string | null
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_sales_tenant_id_drawer_id_fkey"
            columns: ["tenant_id", "drawer_id"]
            isOneToOne: false
            referencedRelation: "cash_drawers"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_ar_aging"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_dunning"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_lines"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_original_sale_id_fkey"
            columns: ["tenant_id", "original_sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "pos_sales_tenant_id_terminal_reader_id_fkey"
            columns: ["tenant_id", "terminal_reader_id"]
            isOneToOne: false
            referencedRelation: "terminal_readers"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      pos_tenders: {
        Row: {
          amount_cents: number
          change_cents: number
          created_at: string
          id: string
          method: string
          payment_id: string | null
          sale_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          change_cents?: number
          created_at?: string
          id?: string
          method: string
          payment_id?: string | null
          sale_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          change_cents?: number
          created_at?: string
          id?: string
          method?: string
          payment_id?: string | null
          sale_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_tenders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_tenders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "pos_tenders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "pos_tenders_tenant_id_payment_id_fkey"
            columns: ["tenant_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "pos_tenders_tenant_id_sale_id_fkey"
            columns: ["tenant_id", "sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      private_lesson_slots: {
        Row: {
          booked_person_id: string | null
          created_at: string
          ends_at: string
          id: string
          instructor_user_id: string | null
          location_id: string
          price_cents: number
          starts_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          booked_person_id?: string | null
          created_at?: string
          ends_at: string
          id?: string
          instructor_user_id?: string | null
          location_id: string
          price_cents?: number
          starts_at: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          booked_person_id?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          instructor_user_id?: string | null
          location_id?: string
          price_cents?: number
          starts_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_lesson_slots_tenant_id_booked_person_id_fkey"
            columns: ["tenant_id", "booked_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "private_lesson_slots_tenant_id_booked_person_id_fkey"
            columns: ["tenant_id", "booked_person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "private_lesson_slots_tenant_id_booked_person_id_fkey"
            columns: ["tenant_id", "booked_person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "private_lesson_slots_tenant_id_booked_person_id_fkey"
            columns: ["tenant_id", "booked_person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "private_lesson_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_lesson_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "private_lesson_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "private_lesson_slots_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      product_variants: {
        Row: {
          active: boolean
          barcode: string | null
          cost_cents: number
          created_at: string
          id: string
          options: Json
          price_cents: number
          product_id: string
          sku: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          cost_cents?: number
          created_at?: string
          id?: string
          options?: Json
          price_cents: number
          product_id: string
          sku: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          cost_cents?: number
          created_at?: string
          id?: string
          options?: Json
          price_cents?: number
          product_id?: string
          sku?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "product_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "product_variants_tenant_id_product_id_fkey"
            columns: ["tenant_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string
          id: string
          images: string[]
          name: string
          sort: number
          tax_class: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          name: string
          sort?: number
          tax_class?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          name?: string
          sort?: number
          tax_class?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_tenant_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_seen_at: string | null
          phone: string | null
          preferred_theme: string | null
          updated_at: string
        }
        Insert: {
          active_tenant_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_seen_at?: string | null
          phone?: string | null
          preferred_theme?: string | null
          updated_at?: string
        }
        Update: {
          active_tenant_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          phone?: string | null
          preferred_theme?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_tenant_id_fkey"
            columns: ["active_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_active_tenant_id_fkey"
            columns: ["active_tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "profiles_active_tenant_id_fkey"
            columns: ["active_tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      programs: {
        Row: {
          active: boolean
          age_max: number | null
          age_min: number | null
          color: string
          created_at: string
          description: string
          id: string
          invite_only: boolean
          name: string
          slug: string
          sort: number
          tenant_id: string
          terminology: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          age_max?: number | null
          age_min?: number | null
          color?: string
          created_at?: string
          description?: string
          id?: string
          invite_only?: boolean
          name: string
          slug: string
          sort?: number
          tenant_id: string
          terminology?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          age_max?: number | null
          age_min?: number | null
          color?: string
          created_at?: string
          description?: string
          id?: string
          invite_only?: boolean
          name?: string
          slug?: string
          sort?: number
          tenant_id?: string
          terminology?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "programs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      promotion_approvals: {
        Row: {
          approved_at: string
          approved_by_user_id: string | null
          created_at: string
          enrollment_id: string
          id: string
          note: string | null
          rank_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string
          approved_by_user_id?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          note?: string | null
          rank_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string
          approved_by_user_id?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          note?: string | null
          rank_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_approvals_tenant_id_enrollment_id_fkey"
            columns: ["tenant_id", "enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "promotion_approvals_tenant_id_enrollment_id_fkey"
            columns: ["tenant_id", "enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_progress"
            referencedColumns: ["tenant_id", "enrollment_id"]
          },
          {
            foreignKeyName: "promotion_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "promotion_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "promotion_approvals_tenant_id_rank_id_fkey"
            columns: ["tenant_id", "rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      promotions: {
        Row: {
          certificate_path: string | null
          created_at: string
          enrollment_id: string
          from_rank_id: string | null
          id: string
          notes: string | null
          promoted_at: string
          promoted_by_user_id: string | null
          reason: string | null
          tenant_id: string
          testing_event_id: string | null
          to_rank_id: string
          updated_at: string
        }
        Insert: {
          certificate_path?: string | null
          created_at?: string
          enrollment_id: string
          from_rank_id?: string | null
          id?: string
          notes?: string | null
          promoted_at?: string
          promoted_by_user_id?: string | null
          reason?: string | null
          tenant_id: string
          testing_event_id?: string | null
          to_rank_id: string
          updated_at?: string
        }
        Update: {
          certificate_path?: string | null
          created_at?: string
          enrollment_id?: string
          from_rank_id?: string | null
          id?: string
          notes?: string | null
          promoted_at?: string
          promoted_by_user_id?: string | null
          reason?: string | null
          tenant_id?: string
          testing_event_id?: string | null
          to_rank_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_tenant_id_enrollment_id_fkey"
            columns: ["tenant_id", "enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "promotions_tenant_id_enrollment_id_fkey"
            columns: ["tenant_id", "enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_progress"
            referencedColumns: ["tenant_id", "enrollment_id"]
          },
          {
            foreignKeyName: "promotions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "promotions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "promotions_tenant_id_from_rank_id_fkey"
            columns: ["tenant_id", "from_rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "promotions_tenant_id_to_rank_id_fkey"
            columns: ["tenant_id", "to_rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          created_at: string
          id: string
          po_id: string
          qty_ordered: number
          qty_received: number
          tenant_id: string
          unit_cost_cents: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          po_id: string
          qty_ordered: number
          qty_received?: number
          tenant_id: string
          unit_cost_cents?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          po_id?: string
          qty_ordered?: number
          qty_received?: number
          tenant_id?: string
          unit_cost_cents?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "purchase_order_lines_tenant_id_po_id_fkey"
            columns: ["tenant_id", "po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "purchase_order_lines_tenant_id_variant_id_fkey"
            columns: ["tenant_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "purchase_order_lines_tenant_id_variant_id_fkey"
            columns: ["tenant_id", "variant_id"]
            isOneToOne: false
            referencedRelation: "v_inventory"
            referencedColumns: ["tenant_id", "variant_id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          ai_intake_run_id: string | null
          created_at: string
          expected_at: string | null
          id: string
          location_id: string | null
          notes: string | null
          status: string
          supplier_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ai_intake_run_id?: string | null
          created_at?: string
          expected_at?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          status?: string
          supplier_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ai_intake_run_id?: string | null
          created_at?: string
          expected_at?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          status?: string
          supplier_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_supplier_id_fkey"
            columns: ["tenant_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      rank_requirements: {
        Row: {
          created_at: string
          id: string
          min_classes: number
          min_days: number
          notes: string
          rank_id: string
          requires_instructor_approval: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_classes?: number
          min_days?: number
          notes?: string
          rank_id: string
          requires_instructor_approval?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          min_classes?: number
          min_days?: number
          notes?: string
          rank_id?: string
          requires_instructor_approval?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rank_requirements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_requirements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "rank_requirements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "rank_requirements_tenant_id_rank_id_fkey"
            columns: ["tenant_id", "rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      rank_skills: {
        Row: {
          created_at: string
          id: string
          rank_id: string
          required: boolean
          skill_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          rank_id: string
          required?: boolean
          skill_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          rank_id?: string
          required?: boolean
          skill_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rank_skills_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_skills_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "rank_skills_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "rank_skills_tenant_id_rank_id_fkey"
            columns: ["tenant_id", "rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "rank_skills_tenant_id_skill_id_fkey"
            columns: ["tenant_id", "skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      ranks: {
        Row: {
          belt_color: string
          certificate_template_id: string | null
          created_at: string
          id: string
          name: string
          position: number
          program_id: string
          stripes_max: number
          tenant_id: string
          testing_fee_cents: number
          updated_at: string
        }
        Insert: {
          belt_color?: string
          certificate_template_id?: string | null
          created_at?: string
          id?: string
          name: string
          position: number
          program_id: string
          stripes_max?: number
          tenant_id: string
          testing_fee_cents?: number
          updated_at?: string
        }
        Update: {
          belt_color?: string
          certificate_template_id?: string | null
          created_at?: string
          id?: string
          name?: string
          position?: number
          program_id?: string
          stripes_max?: number
          tenant_id?: string
          testing_fee_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranks_tenant_id_certificate_template_id_fkey"
            columns: ["tenant_id", "certificate_template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "ranks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ranks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "ranks_tenant_id_program_id_fkey"
            columns: ["tenant_id", "program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_cents: number
          as_credit: boolean
          by_user_id: string | null
          created_at: string
          credit_note_number: number | null
          id: string
          payment_id: string
          reason: string
          status: string
          stripe_refund_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          as_credit?: boolean
          by_user_id?: string | null
          created_at?: string
          credit_note_number?: number | null
          id?: string
          payment_id: string
          reason: string
          status?: string
          stripe_refund_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          as_credit?: boolean
          by_user_id?: string | null
          created_at?: string
          credit_note_number?: number | null
          id?: string
          payment_id?: string
          reason?: string
          status?: string
          stripe_refund_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "refunds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "refunds_tenant_id_payment_id_fkey"
            columns: ["tenant_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_key: string
          role_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          permission_key: string
          role_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          permission_key?: string
          role_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "role_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "role_permissions_tenant_id_role_id_fkey"
            columns: ["tenant_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string
          id: string
          is_system: boolean
          key: string
          name: string
          surface: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          key: string
          name: string
          surface?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          surface?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      schedule_exceptions: {
        Row: {
          created_at: string
          date: string
          id: string
          kind: string
          overrides: Json
          reason: string | null
          template_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          kind: string
          overrides?: Json
          reason?: string | null
          template_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          kind?: string
          overrides?: Json
          reason?: string | null
          template_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_exceptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "schedule_exceptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "schedule_exceptions_tenant_id_template_id_fkey"
            columns: ["tenant_id", "template_id"]
            isOneToOne: false
            referencedRelation: "class_templates"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      segments: {
        Row: {
          created_at: string
          definition: Json
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          definition?: Json
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          definition?: Json
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "segments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "segments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      signature_requests: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          person_id: string
          signature_id: string | null
          signer_person_id: string | null
          template_id: string
          tenant_id: string
          token_hash: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          person_id: string
          signature_id?: string | null
          signer_person_id?: string | null
          template_id: string
          tenant_id: string
          token_hash: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          person_id?: string
          signature_id?: string | null
          signer_person_id?: string | null
          template_id?: string
          tenant_id?: string
          token_hash?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "signature_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "signature_requests_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "signature_requests_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "signature_requests_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "signature_requests_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "signature_requests_tenant_id_signature_id_fkey"
            columns: ["tenant_id", "signature_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "signature_requests_tenant_id_signer_person_id_fkey"
            columns: ["tenant_id", "signer_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "signature_requests_tenant_id_signer_person_id_fkey"
            columns: ["tenant_id", "signer_person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "signature_requests_tenant_id_signer_person_id_fkey"
            columns: ["tenant_id", "signer_person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "signature_requests_tenant_id_signer_person_id_fkey"
            columns: ["tenant_id", "signer_person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "signature_requests_tenant_id_template_id_fkey"
            columns: ["tenant_id", "template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "signature_requests_tenant_id_template_id_fkey"
            columns: ["tenant_id", "template_id"]
            isOneToOne: false
            referencedRelation: "v_required_documents"
            referencedColumns: ["tenant_id", "template_id"]
          },
        ]
      }
      signatures: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          method: string
          pdf_path: string | null
          person_id: string
          signed_at: string
          signer_person_id: string | null
          signer_user_id: string | null
          template_id: string
          tenant_id: string
          typed_name: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          method: string
          pdf_path?: string | null
          person_id: string
          signed_at?: string
          signer_person_id?: string | null
          signer_user_id?: string | null
          template_id: string
          tenant_id: string
          typed_name: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          method?: string
          pdf_path?: string | null
          person_id?: string
          signed_at?: string
          signer_person_id?: string | null
          signer_user_id?: string | null
          template_id?: string
          tenant_id?: string
          typed_name?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "signatures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "signatures_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "signatures_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "signatures_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "signatures_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "signatures_tenant_id_signer_person_id_fkey"
            columns: ["tenant_id", "signer_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "signatures_tenant_id_signer_person_id_fkey"
            columns: ["tenant_id", "signer_person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "signatures_tenant_id_signer_person_id_fkey"
            columns: ["tenant_id", "signer_person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "signatures_tenant_id_signer_person_id_fkey"
            columns: ["tenant_id", "signer_person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "signatures_tenant_id_template_id_fkey"
            columns: ["tenant_id", "template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "signatures_tenant_id_template_id_fkey"
            columns: ["tenant_id", "template_id"]
            isOneToOne: false
            referencedRelation: "v_required_documents"
            referencedColumns: ["tenant_id", "template_id"]
          },
        ]
      }
      skill_signoffs: {
        Row: {
          by_user_id: string | null
          created_at: string
          enrollment_id: string
          id: string
          notes: string | null
          score: number | null
          signed_off_at: string
          skill_id: string
          source: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          by_user_id?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          notes?: string | null
          score?: number | null
          signed_off_at?: string
          skill_id: string
          source?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          by_user_id?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          notes?: string | null
          score?: number | null
          signed_off_at?: string
          skill_id?: string
          source?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_signoffs_tenant_id_enrollment_id_fkey"
            columns: ["tenant_id", "enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "skill_signoffs_tenant_id_enrollment_id_fkey"
            columns: ["tenant_id", "enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_progress"
            referencedColumns: ["tenant_id", "enrollment_id"]
          },
          {
            foreignKeyName: "skill_signoffs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_signoffs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "skill_signoffs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "skill_signoffs_tenant_id_skill_id_fkey"
            columns: ["tenant_id", "skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      skills: {
        Row: {
          archived_at: string | null
          category: string
          created_at: string
          description: string
          id: string
          name: string
          program_id: string | null
          rubric: Json
          sort: number
          tenant_id: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          archived_at?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          program_id?: string | null
          rubric?: Json
          sort?: number
          tenant_id: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          archived_at?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          program_id?: string | null
          rubric?: Json
          sort?: number
          tenant_id?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skills_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skills_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "skills_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "skills_tenant_id_program_id_fkey"
            columns: ["tenant_id", "program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      staff_certifications: {
        Row: {
          created_at: string
          document_id: string | null
          expires_at: string | null
          id: string
          issued_at: string | null
          issuer: string | null
          kind: string
          number: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          issuer?: string | null
          kind: string
          number?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          issuer?: string | null
          kind?: string
          number?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_certifications_tenant_id_document_id_fkey"
            columns: ["tenant_id", "document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "staff_certifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_certifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "staff_certifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role_id: string
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_id: string
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_id?: string
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "staff_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "staff_invitations_tenant_id_role_id_fkey"
            columns: ["tenant_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      stripe_awards: {
        Row: {
          awarded_at: string
          awarded_by_user_id: string | null
          created_at: string
          enrollment_id: string
          id: string
          note: string | null
          rank_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          awarded_at?: string
          awarded_by_user_id?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          note?: string | null
          rank_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          awarded_at?: string
          awarded_by_user_id?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          note?: string | null
          rank_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_awards_tenant_id_enrollment_id_fkey"
            columns: ["tenant_id", "enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "stripe_awards_tenant_id_enrollment_id_fkey"
            columns: ["tenant_id", "enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_progress"
            referencedColumns: ["tenant_id", "enrollment_id"]
          },
          {
            foreignKeyName: "stripe_awards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_awards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "stripe_awards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "stripe_awards_tenant_id_rank_id_fkey"
            columns: ["tenant_id", "rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          account_id: string | null
          created_at: string
          error: string | null
          id: string
          livemode: boolean
          payload: Json
          processed_at: string | null
          type: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          error?: string | null
          id: string
          livemode?: boolean
          payload: Json
          processed_at?: string | null
          type: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          livemode?: boolean
          payload?: Json
          processed_at?: string | null
          type?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean
          contact: Json
          created_at: string
          id: string
          name: string
          notes: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact?: Json
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact?: Json
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_user_id: string | null
          body: string | null
          created_at: string
          created_by: string | null
          data: Json
          done_at: string | null
          done_by: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          person_id: string | null
          related_id: string | null
          related_type: string | null
          source: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_user_id?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          done_at?: string | null
          done_by?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          person_id?: string | null
          related_id?: string | null
          related_type?: string | null
          source?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_user_id?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          done_at?: string | null
          done_by?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          person_id?: string | null
          related_id?: string | null
          related_type?: string | null
          source?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_lead_id_fkey"
            columns: ["tenant_id", "lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          applies_to: string[]
          created_at: string
          id: string
          location_id: string | null
          name: string
          rate: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          applies_to?: string[]
          created_at?: string
          id?: string
          location_id?: string | null
          name: string
          rate: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          applies_to?: string[]
          created_at?: string
          id?: string
          location_id?: string | null
          name?: string
          rate?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tax_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tax_rates_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      tenant_counters: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenant_domains: {
        Row: {
          created_at: string
          host: string
          id: string
          tenant_id: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          host: string
          id?: string
          tenant_id: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          host?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenant_entitlements: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          module_key: string
          source: string
          starts_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          module_key: string
          source: string
          starts_at?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          module_key?: string
          source?: string
          starts_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_entitlements_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "tenant_entitlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_entitlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_entitlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_key: string | null
          seats: number
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_key?: string | null
          seats?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_key?: string | null
          seats?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string | null
          location_ids: string[] | null
          role_id: string
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          location_ids?: string[] | null
          role_id: string
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          location_ids?: string[] | null
          role_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_users_tenant_id_role_id_fkey"
            columns: ["tenant_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tenant_users_user_profile_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          branding: Json
          created_at: string
          currency: string
          id: string
          locale: string
          name: string
          onboarding: Json
          settings: Json
          slug: string
          status: string
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean
          terminology: Json
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          currency?: string
          id?: string
          locale?: string
          name: string
          onboarding?: Json
          settings?: Json
          slug: string
          status?: string
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean
          terminology?: Json
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          branding?: Json
          created_at?: string
          currency?: string
          id?: string
          locale?: string
          name?: string
          onboarding?: Json
          settings?: Json
          slug?: string
          status?: string
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean
          terminology?: Json
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      terminal_readers: {
        Row: {
          created_at: string
          id: string
          label: string
          location_id: string | null
          stripe_reader_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          location_id?: string | null
          stripe_reader_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          location_id?: string | null
          stripe_reader_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "terminal_readers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terminal_readers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "terminal_readers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "terminal_readers_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      testing_events: {
        Row: {
          capacity: number | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          fee_cents: number
          id: string
          judges: string[]
          location_id: string | null
          name: string
          notes: string | null
          program_ids: string[]
          registration_deadline: string | null
          starts_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          fee_cents?: number
          id?: string
          judges?: string[]
          location_id?: string | null
          name: string
          notes?: string | null
          program_ids?: string[]
          registration_deadline?: string | null
          starts_at: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          fee_cents?: number
          id?: string
          judges?: string[]
          location_id?: string | null
          name?: string
          notes?: string | null
          program_ids?: string[]
          registration_deadline?: string | null
          starts_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testing_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testing_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testing_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testing_events_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      testing_registrations: {
        Row: {
          created_at: string
          eligibility_snapshot: Json
          enrollment_id: string
          id: string
          invited_at: string | null
          invoice_id: string | null
          override_reason: string | null
          person_id: string
          promotion_id: string | null
          registered_at: string | null
          result_notes: string | null
          status: string
          tenant_id: string
          testing_event_id: string
          to_rank_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          eligibility_snapshot?: Json
          enrollment_id: string
          id?: string
          invited_at?: string | null
          invoice_id?: string | null
          override_reason?: string | null
          person_id: string
          promotion_id?: string | null
          registered_at?: string | null
          result_notes?: string | null
          status?: string
          tenant_id: string
          testing_event_id: string
          to_rank_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          eligibility_snapshot?: Json
          enrollment_id?: string
          id?: string
          invited_at?: string | null
          invoice_id?: string | null
          override_reason?: string | null
          person_id?: string
          promotion_id?: string | null
          registered_at?: string | null
          result_notes?: string | null
          status?: string
          tenant_id?: string
          testing_event_id?: string
          to_rank_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testing_registrations_tenant_id_enrollment_id_fkey"
            columns: ["tenant_id", "enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_enrollment_id_fkey"
            columns: ["tenant_id", "enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_enrollment_progress"
            referencedColumns: ["tenant_id", "enrollment_id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_ar_aging"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_dunning"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_invoice_id_fkey"
            columns: ["tenant_id", "invoice_id"]
            isOneToOne: false
            referencedRelation: "v_revenue_lines"
            referencedColumns: ["tenant_id", "invoice_id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_promotion_id_fkey"
            columns: ["tenant_id", "promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_testing_event_id_fkey"
            columns: ["tenant_id", "testing_event_id"]
            isOneToOne: false
            referencedRelation: "testing_events"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "testing_registrations_tenant_id_to_rank_id_fkey"
            columns: ["tenant_id", "to_rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      testing_scores: {
        Row: {
          comments: string | null
          created_at: string
          id: string
          judge_user_id: string
          registration_id: string
          result: string | null
          scores: Json
          tenant_id: string
          total: number | null
          updated_at: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          id?: string
          judge_user_id: string
          registration_id: string
          result?: string | null
          scores?: Json
          tenant_id: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          id?: string
          judge_user_id?: string
          registration_id?: string
          result?: string | null
          scores?: Json
          tenant_id?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testing_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testing_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testing_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "testing_scores_tenant_id_registration_id_fkey"
            columns: ["tenant_id", "registration_id"]
            isOneToOne: false
            referencedRelation: "testing_registrations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      thread_messages: {
        Row: {
          attachments: Json
          body: string
          communication_id: string | null
          created_at: string
          from_staff: boolean
          id: string
          read_by: Json
          sender_person_id: string | null
          sender_user_id: string | null
          tenant_id: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          body: string
          communication_id?: string | null
          created_at?: string
          from_staff: boolean
          id?: string
          read_by?: Json
          sender_person_id?: string | null
          sender_user_id?: string | null
          tenant_id: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          body?: string
          communication_id?: string | null
          created_at?: string
          from_staff?: boolean
          id?: string
          read_by?: Json
          sender_person_id?: string | null
          sender_user_id?: string | null
          tenant_id?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_tenant_id_communication_id_fkey"
            columns: ["tenant_id", "communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "thread_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "thread_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "thread_messages_tenant_id_sender_person_id_fkey"
            columns: ["tenant_id", "sender_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "thread_messages_tenant_id_sender_person_id_fkey"
            columns: ["tenant_id", "sender_person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "thread_messages_tenant_id_sender_person_id_fkey"
            columns: ["tenant_id", "sender_person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "thread_messages_tenant_id_sender_person_id_fkey"
            columns: ["tenant_id", "sender_person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "thread_messages_tenant_id_thread_id_fkey"
            columns: ["tenant_id", "thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          endpoint_id: string
          event: string
          id: string
          last_error: string | null
          next_attempt_at: string | null
          payload: Json
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          endpoint_id: string
          event: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          payload: Json
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          endpoint_id?: string
          event?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string | null
          payload?: Json
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_tenant_id_endpoint_id_fkey"
            columns: ["tenant_id", "endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "webhook_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "webhook_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          id: string
          secret: string
          tenant_id: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          secret: string
          tenant_id: string
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          secret?: string
          tenant_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_endpoints_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "webhook_endpoints_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
    }
    Views: {
      v_ar_aging: {
        Row: {
          balance_cents: number | null
          bucket: string | null
          days_overdue: number | null
          due_at: string | null
          dunning_stage: number | null
          household_id: string | null
          household_name: string | null
          invoice_id: string | null
          number: number | null
          status: string | null
          tenant_id: string | null
          total_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
        ]
      }
      v_attendance_by_class: {
        Row: {
          attendances: number | null
          class_name: string | null
          sessions: number | null
          tenant_id: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      v_attendance_velocity: {
        Row: {
          classes_30d: number | null
          classes_prev_30d: number | null
          last_attended_at: string | null
          person_id: string | null
          streak_weeks: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      v_class_roster: {
        Row: {
          allergies: string[] | null
          attendance_source: string | null
          attended: boolean | null
          belt_color: string | null
          booking_status: string | null
          checked_in_at: string | null
          display_name: string | null
          dob: string | null
          enrollment_id: string | null
          first_name: string | null
          injury_flags: string[] | null
          is_extra: boolean | null
          last_name: string | null
          person_id: string | null
          person_status: string | null
          photo_path: string | null
          rank_name: string | null
          session_id: string | null
          stripes: number | null
          stripes_max: number | null
          tenant_id: string | null
          waitlist_position: number | null
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      v_current_consents: {
        Row: {
          granted: boolean | null
          granted_at: string | null
          guardian_person_id: string | null
          kind: string | null
          method: string | null
          person_id: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "consents_tenant_id_guardian_person_id_fkey"
            columns: ["tenant_id", "guardian_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "consents_tenant_id_guardian_person_id_fkey"
            columns: ["tenant_id", "guardian_person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "consents_tenant_id_guardian_person_id_fkey"
            columns: ["tenant_id", "guardian_person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "consents_tenant_id_guardian_person_id_fkey"
            columns: ["tenant_id", "guardian_person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "consents_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "consents_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "consents_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "consents_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      v_deferred_revenue: {
        Row: {
          amount_cents: number | null
          as_of: string | null
          deferred_cents: number | null
          household_id: string | null
          membership_id: string | null
          months: number | null
          person_id: string | null
          plan_name: string | null
          starts_at: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      v_dunning: {
        Row: {
          balance_cents: number | null
          due_at: string | null
          failed_on: string | null
          household_id: string | null
          household_name: string | null
          invoice_id: string | null
          last_error: string | null
          membership_id: string | null
          membership_status: string | null
          next_step_on: string | null
          number: number | null
          stage: number | null
          status: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "v_deferred_revenue"
            referencedColumns: ["tenant_id", "membership_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "v_membership_mrr"
            referencedColumns: ["tenant_id", "membership_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "v_mrr"
            referencedColumns: ["tenant_id", "membership_id"]
          },
        ]
      }
      v_enrollment_progress: {
        Row: {
          classes_since_promotion: number | null
          current_belt_color: string | null
          current_position: number | null
          current_rank_id: string | null
          current_rank_name: string | null
          days_since_promotion: number | null
          enrollment_id: string | null
          instructor_approved: boolean | null
          last_promoted_at: string | null
          min_classes: number | null
          min_days: number | null
          next_belt_color: string | null
          next_rank_id: string | null
          next_rank_name: string | null
          next_testing_fee_cents: number | null
          person_id: string | null
          program_id: string | null
          required_skills: number | null
          requires_instructor_approval: boolean | null
          signed_required_skills: number | null
          started_at: string | null
          status: string | null
          stripes: number | null
          stripes_max: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_program_id_fkey"
            columns: ["tenant_id", "program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      v_gear_fulfilments: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          household_id: string | null
          household_name: string | null
          id: string | null
          membership_id: string | null
          notes: string | null
          person_id: string | null
          person_name: string | null
          plan_name: string | null
          sizes: Json | null
          status: string | null
          tenant_id: string | null
          variant_ids: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "gear_fulfilments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "v_deferred_revenue"
            referencedColumns: ["tenant_id", "membership_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "v_membership_mrr"
            referencedColumns: ["tenant_id", "membership_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_membership_id_fkey"
            columns: ["tenant_id", "membership_id"]
            isOneToOne: false
            referencedRelation: "v_mrr"
            referencedColumns: ["tenant_id", "membership_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "gear_fulfilments_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      v_household_balance: {
        Row: {
          credit_cents: number | null
          household_id: string | null
          name: string | null
          open_cents: number | null
          past_due_cents: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "households_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "households_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "households_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      v_inventory: {
        Row: {
          available: number | null
          barcode: string | null
          category: string | null
          location_id: string | null
          location_name: string | null
          low: boolean | null
          on_hand: number | null
          options: Json | null
          price_cents: number | null
          product_id: string | null
          product_name: string | null
          reorder_point: number | null
          reserved: number | null
          sku: string | null
          tenant_id: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "product_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      v_invoice_activity: {
        Row: {
          amount_cents: number | null
          at: string | null
          credit_note_number: number | null
          invoice_id: string | null
          kind: string | null
          method: string | null
          note: string | null
          payment_id: string | null
          payment_status: string | null
          tenant_id: string | null
        }
        Relationships: []
      }
      v_member_roster: {
        Row: {
          classes_30d: number | null
          display_name: string | null
          dob: string | null
          email: string | null
          first_name: string | null
          households: string | null
          last_attended_at: string | null
          last_name: string | null
          person_id: string | null
          phone: string | null
          programs: string | null
          status: string | null
          tags: string[] | null
          tenant_id: string | null
        }
        Insert: {
          classes_30d?: never
          display_name?: never
          dob?: string | null
          email?: string | null
          first_name?: string | null
          households?: never
          last_attended_at?: never
          last_name?: string | null
          person_id?: string | null
          phone?: string | null
          programs?: never
          status?: string | null
          tags?: string[] | null
          tenant_id?: string | null
        }
        Update: {
          classes_30d?: never
          display_name?: never
          dob?: string | null
          email?: string | null
          first_name?: string | null
          households?: never
          last_attended_at?: never
          last_name?: string | null
          person_id?: string | null
          phone?: string | null
          programs?: never
          status?: string | null
          tags?: string[] | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      v_membership_mrr: {
        Row: {
          ended_on: string | null
          household_id: string | null
          membership_id: string | null
          mrr_cents: number | null
          paused_on: string | null
          person_id: string | null
          plan_name: string | null
          starts_at: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      v_mrr: {
        Row: {
          household_id: string | null
          membership_id: string | null
          mrr_cents: number | null
          person_id: string | null
          plan_name: string | null
          program_ids: string[] | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_attendance_velocity"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_member_roster"
            referencedColumns: ["tenant_id", "person_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_person_id_fkey"
            columns: ["tenant_id", "person_id"]
            isOneToOne: false
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      v_mrr_monthly: {
        Row: {
          churned_mrr_cents: number | null
          memberships: number | null
          month: string | null
          mrr_cents: number | null
          new_mrr_cents: number | null
          tenant_id: string | null
        }
        Relationships: []
      }
      v_owner_dashboard: {
        Row: {
          active_students: number | null
          attendance_last_week: number | null
          attendance_last_week_to_date: number | null
          attendance_this_week: number | null
          classes_today: number | null
          leads: number | null
          tenant_id: string | null
          trials: number | null
          unread_threads: number | null
          unsigned_documents: number | null
        }
        Relationships: []
      }
      v_payments_ledger: {
        Row: {
          amount_cents: number | null
          at: string | null
          household_id: string | null
          household_name: string | null
          invoice_number: number | null
          kind: string | null
          method: string | null
          on_date: string | null
          payment_id: string | null
          reference: string | null
          refund_id: string | null
          stripe_payment_intent_id: string | null
          tenant_id: string | null
        }
        Relationships: []
      }
      v_people_search: {
        Row: {
          allergies: string[] | null
          display_name: string | null
          dob: string | null
          email: string | null
          first_name: string | null
          household_id: string | null
          household_names: string[] | null
          id: string | null
          injury_flags: string[] | null
          last_name: string | null
          phone: string | null
          photo_path: string | null
          preferred_name: string | null
          search_text: string | null
          status: string | null
          tags: string[] | null
          tenant_id: string | null
          type_flags: string[] | null
        }
        Insert: {
          allergies?: string[] | null
          display_name?: never
          dob?: string | null
          email?: string | null
          first_name?: string | null
          household_id?: never
          household_names?: never
          id?: string | null
          injury_flags?: string[] | null
          last_name?: string | null
          phone?: string | null
          photo_path?: string | null
          preferred_name?: string | null
          search_text?: never
          status?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          type_flags?: string[] | null
        }
        Update: {
          allergies?: string[] | null
          display_name?: never
          dob?: string | null
          email?: string | null
          first_name?: string | null
          household_id?: never
          household_names?: never
          id?: string | null
          injury_flags?: string[] | null
          last_name?: string | null
          phone?: string | null
          photo_path?: string | null
          preferred_name?: string | null
          search_text?: never
          status?: string | null
          tags?: string[] | null
          tenant_id?: string | null
          type_flags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "people_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      v_required_documents: {
        Row: {
          dob: string | null
          kind: string | null
          pdf_path: string | null
          person_id: string | null
          person_name: string | null
          signature_id: string | null
          signed_at: string | null
          signed_older_version: boolean | null
          template_id: string | null
          template_name: string | null
          tenant_id: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "document_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      v_revenue_lines: {
        Row: {
          category: string | null
          description: string | null
          gl_class: string | null
          household_id: string | null
          invoice_id: string | null
          issued_at: string | null
          issued_on: string | null
          kind: string | null
          line_id: string | null
          month: string | null
          net_cents: number | null
          number: number | null
          quantity: number | null
          source: string | null
          tax_cents: number | null
          tenant_id: string | null
          total_cents: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "v_household_balance"
            referencedColumns: ["tenant_id", "household_id"]
          },
        ]
      }
      v_session_stats: {
        Row: {
          attended: number | null
          booked: number | null
          session_id: string | null
          tenant_id: string | null
          waitlisted: number | null
        }
        Insert: {
          attended?: never
          booked?: never
          session_id?: string | null
          tenant_id?: string | null
          waitlisted?: never
        }
        Update: {
          attended?: never
          booked?: never
          session_id?: string | null
          tenant_id?: string | null
          waitlisted?: never
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      v_upcoming_for_person: {
        Row: {
          bookable: boolean | null
          booking_id: string | null
          booking_status: string | null
          cancellation_window_min: number | null
          capacity: number | null
          ends_at: string | null
          location_id: string | null
          name: string | null
          person_id: string | null
          session_id: string | null
          starts_at: string | null
          status: string | null
          taken: number | null
          tenant_id: string | null
          waitlist_position: number | null
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_mrr_monthly"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "v_owner_dashboard"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "class_sessions_tenant_id_location_id_fkey"
            columns: ["tenant_id", "location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
    }
    Functions: {
      add_household_person: {
        Args: { m: Json; p_household_id: string }
        Returns: string
      }
      add_invoice_line: {
        Args: {
          p_description: string
          p_invoice_id: string
          p_kind: string
          p_quantity: number
          p_unit_cents: number
        }
        Returns: string
      }
      adjust_inventory: {
        Args: {
          p_delta: number
          p_location_id: string
          p_note?: string
          p_reason: string
          p_variant_id: string
        }
        Returns: string
      }
      apply_credit: {
        Args: { p_amount_cents?: number; p_invoice_id: string }
        Returns: string
      }
      audit_export: {
        Args: { p_entity: string; p_rows: number }
        Returns: undefined
      }
      automation_evaluate: {
        Args: { p_tenant_id: string; p_today: string }
        Returns: number
      }
      automation_notify: {
        Args: {
          p_channels: string[]
          p_data: Json
          p_person_ids: string[]
          p_run_id: string
          p_template_key: string
          p_tenant_id: string
        }
        Returns: number
      }
      award_stripe: {
        Args: { p_enrollment_id: string; p_note?: string }
        Returns: number
      }
      billing_lifecycle: {
        Args: { p_tenant_id: string; p_today: string }
        Returns: Json
      }
      billing_run_invoice: {
        Args: { p: Json; p_tenant_id: string }
        Returns: string
      }
      book_lead_trial: {
        Args: { p_lead_id: string; p_session_id: string }
        Returns: string
      }
      book_session: {
        Args: {
          p_person_id: string
          p_session_id: string
          p_source?: string
          p_use_credit?: boolean
        }
        Returns: {
          booking_id: string
          status: string
          waitlist_position: number
        }[]
      }
      bulk_promote: {
        Args: { p_event_id: string; p_registration_ids: string[] }
        Returns: {
          promotion_id: string
          registration_id: string
        }[]
      }
      cancel_booking: {
        Args: { p_booking_id: string }
        Returns: {
          credit_id: string
          promoted_booking_id: string
          promoted_person_id: string
        }[]
      }
      complete_signature_request: {
        Args: {
          p_ip: string
          p_token: string
          p_typed_name: string
          p_user_agent: string
        }
        Returns: string
      }
      create_household: { Args: { p: Json }; Returns: string }
      create_tenant: {
        Args: { p_name: string; p_slug: string; p_timezone: string }
        Returns: string
      }
      dunning_notify: {
        Args: {
          p_channels: string[]
          p_data: Json
          p_invoice_id: string
          p_person_ids: string[]
          p_template_key: string
          p_tenant_id: string
        }
        Returns: number
      }
      enroll_membership: { Args: { p: Json }; Returns: Json }
      export_table_names: {
        Args: never
        Returns: {
          table_name: string
        }[]
      }
      kiosk_check_in: {
        Args: {
          p_household_id: string
          p_items: Json
          p_pin: string
          p_token: string
        }
        Returns: number
      }
      kiosk_check_in_confirmed: {
        Args: { p_household_id: string; p_items: Json; p_token: string }
        Returns: number
      }
      kiosk_family: {
        Args: { p_person_id: string; p_token: string }
        Returns: {
          display_name: string
          has_pin: boolean
          household_id: string
          household_name: string
          locked_until: string
          person_id: string
        }[]
      }
      kiosk_info: {
        Args: { p_token: string }
        Returns: {
          confirm_mode: string
          device_name: string
          location_name: string
          tenant_name: string
          time_zone: string
        }[]
      }
      kiosk_search: {
        Args: { p_q: string; p_token: string }
        Returns: {
          display_name: string
          household_name: string
          person_id: string
        }[]
      }
      kiosk_sessions: {
        Args: { p_person_ids: string[]; p_token: string }
        Returns: {
          already_in: boolean
          ends_at: string
          name: string
          person_id: string
          session_id: string
          starts_at: string
          suggested: boolean
        }[]
      }
      kiosk_unlock: {
        Args: { p_household_id: string; p_pin: string; p_token: string }
        Returns: {
          attempts_left: number
          locked_until: string
          ok: boolean
        }[]
      }
      kiosk_unsigned: {
        Args: { p_person_ids: string[]; p_token: string }
        Returns: {
          person_id: string
          template_name: string
        }[]
      }
      mark_payment_method_detached: {
        Args: { p_payment_method_id: string }
        Returns: undefined
      }
      mark_thread_read: { Args: { p_thread_id: string }; Returns: undefined }
      message_recipients: {
        Args: { p_person_ids: string[] }
        Returns: {
          email: string
          email_consent: boolean
          first_name: string
          household_id: string
          last_name: string
          person_id: string
          phone: string
          recipient_person_id: string
          sms_consent: boolean
        }[]
      }
      my_household_ids: { Args: never; Returns: string[] }
      my_person_id: { Args: never; Returns: string }
      next_invoice_number: { Args: never; Returns: number }
      next_invoice_number_for: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      pos_add_tender: {
        Args: {
          p_amount_cents: number
          p_method: string
          p_payment_id?: string
          p_sale_id: string
          p_tendered_cents?: number
        }
        Returns: Json
      }
      pos_cancel_sale: { Args: { p_sale_id: string }; Returns: undefined }
      pos_close_drawer: {
        Args: { p_counted_cents: number; p_drawer_id: string }
        Returns: Json
      }
      pos_drawer_expected: { Args: { p_drawer_id: string }; Returns: number }
      pos_open_drawer: {
        Args: { p_location_id: string; p_opening_cents: number }
        Returns: string
      }
      pos_open_sale: { Args: { p: Json }; Returns: Json }
      pos_return: { Args: { p: Json }; Returns: Json }
      promote: {
        Args: {
          p_enrollment_id: string
          p_reason?: string
          p_testing_event_id?: string
          p_to_rank_id: string
        }
        Returns: string
      }
      public_trial_info: { Args: { p_slug: string }; Returns: Json }
      publish_document: {
        Args: {
          p_body: string
          p_kind: string
          p_name: string
          p_required_for: Json
        }
        Returns: string
      }
      record_charge_refund_for: {
        Args: { p_charge: Json; p_tenant_id: string }
        Returns: string
      }
      record_communication: { Args: { p: Json }; Returns: string }
      record_manual_payment: {
        Args: {
          p_amount_cents: number
          p_invoice_id: string
          p_memo?: string
          p_method: string
        }
        Returns: string
      }
      record_payment_intent: { Args: { p_pi: Json }; Returns: string }
      record_payment_intent_for: {
        Args: { p_pi: Json; p_tenant_id: string }
        Returns: string
      }
      record_payment_method: {
        Args: { p_household_id: string; p_pm: Json }
        Returns: string
      }
      record_payment_method_for: {
        Args: { p_household_id: string; p_pm: Json; p_tenant_id: string }
        Returns: string
      }
      record_refund: {
        Args: {
          p_amount_cents: number
          p_as_credit?: boolean
          p_payment_id: string
          p_reason: string
          p_stripe_refund_id?: string
        }
        Returns: string
      }
      register_for_testing: {
        Args: { p_registration_id: string }
        Returns: string
      }
      reorder_ranks: {
        Args: { p_program_id: string; p_rank_ids: string[] }
        Returns: undefined
      }
      request_membership_hold: {
        Args: {
          p_from: string
          p_membership_id: string
          p_reason: string
          p_until: string
        }
        Returns: string
      }
      segment_preview: {
        Args: { p_channel: string; p_definition: Json }
        Returns: Json
      }
      send_broadcast: { Args: { p_campaign_id: string }; Returns: number }
      session_taken: { Args: { p_session_id: string }; Returns: number }
      set_default_payment_method: {
        Args: { p_payment_method_id: string }
        Returns: undefined
      }
      set_household_pin: {
        Args: { p_household_id: string; p_pin: string }
        Returns: undefined
      }
      set_household_stripe_customer: {
        Args: { p_customer_id: string; p_household_id: string }
        Returns: undefined
      }
      set_membership_autopay: {
        Args: {
          p_enabled: boolean
          p_membership_id: string
          p_payment_method_id?: string
        }
        Returns: undefined
      }
      set_reorder_point: {
        Args: {
          p_location_id: string
          p_reorder_point: number
          p_variant_id: string
        }
        Returns: undefined
      }
      sign_off_skill: {
        Args: {
          p_enrollment_id: string
          p_notes?: string
          p_score?: number
          p_skill_id: string
          p_source?: string
        }
        Returns: string
      }
      signature_request_info: {
        Args: { p_token: string }
        Returns: {
          body: string
          expired: boolean
          person_name: string
          request_id: string
          signer_name: string
          template_name: string
          tenant_name: string
          used: boolean
          version: number
        }[]
      }
      submit_trial_request: { Args: { p: Json; p_slug: string }; Returns: Json }
      switch_tenant: { Args: { p_tenant_id: string }; Returns: undefined }
      void_invoice: {
        Args: { p_invoice_id: string; p_reason: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

