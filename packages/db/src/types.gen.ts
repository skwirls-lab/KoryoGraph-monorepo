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
        ]
      }
      certificate_templates: {
        Row: {
          background_path: string | null
          created_at: string
          id: string
          layout: Json
          name: string
          signature_path: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          background_path?: string | null
          created_at?: string
          id?: string
          layout?: Json
          name: string
          signature_path?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          background_path?: string | null
          created_at?: string
          id?: string
          layout?: Json
          name?: string
          signature_path?: string | null
          tenant_id?: string
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
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
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
            foreignKeyName: "household_members_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
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
            foreignKeyName: "kiosk_pins_tenant_id_household_id_fkey"
            columns: ["tenant_id", "household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["tenant_id", "id"]
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
            referencedRelation: "v_people_search"
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
            referencedRelation: "v_people_search"
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
            foreignKeyName: "ranks_tenant_id_program_id_fkey"
            columns: ["tenant_id", "program_id"]
            isOneToOne: false
            referencedRelation: "programs"
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
            foreignKeyName: "skills_tenant_id_program_id_fkey"
            columns: ["tenant_id", "program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["tenant_id", "id"]
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
            foreignKeyName: "stripe_awards_tenant_id_rank_id_fkey"
            columns: ["tenant_id", "rank_id"]
            isOneToOne: false
            referencedRelation: "ranks"
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
            foreignKeyName: "tenant_users_tenant_id_role_id_fkey"
            columns: ["tenant_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["tenant_id", "id"]
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
        ]
      }
    }
    Views: {
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
            referencedRelation: "v_people_search"
            referencedColumns: ["tenant_id", "id"]
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
        ]
      }
    }
    Functions: {
      add_household_person: {
        Args: { m: Json; p_household_id: string }
        Returns: string
      }
      audit_export: {
        Args: { p_entity: string; p_rows: number }
        Returns: undefined
      }
      award_stripe: {
        Args: { p_enrollment_id: string; p_note?: string }
        Returns: number
      }
      create_household: { Args: { p: Json }; Returns: string }
      create_tenant: {
        Args: { p_name: string; p_slug: string; p_timezone: string }
        Returns: string
      }
      promote: {
        Args: {
          p_enrollment_id: string
          p_reason?: string
          p_testing_event_id?: string
          p_to_rank_id: string
        }
        Returns: string
      }
      reorder_ranks: {
        Args: { p_program_id: string; p_rank_ids: string[] }
        Returns: undefined
      }
      set_household_pin: {
        Args: { p_household_id: string; p_pin: string }
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
      switch_tenant: { Args: { p_tenant_id: string }; Returns: undefined }
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

