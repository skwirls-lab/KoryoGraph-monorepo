/**
 * KoryoGraph AI Core - Feature Abstraction Layer
 * 
 * This package provides a unified interface for all AI features with
 * built-in graceful degradation when AI endpoints are unavailable.
 * 
 * Design Principle: "AI-Optional, Core-Mandatory"
 * Every feature has a fallback behavior that works without AI.
 */

import type { FeatureFlags } from "@repo/types";

// ─────────────────────────────────────────────────────────────
// 1. BASE AI SERVICE INTERFACE
// ─────────────────────────────────────────────────────────────

/**
 * Base interface for all AI services
 * All implementations must provide both AI and fallback methods
 */
export interface AIService {
  /** Whether this service is currently enabled */
  isEnabled(): boolean;

  /** Check if API key is configured */
  hasApiKey(): boolean;

  /** Execute the AI operation with any parameters */
  executeAI(params: Record<string, unknown>): Promise<unknown>;

  /** Fallback behavior when AI is unavailable */
  fallback(params: Record<string, unknown>): Promise<unknown>;

  /** Get status information */
  getStatus(): {
    enabled: boolean;
    hasApiKey: boolean;
    lastError?: Error;
  };
}

// ─────────────────────────────────────────────────────────────
// 2. CLASS TRANSCRIPTION SERVICE
// ─────────────────────────────────────────────────────────────

/**
 * ClassTranscriptionService handles post-class audio processing
 * 
 * AI Path: Extracts attendance and skill notes from transcript
 * Fallback: Manual attendance logging UI
 */
export class ClassTranscriptionService implements AIService {
  private flags: FeatureFlags;
  private model: string;

  constructor(flags: FeatureFlags, model: string = "gemini-2.0-flash-exp") {
    this.flags = flags;
    this.model = model;
  }

  isEnabled(): boolean {
    return this.flags.classTranscriptionEnabled;
  }

  hasApiKey(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!key && key.length > 0;
  }

  async executeAI(params: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement Gemini Vision API call for transcript analysis
    throw new Error("Class transcription AI not yet implemented");
  }

  async fallback(params: Record<string, unknown>): Promise<unknown> {
    // Return empty arrays - instructor must manually log attendance
    return {
      attendanceLogs: [],
      skillNotes: [],
    };
  }

  getStatus(): { enabled: boolean; hasApiKey: boolean; lastError?: Error } {
    return {
      enabled: this.isEnabled(),
      hasApiKey: this.hasApiKey(),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 3. AI CURRICULUM BUILDER SERVICE
// ─────────────────────────────────────────────────────────────

/**
 * AICurriculumBuilderService generates lesson plans from prompts
 * 
 * AI Path: Generates curriculum based on instructor prompt
 * Fallback: Returns template-based lesson plan
 */
export class AICurriculumBuilderService implements AIService {
  private flags: FeatureFlags;
  private model: string;

  constructor(flags: FeatureFlags, model: string = "gemini-2.0-flash-exp") {
    this.flags = flags;
    this.model = model;
  }

  isEnabled(): boolean {
    return this.flags.curriculumBuilderEnabled;
  }

  hasApiKey(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!key && key.length > 0;
  }

  async executeAI(params: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement Gemini Text API call for curriculum generation
    throw new Error("AI curriculum builder not yet implemented");
  }

  async fallback(params: Record<string, unknown>): Promise<unknown> {
    // Return a basic template-based lesson plan
    const weeks = (params.weeks as number) ?? 12;
    const basicPlan = Array.from({ length: weeks }, (_, i) => ({
      day: i + 1,
      techniques: ["Warm-up", "Technique Review"],
      drills: ["Partner Drill", "Repetition Practice"],
      formWork: ["Basic Forms"],
      sparringFocus: (i as number) > 4 ? "Light Sparring" : undefined,
    }));

    return { lessonPlan: basicPlan };
  }

  getStatus(): { enabled: boolean; hasApiKey: boolean; lastError?: Error } {
    return {
      enabled: this.isEnabled(),
      hasApiKey: this.hasApiKey(),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 4. VISION MASTER SERVICE (Biomechanical Analysis)
// ─────────────────────────────────────────────────────────────

/**
 * VisionMasterService performs biomechanical video analysis
 * 
 * AI Path: Compares student video to gold standard, returns accuracy score
 * Fallback: Manual skill evaluation with instructor notes
 */
export class VisionMasterService implements AIService {
  private flags: FeatureFlags;
  private model: string;

  constructor(flags: FeatureFlags, model: string = "gemini-2.0-flash-exp") {
    this.flags = flags;
    this.model = model;
  }

  isEnabled(): boolean {
    return this.flags.visionMasterEnabled;
  }

  hasApiKey(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!key && key.length > 0;
  }

  async executeAI(params: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement Gemini Vision API call for biomechanical analysis
    throw new Error("Vision Master AI not yet implemented");
  }

  async fallback(params: Record<string, unknown>): Promise<unknown> {
    // Return null values - instructor must manually evaluate
    return {};
  }

  getStatus(): { enabled: boolean; hasApiKey: boolean; lastError?: Error } {
    return {
      enabled: this.isEnabled(),
      hasApiKey: this.hasApiKey(),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 5. MAGIC INVENTORY RECEIVER SERVICE
// ─────────────────────────────────────────────────────────────

/**
 * MagicInventoryReceiverService processes packing slip images
 * 
 * AI Path: Extracts SKUs, quantities, sizes from image
 * Fallback: Manual inventory entry UI
 */
export class MagicInventoryReceiverService implements AIService {
  private flags: FeatureFlags;
  private model: string;

  constructor(flags: FeatureFlags, model: string = "gemini-2.0-flash-exp") {
    this.flags = flags;
    this.model = model;
  }

  isEnabled(): boolean {
    return this.flags.magicInventoryEnabled;
  }

  hasApiKey(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!key && key.length > 0;
  }

  async executeAI(params: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement Gemini Vision API call for document analysis
    throw new Error("Magic Inventory Receiver AI not yet implemented");
  }

  async fallback(params: Record<string, unknown>): Promise<unknown> {
    // Return empty array - admin must manually enter inventory
    return { extractedItems: [] };
  }

  getStatus(): { enabled: boolean; hasApiKey: boolean; lastError?: Error } {
    return {
      enabled: this.isEnabled(),
      hasApiKey: this.hasApiKey(),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 6. GENERATIVE DASHBOARDS SERVICE
// ─────────────────────────────────────────────────────────────

/**
 * GenerativeDashboardsService creates charts from natural language queries
 * 
 * AI Path: Translates query to SQL, renders appropriate chart
 * Fallback: Returns pre-defined dashboard widgets
 */
export class GenerativeDashboardsService implements AIService {
  private flags: FeatureFlags;
  private model: string;

  constructor(flags: FeatureFlags, model: string = "gemini-2.0-flash-exp") {
    this.flags = flags;
    this.model = model;
  }

  isEnabled(): boolean {
    return this.flags.genDashboardsEnabled;
  }

  hasApiKey(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!key && key.length > 0;
  }

  async executeAI(params: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement Gemini Text API call for query-to-SQL translation
    throw new Error("Generative dashboards AI not yet implemented");
  }

  async fallback(params: Record<string, unknown>): Promise<unknown> {
    // Return a default table view with no data
    return {
      chartType: "table",
      sqlQuery: undefined,
      dataPoints: [],
    };
  }

  getStatus(): { enabled: boolean; hasApiKey: boolean; lastError?: Error } {
    return {
      enabled: this.isEnabled(),
      hasApiKey: this.hasApiKey(),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 7. DESK AI ASSISTANT (RAG Chatbot) SERVICE
// ─────────────────────────────────────────────────────────────

/**
 * DeskAiAssistantService provides RAG-based chatbot for desk
 * 
 * AI Path: Retrieves relevant docs, answers questions about studio
 * Fallback: Returns canned responses or "I don't know"
 */
export class DeskAiAssistantService implements AIService {
  private flags: FeatureFlags;
  private model: string;

  constructor(
    flags: FeatureFlags,
    model: string = "gemini-2.0-flash-exp",
    vectorStore?: any
  ) {
    this.flags = flags;
    this.model = model;
    this.vectorStore = vectorStore;
  }

  private vectorStore?: any;

  isEnabled(): boolean {
    return this.flags.deskAiAssistantEnabled && this.flags.chatbotRagEnabled;
  }

  hasApiKey(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!key && key.length > 0;
  }

  async executeAI(params: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement RAG chatbot with pgvector
    throw new Error("Desk AI Assistant not yet implemented");
  }

  async fallback(params: Record<string, unknown>): Promise<unknown> {
    return {
      answer: "I'm here to help! For questions about our studio policies, curriculum, or scheduling, please contact the front desk directly.",
      sources: [],
    };
  }

  getStatus(): { enabled: boolean; hasApiKey: boolean; lastError?: Error } {
    return {
      enabled: this.isEnabled(),
      hasApiKey: this.hasApiKey(),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 8. DRIFT DETECTOR SERVICE (Churn Prediction)
// ─────────────────────────────────────────────────────────────

/**
 * DriftDetectorService predicts student churn risk and drafts re-engagement messages
 * 
 * AI Path: Analyzes attendance patterns, drafts personalized SMS
 * Fallback: Returns null - admin must manually identify at-risk students
 */
export class DriftDetectorService implements AIService {
  private flags: FeatureFlags;
  private model: string;

  constructor(flags: FeatureFlags, model: string = "gemini-2.0-flash-exp") {
    this.flags = flags;
    this.model = model;
  }

  isEnabled(): boolean {
    return this.flags.driftDetectorEnabled;
  }

  hasApiKey(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!key && key.length > 0;
  }

  async executeAI(params: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement churn prediction AI
    throw new Error("Drift Detector AI not yet implemented");
  }

  async fallback(params: Record<string, unknown>): Promise<unknown> {
    // Return null - admin must manually review
    return {};
  }

  getStatus(): { enabled: boolean; hasApiKey: boolean; lastError?: Error } {
    return {
      enabled: this.isEnabled(),
      hasApiKey: this.hasApiKey(),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 9. BILLING RECOVERY SERVICE (Empathetic SMS)
// ─────────────────────────────────────────────────────────────

/**
 * BillingRecoveryService handles failed payment recovery via empathetic SMS
 * 
 * AI Path: Drafts tone-adjusted message based on customer tenure
 * Fallback: Returns standard payment reminder template
 */
export class BillingRecoveryService implements AIService {
  private flags: FeatureFlags;
  private model: string;

  constructor(flags: FeatureFlags, model: string = "gemini-2.0-flash-exp") {
    this.flags = flags;
    this.model = model;
  }

  isEnabled(): boolean {
    return this.flags.billingRecoveryEnabled;
  }

  hasApiKey(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!key && key.length > 0;
  }

  async executeAI(params: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement empathetic billing recovery AI
    throw new Error("Billing Recovery AI not yet implemented");
  }

  async fallback(params: Record<string, unknown>): Promise<unknown> {
    // Return standard template based on tenure
    const customerTenureMonths = (params.customerTenureMonths as number) ?? 0;
    const daysOverdue = (params.daysOverdue as number) ?? 0;
    const isVeteran = customerTenureMonths > 12;
    const tone = daysOverdue > 7 ? "urgent" : isVeteran ? "relaxed" : "neutral";

    return {
      message: `Hi there! We noticed your payment is ${daysOverdue} days overdue. Please update your payment method to avoid service interruption.`,
      tone,
    };
  }

  getStatus(): { enabled: boolean; hasApiKey: boolean; lastError?: Error } {
    return {
      enabled: this.isEnabled(),
      hasApiKey: this.hasApiKey(),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 10. DOJANG BOT SERVICE (Home AI Assistant)
// ─────────────────────────────────────────────────────────────

/**
 * DojangBotService provides RAG-based chatbot for home app
 * 
 * AI Path: Answers parent/student questions about studio
 * Fallback: Returns canned responses
 */
export class DojangBotService implements AIService {
  private flags: FeatureFlags;
  private model: string;

  constructor(
    flags: FeatureFlags,
    model: string = "gemini-2.0-flash-exp",
    vectorStore?: any
  ) {
    this.flags = flags;
    this.model = model;
    this.vectorStore = vectorStore;
  }

  private vectorStore?: any;

  isEnabled(): boolean {
    return this.flags.dojangBotEnabled && this.flags.chatbotRagEnabled;
  }

  hasApiKey(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!key && key.length > 0;
  }

  async executeAI(params: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement RAG chatbot with pgvector
    throw new Error("Dojang Bot not yet implemented");
  }

  async fallback(params: Record<string, unknown>): Promise<unknown> {
    return {
      answer: "Welcome to KoryoGraph Home! For questions about class schedules, curriculum, or studio policies, please check our FAQ section or contact the front desk.",
      sources: [],
    };
  }

  getStatus(): { enabled: boolean; hasApiKey: boolean; lastError?: Error } {
    return {
      enabled: this.isEnabled(),
      hasApiKey: this.hasApiKey(),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 11. CURRICULUM TRANSLATOR SERVICE
// ─────────────────────────────────────────────────────────────

/**
 * CurriculumTranslatorService converts technical mat-data to parent-speak
 * 
 * AI Path: Translates instructor notes into encouraging updates for parents
 * Fallback: Returns plain text version of technical data
 */
export class CurriculumTranslatorService implements AIService {
  private flags: FeatureFlags;
  private model: string;

  constructor(flags: FeatureFlags, model: string = "gemini-2.0-flash-exp") {
    this.flags = flags;
    this.model = model;
  }

  isEnabled(): boolean {
    return this.flags.curriculumTranslatorEnabled;
  }

  hasApiKey(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!key && key.length > 0;
  }

  async executeAI(params: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement translation AI
    throw new Error("Curriculum Translator AI not yet implemented");
  }

  async fallback(params: Record<string, unknown>): Promise<unknown> {
    // Return plain text version
    const technicalNotes = (params.technicalNotes as string) ?? "";
    const studentName = (params.studentName as string) ?? "Student";

    return {
      parentFriendlyMessage: `${studentName}'s recent progress:\n\n${technicalNotes}`,
      encouragement: "Keep up the great work!",
    };
  }

  getStatus(): { enabled: boolean; hasApiKey: boolean; lastError?: Error } {
    return {
      enabled: this.isEnabled(),
      hasApiKey: this.hasApiKey(),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 12. FRICITIONLESS SALES SERVICE
// ─────────────────────────────────────────────────────────────

/**
 * FrictionlessSalesService generates SMS URLs for trials and gear sales
 * 
 * AI Path: Personalized product recommendations via chat
 * Fallback: Returns standard product catalog link
 */
export class FrictionlessSalesService implements AIService {
  private flags: FeatureFlags;
  private model: string;

  constructor(flags: FeatureFlags, model: string = "gemini-2.0-flash-exp") {
    this.flags = flags;
    this.model = model;
  }

  isEnabled(): boolean {
    return this.flags.frictionlessSalesEnabled;
  }

  hasApiKey(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!key && key.length > 0;
  }

  async executeAI(params: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement personalized recommendation AI
    throw new Error("Frictionless Sales AI not yet implemented");
  }

  async fallback(params: Record<string, unknown>): Promise<unknown> {
    // Return standard catalog link
    return {
      smsUrl: "https://koryograph.ai/shop",
      recommendedProducts: [],
    };
  }

  getStatus(): { enabled: boolean; hasApiKey: boolean; lastError?: Error } {
    return {
      enabled: this.isEnabled(),
      hasApiKey: this.hasApiKey(),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 13. FEATURE FLAGS UTILITY
// ─────────────────────────────────────────────────────────────

/**
 * FeatureFlagsUtility provides helper functions for feature flag management
 */
export class FeatureFlagsUtility {
  /**
   * Safely execute an AI operation with automatic fallback
   * @param service The AI service to use
   * @param params Parameters for the operation
   * @returns Result from either AI or fallback
   */
  static async executeWithFallback<T extends AIService>(
    service: T,
    params: Record<string, unknown>
  ): Promise<unknown> {
    if (!service.isEnabled()) {
      console.log("[AI Core] Feature disabled, using fallback");
      return (service as any).fallback(params);
    }

    if (!service.hasApiKey()) {
      console.log("[AI Core] API key not configured, using fallback");
      return (service as any).fallback(params);
    }

    try {
      console.log("[AI Core] Executing AI operation");
      const result = await (service as AIService).executeAI(params);
      return result;
    } catch (error) {
      console.error("[AI Core] AI operation failed, using fallback:", error);
      return (service as any).fallback(params);
    }
  }

  /**
   * Check if any AI feature is enabled
   */
  static hasAnyAIEnabled(flags: FeatureFlags): boolean {
    const aiFeatures = [
      flags.classTranscriptionEnabled,
      flags.curriculumBuilderEnabled,
      flags.visionMasterEnabled,
      flags.magicInventoryEnabled,
      flags.genDashboardsEnabled,
      flags.deskAiAssistantEnabled,
      flags.driftDetectorEnabled,
      flags.billingRecoveryEnabled,
      flags.dojangBotEnabled,
      flags.curriculumTranslatorEnabled,
      flags.frictionlessSalesEnabled,
    ];
    return aiFeatures.some((enabled) => enabled);
  }

  /**
   * Get list of enabled AI features
   */
  static getEnabledFeatures(flags: FeatureFlags): string[] {
    const featureNames = [
      "Class Transcription",
      "Curriculum Builder",
      "Vision Master",
      "Magic Inventory Receiver",
      "Generative Dashboards",
      "Desk AI Assistant",
      "Drift Detector",
      "Billing Recovery",
      "Dojang Bot",
      "Curriculum Translator",
      "Frictionless Sales",
    ];

    return featureNames.filter((_, i) => (flags[featureNames[i].toLowerCase().replace(/\s+/g, "")] as boolean) ?? false);
  }
}

// ─────────────────────────────────────────────────────────────
// 14. EXPORT ALL SERVICES
// ─────────────────────────────────────────────────────────────

export {
  ClassTranscriptionService,
  AICurriculumBuilderService,
  VisionMasterService,
  MagicInventoryReceiverService,
  GenerativeDashboardsService,
  DeskAiAssistantService,
  DriftDetectorService,
  BillingRecoveryService,
  DojangBotService,
  CurriculumTranslatorService,
  FrictionlessSalesService,
  FeatureFlagsUtility,
};
