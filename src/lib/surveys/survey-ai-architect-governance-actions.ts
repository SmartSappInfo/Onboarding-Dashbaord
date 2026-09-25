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
import { requireSystemAdmin } from '@/lib/auth/require-auth';
import { toClientErrorMessage } from '@/lib/errors/report-error';
import {
  type SystemAiArchitectGovernanceConfig,
  DEFAULT_AI_ARCHITECT_GOVERNANCE_CONFIG,
  SystemAiArchitectGovernanceUpdateSchema,
} from './survey-ai-architect-governance-types';

export type { SystemAiArchitectGovernanceConfig };

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
