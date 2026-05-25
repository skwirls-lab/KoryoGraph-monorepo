# @repo/ai-core

AI feature abstraction layer for KoryoGraph - enables graceful degradation when AI is unavailable.

## Design Principle: "AI-Optional, Core-Mandatory"

Every AI feature has a fallback behavior that works without AI. This ensures:
- **Graceful degradation** when AI endpoints are unavailable
- **No breaking changes** to existing workflows  
- **Clear separation** between core and enhancement code paths

## Available Services

| Service | Purpose | Fallback Behavior |
|---------|---------|-------------------|
| `ClassTranscriptionService` | Post-class audio processing | Empty arrays for manual logging |
| `AICurriculumBuilderService` | Lesson plan generation | Template-based lesson plans |
| `VisionMasterService` | Biomechanical video analysis | Manual skill evaluation |
| `MagicInventoryReceiverService` | Packing slip image processing | Manual inventory entry |
| `GenerativeDashboardsService` | Natural language chart queries | Pre-defined dashboard widgets |
| `DeskAiAssistantService` | RAG chatbot for desk | Canned responses |
| `DriftDetectorService` | Churn prediction | Manual at-risk student review |
| `BillingRecoveryService` | Empathetic payment recovery | Standard payment reminder templates |
| `DojangBotService` | RAG chatbot for home app | FAQ-based canned responses |
| `CurriculumTranslatorService` | Technical to parent-speak translation | Plain text version |
| `FrictionlessSalesService` | Personalized product recommendations | Standard catalog link |

## Usage Example

```typescript
import { ClassTranscriptionService, FeatureFlagsUtility } from "@repo/ai-core";

// Create service with feature flags
const transcriptionService = new ClassTranscriptionService(flags);

// Execute with automatic fallback
const result = await FeatureFlagsUtility.executeWithFallback(
  transcriptionService,
  { audioUrl: "https://...", classDate: "2026-05-25" }
);

// Result will come from AI if enabled + API key configured,
// otherwise from fallback behavior
```

## Environment Variables

Set these in your `.env.local`:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
CLASS_TRANSCRIPTION_ENABLED=false  # Set to true when ready
CURRICULUM_BUILDER_ENABLED=false   # Set to true when ready
# ... and other feature flags
```

## Status

- ✅ TypeScript definitions complete
- ⏳ AI API integrations (TODO - Phase 2+)
- ✅ Fallback behaviors implemented
