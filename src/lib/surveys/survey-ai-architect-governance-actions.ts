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

import { adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/auth/require-auth';
import { toClientErrorMessage } from '@/lib/errors/report-error';

export interface SystemAiArchitectGovernanceConfig {
  maxFileUploadSizeMb: number;
  maxPdfPagesLimit: number;
  maxSourceCharacterLimit: number;
  defaultModelTier: 'fast' | 'flagship';
  enablePromptPolishCopilot: boolean;
  enabledArchetypeIds: string[];
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_AI_ARCHITECT_GOVERNANCE_CONFIG: SystemAiArchitectGovernanceConfig = {
  maxFileUploadSizeMb: 10,
  maxPdfPagesLimit: 20,
  maxSourceCharacterLimit: 25000,
  defaultModelTier: 'fast',
  enablePromptPolishCopilot: true,
  enabledArchetypeIds: ['csat_nps', 'pulse_360', 'scored_quiz', 'pmf_survey', 'event_feedback', 'lead_intake'],
};

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
 */
export async function saveSystemAiArchitectGovernanceAction(
  config: Partial<SystemAiArchitectGovernanceConfig>
): Promise<{
  success: boolean;
  error?: string;
}> {
  const authUser = await requireAuth();

  try {
    const docRef = adminDb.collection('system_settings').doc('survey_ai_architect_governance');
    const payload: Partial<SystemAiArchitectGovernanceConfig> = {
      ...config,
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
