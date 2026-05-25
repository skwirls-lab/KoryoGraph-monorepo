/**
 * KoryoGraph Shared Types
 * 
 * Core type definitions used across all apps for consistency.
 * These types represent the fundamental data structures of the platform.
 */

// ─────────────────────────────────────────────────────────────
// 1. USER & IDENTITY TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Profile represents a user in the system (student, parent, instructor, admin)
 */
export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone_number?: string;
  avatar_url?: string;
  tenant_id?: string;
  role_id?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * UserRoles maps users to roles within a tenant
 */
export interface UserRole {
  user_id: string;
  role_id: string;
  tenant_id?: string;
  created_at?: string;
}

/**
 * Role defines permissions and access levels
 */
export interface Role {
  id: string;
  label: string;
  description?: string;
}

/**
 * Family represents a guardian-student relationship for billing
 */
export interface Family {
  id: string;
  guardian_id: string;
  tenant_id: string;
  created_at: string;
  updated_at?: string;
}

/**
 * FamilyMember links a profile to a family unit
 */
export interface FamilyMember {
  id: string;
  family_id: string;
  profile_id: string;
  role: 'student' | 'guardian';
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// 2. PROGRAM & CURRICULUM TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Program represents a martial arts discipline (Taekwondo, Hapkido, etc.)
 */
export interface Program {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

/**
 * CurriculumRank represents a belt/grade level within a program
 */
export interface CurriculumRank {
  id: string;
  program_id: string;
  rank_name: string;      // e.g., "White Belt", "1st Dan"
  rank_level: number;     // e.g., 0 for white, 1-9 for dan levels
  belt_color?: string;    // e.g., "#f1f5f9" for white belt
  stripe_count?: number;  // Number of stripes for colored belts
  description?: string;
  created_at: string;
}

/**
 * Skill represents a technique or competency to track
 */
export interface Skill {
  id: string;
  program_id: string;
  rank_id: string;        // Skills are tied to specific ranks
  name: string;           // e.g., "Roundhouse Kick"
  category: string;       // e.g., "Kick", "Punch", "Form"
  description?: string;
  created_at: string;
}

/**
 * StudentProgression tracks a student's active status in a program/rank
 */
export interface StudentProgression {
  id: string;
  student_id: string;
  program_id: string;
  rank_id: string;
  current_rank_level?: number;
  is_active: boolean;
  enrolled_at?: string;
  created_at: string;
}

/**
 * SkillEvaluation tracks completion/assessment of a skill
 */
export interface SkillEvaluation {
  id: string;
  student_id: string;
  skill_id: string;
  evaluated_by?: string;  // Instructor ID
  class_id?: string;
  class_date?: string;
  passed: boolean;
  accuracy_score?: number;    // 0-100, from Vision Master
  actionable_tip?: string;    // AI-generated feedback
  source: 'manual' | 'vision_master' | 'ai_transcript';
  notes?: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// 3. CLASS & ATTENDANCE TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Class represents a scheduled martial arts session
 */
export interface Class {
  id: string;
  tenant_id: string;
  location_id?: string;
  program_id?: string;
  instructor_id?: string;
  name: string;           // e.g., "Little Tigers (Ages 4-6)"
  day_of_week: string[];  // ["Monday", "Wednesday"]
  start_time: string;     // HH:mm format
  end_time: string;       // HH:mm format
  capacity?: number;
  is_active: boolean;
  created_at: string;
}

/**
 * AttendanceLog records student attendance at a class
 */
export interface AttendanceLog {
  id: string;
  class_id: string;
  student_id: string;
  class_date: string;     // YYYY-MM-DD format
  checked_in_at?: string;
  checked_in_by?: string; // Instructor who tapped
  source: 'manual' | 'ai_transcript' | 'kiosk';
  notes?: string;
}

/**
 * ClassTranscript stores audio and AI-processed class data
 */
export interface ClassTranscript {
  id: string;
  class_id: string;
  class_date: string;
  instructor_id: string;
  audio_file_url?: string;
  raw_transcript?: string;
  ai_processed_at?: string;
  action_board_data?: Record<string, any>; // AI-extracted attendance + skill notes
  approved_by?: string;
  approved_at?: string;
  status: 'pending' | 'processing' | 'ready' | 'approved';
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// 4. BILLING & SUBSCRIPTION TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Subscription represents a recurring payment plan
 */
export interface Subscription {
  id: string;
  tenant_id: string;
  family_id?: string;
  student_id?: string;
  stripe_subscription_id?: string;
  stripe_price_id?: string;
  status: 'active' | 'past_due' | 'canceled' | 'paused';
  plan_name: string;      // e.g., "Monthly", "Annual"
  amount: number;        // Amount in cents (e.g., 2999 = $29.99)
  billing_interval: 'month' | 'year';
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  created_at: string;
  updated_at?: string;
}

/**
 * Invoice represents a billable amount
 */
export interface Invoice {
  id: string;
  tenant_id: string;
  family_id?: string;
  student_id?: string;
  subscription_id?: string;
  stripe_invoice_id?: string;
  stripe_payment_intent_id?: string;
  amount_due: number;    // Amount in cents
  amount_paid: number;   // Amount in cents
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  description?: string;
  due_date?: string;
  paid_at?: string;
  pdf_url?: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// 5. INVENTORY & POS TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Product represents a retail item (uniforms, gear, weapons)
 */
export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  category: string;      // "Uniforms" | "Gear" | "Weapons" | "Apparel"
  stripe_product_id?: string;
  is_active: boolean;
  created_at: string;
}

/**
 * ProductVariant represents a specific SKU of a product
 */
export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  size?: string;         // e.g., "S", "M", "L"
  color?: string;        // e.g., "Black", "Red"
  price: number;         // Sale price in cents
  cost_basis?: number;   // Cost in cents (for COGS)
  stock_quantity: number;
  low_stock_threshold?: number;
  stripe_price_id?: string;
  created_at: string;
}

/**
 * POSTransaction represents a point-of-sale transaction
 */
export interface POSTransaction {
  id: string;
  tenant_id: string;
  location_id?: string;
  family_id?: string;
  stripe_terminal_id?: string;
  stripe_payment_intent_id?: string;
  total: number;         // Amount in cents
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  line_items?: Array<{
    variant_id: string;
    qty: number;
    unit_price: number;
  }>;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// 6. EVENTS & CAMP TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Event represents a special gathering (camp, tournament, after-school)
 */
export interface Event {
  id: string;
  tenant_id: string;
  location_id?: string;
  name: string;
  event_type: 'after_school' | 'summer_camp' | 'seminar' | 'tournament' | 'special_class';
  description?: string;
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  capacity?: number;
  price?: number;        // Amount in cents
  billing_interval?: 'once' | 'weekly' | 'monthly';
  requires_waiver?: boolean;
  is_active: boolean;
  created_at: string;
}

/**
 * EventRegistration tracks attendance at an event
 */
export interface EventRegistration {
  id: string;
  event_id: string;
  student_id: string;
  guardian_id?: string;
  invoice_id?: string;
  check_in_time?: string;
  check_out_time?: string;
  waiver_signed_at?: string;
  status: 'registered' | 'waitlisted' | 'canceled' | 'attended';
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// 7. BELT TESTING TYPES
// ─────────────────────────────────────────────────────────────

/**
 * BeltTestingEvent represents a belt testing ceremony
 */
export interface BeltTestingEvent {
  id: string;
  tenant_id: string;
  location_id?: string;
  name: string;
  test_date: string;
  registration_deadline?: string;
  fee?: number;          // Amount in cents
  notes?: string;
  created_at: string;
}

/**
 * BeltTestRegistration tracks student registration for belt testing
 */
export interface BeltTestRegistration {
  id: string;
  event_id: string;
  student_id: string;
  target_rank_id: string;
  fee_paid?: boolean;
  invoice_id?: string;
  result: 'pass' | 'fail' | 'pending';
  certificate_url?: string;
  kukkiwon_id?: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// 8. MARKETING & CRM TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Lead represents a potential student
 */
export interface Lead {
  id: string;
  tenant_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  source?: string;       // "Website", "Referral", "Walk-in"
  status: 'new' | 'contacted' | 'qualified' | 'trial_booked' | 'converted' | 'lost';
  notes?: string;
  created_at: string;
}

/**
 * CommunicationLog tracks outbound/inbound messages
 */
export interface CommunicationLog {
  id: string;
  tenant_id: string;
  lead_id?: string;
  family_id?: string;
  profile_id?: string;   // For direct messaging
  subject?: string;
  body?: string;
  channel: 'sms' | 'email' | 'in_app';
  direction: 'outbound' | 'inbound';
  status: 'draft' | 'sent' | 'delivered' | 'failed';
  created_at?: string;
  sent_at?: string;
  delivered_at?: string;
}

// ─────────────────────────────────────────────────────────────
// 9. WAIVERS TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Waiver represents a legal document template
 */
export interface Waiver {
  id: string;
  tenant_id: string;
  name: string;          // e.g., "Liability Waiver"
  content_html: string;  // HTML content of the waiver
  version: number;
  is_active: boolean;
  created_at: string;
}

/**
 * WaiverSignature tracks when a user signed a waiver
 */
export interface WaiverSignature {
  id: string;
  waiver_id: string;
  profile_id: string;
  signed_by_guardian_id?: string;
  signature_data?: string; // base64 or docusign reference
  signed_at: string;
  ip_address?: string;
}

// ─────────────────────────────────────────────────────────────
// 10. MESSAGING TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Message represents a direct message between users
 */
export interface Message {
  id: string;
  tenant_id: string;
  sender_id?: string;
  recipient_id: string;
  subject?: string;
  body: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// 11. TENANCY TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Tenant represents a martial arts studio
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;          // e.g., "koryo-martial-arts"
  logo_url?: string;
  primary_color?: string;
  subscription_tier: 'starter' | 'growth' | 'elite';
  stripe_customer_id?: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Location represents a physical studio branch
 */
export interface Location {
  id: string;
  tenant_id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  timezone?: string;
  is_active: boolean;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// 12. AI FEATURE CONFIG TYPES
// ─────────────────────────────────────────────────────────────

/**
 * AIConfig defines whether an AI feature is enabled and its settings
 */
export interface AIConfig {
  enabled: boolean;
  model?: string;        // e.g., "gemini-2.0-flash-exp"
  fallbackBehavior?: () => void;
}

/**
 * FeatureFlags represents all AI feature flags for an app
 */
export interface FeatureFlags {
  geminiApiKey?: string;
  classTranscriptionEnabled: boolean;
  curriculumBuilderEnabled: boolean;
  visionMasterEnabled: boolean;
  magicInventoryEnabled: boolean;
  genDashboardsEnabled: boolean;
  deskAiAssistantEnabled: boolean;
  driftDetectorEnabled: boolean;
  billingRecoveryEnabled: boolean;
  frictionlessSalesEnabled: boolean;
  dojangBotEnabled: boolean;
  curriculumTranslatorEnabled: boolean;
}

// ─────────────────────────────────────────────────────────────
// 13. UTILITY TYPES
// ─────────────────────────────────────────────────────────────

/**
 * TenantContext provides tenant-aware data for queries
 */
export interface TenantContext {
  tenantId: string;
  locationId?: string;
}

/**
 * AuthenticatedUser represents a logged-in user with metadata
 */
export interface AuthenticatedUser extends Profile {
  email: string;
  aud: string;
  role: string;
  created_at: string;
}

/**
 * Session represents an active authentication session
 */
export interface Session {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_at: number;
  user: AuthenticatedUser;
}
