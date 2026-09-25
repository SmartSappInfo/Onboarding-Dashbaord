'use server';

/**
 * @fileoverview SmartSapp Survey Intelligence 2.0 — Backoffice AI Survey Architect Governance Server Actions
 *
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Control Plane Governance: Allows superadmins to manage client extraction guardrails, default model tier,
 *    and enabled archetype starter chips without requiring code deployment.
 * 2. Security: Enforces authentication via `requireAuth()` and wraps errors with `toClientErrorMessage`.
 * 3. Strict Zero-Any Invariant: Completely typed schema interfaces and error handling.
 */

import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { requireSystemAdmin } from '@/lib/auth/require-auth';
import { toClientErrorMessage } from '@/lib/errors/report-error';

export interface SystemAiArchitectGovernanceConfig {
  maxFileUploadSizeMb: number;
  maxImageUploadSizeMb: number;
  maxPdfPagesLimit: number;
  maxSpreadsheetRows: number;
  maxPresentationSlides: number;
  maxSourceCharacterLimit: number;
  defaultModelTier: 'fast' | 'flagship';
  imageVisionMode: 'multimodal' | 'ocr_fallback';
  enablePromptPolishCopilot: boolean;
  enabledArchetypeIds: string[];
  allowedFileTypes: string[];
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_AI_ARCHITECT_GOVERNANCE_CONFIG: SystemAiArchitectGovernanceConfig = {
  maxFileUploadSizeMb: 10,
  maxImageUploadSizeMb: 5,
  maxPdfPagesLimit: 20,
  maxSpreadsheetRows: 500,
  maxPresentationSlides: 30,
  maxSourceCharacterLimit: 25000,
  defaultModelTier: 'fast',
  imageVisionMode: 'multimodal',
  enablePromptPolishCopilot: true,
  enabledArchetypeIds: ['csat_nps', 'pulse_360', 'scored_quiz', 'pmf_survey', 'event_feedback', 'lead_intake'],
  allowedFileTypes: ['pdf', 'docx', 'doc', 'image', 'xlsx', 'xls', 'pptx', 'ppt', 'text', 'markdown', 'csv', 'json'],
};

/**
 * Zod validation schema for updating global architect governance parameters.
 * Prevents out-of-bounds numbers that would cause browser OOMs or LLM token burn.
 */
export const SystemAiArchitectGovernanceUpdateSchema = z.object({
  maxFileUploadSizeMb: z.number().int().min(1).max(50).optional(),
  maxImageUploadSizeMb: z.number().int().min(1).max(20).optional(),
  maxPdfPagesLimit: z.number().int().min(1).max(100).optional(),
  maxSpreadsheetRows: z.number().int().min(50).max(5000).optional(),
  maxPresentationSlides: z.number().int().min(5).max(100).optional(),
  maxSourceCharacterLimit: z.number().int().min(1000).max(100000).optional(),
  defaultModelTier: z.enum(['fast', 'flagship']).optional(),
  imageVisionMode: z.enum(['multimodal', 'ocr_fallback']).optional(),
  enablePromptPolishCopilot: z.boolean().optional(),
  enabledArchetypeIds: z.array(z.string().regex(/^[a-z0-9_-]+$/)).max(20).optional(),
  allowedFileTypes: z.array(z.string()).max(20).optional(),
});

/**
 * Retrieves the global AI Survey Architect governance configuration.
 */
export async function getSystemAiArchitectGovernanceAction(): Promise<{
  success: boolean;
  config: SystemAiArchitectGovernanceConfig;
  error?: string;
}> {
  try {
    const docRef = adminDb.collection('system_settings').doc('survey_ai_architect_governance');
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      return {
        success: true,
        config: {
          ...DEFAULT_AI_ARCHITECT_GOVERNANCE_CONFIG,
          ...data,
        } as SystemAiArchitectGovernanceConfig,
      };
    }

    return {
      success: true,
      config: DEFAULT_AI_ARCHITECT_GOVERNANCE_CONFIG,
    };
  } catch (err: unknown) {
    console.error('[survey-ai-architect-governance-actions] getSystemAiArchitectGovernanceAction error:', err);
    return {
      success: false,
      config: DEFAULT_AI_ARCHITECT_GOVERNANCE_CONFIG,
      error: toClientErrorMessage(
        'surveys.survey-ai-architect-governance',
        err,
        undefined,
        'Failed to load AI architect governance config'
      ),
    };
  }
}

/**
 * Saves the global AI Survey Architect governance configuration.
 * Strictly gated to platform system administrators.
 */
export async function saveSystemAiArchitectGovernanceAction(
  config: Partial<SystemAiArchitectGovernanceConfig>
): Promise<{
  success: boolean;
  error?: string;
}> {
  const authUser = await requireSystemAdmin();

  const parseResult = SystemAiArchitectGovernanceUpdateSchema.safeParse(config);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return {
      success: false,
      error: `Invalid governance parameters: ${errorDetails}`,
    };
  }

  try {
    const docRef = adminDb.collection('system_settings').doc('survey_ai_architect_governance');
    const payload: Partial<SystemAiArchitectGovernanceConfig> = {
      ...parseResult.data,
      updatedAt: new Date().toISOString(),
      updatedBy: authUser.profile?.email || authUser.uid,
    };

    await docRef.set(payload, { merge: true });

    return { success: true };
  } catch (err: unknown) {
    console.error('[survey-ai-architect-governance-actions] saveSystemAiArchitectGovernanceAction error:', err);
    return {
      success: false,
      error: toClientErrorMessage(
        'surveys.survey-ai-architect-governance',
        err,
        undefined,
        'Failed to save AI architect governance config'
      ),
    };
  }
}
