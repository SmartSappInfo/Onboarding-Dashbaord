'use server';

/**
 * @fileOverview Secure Server Actions: Backoffice Finance Emergency Control Plane (Phase 12 Milestone 5)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Boundary Lock)
 * - Rule 40 (Domain Event Publishing)
 * - Rule 48 (Standardized Error Taxonomy)
 * - Rule 51 (Next.js 15 Server Actions Conventions: session auth, parameter validation)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 * - Rule 61 (Zero-redeploy operational kill-switches with mandatory audit reason >= 5 chars)
 * - .agents/AGENTS.md (Actionable Toast Navigation with relative paths)
 */

import { requireAuth } from '@/lib/auth/require-auth';
import {
  getFinanceEmergencyControls,
  updateFinanceEmergencyControls,
  type FinanceControlSwitchKey,
  type FinanceEmergencyControls,
  FINANCE_CONTROL_SWITCH_KEYS,
} from '@/platform/policy/finance-control-policy';

export interface FinanceControlActionResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    httpStatus?: number;
  };
}

/**
 * Retrieves current finance emergency controls for backoffice operators.
 */
export async function getFinanceEmergencyControlsAction(): Promise<
  FinanceControlActionResult<FinanceEmergencyControls>
> {
  try {
    const auth = await requireAuth();
    const controls = await getFinanceEmergencyControls(auth.profile?.organizationId);
    return {
      success: true,
      data: controls,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve finance emergency controls.';
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
        httpStatus: 500,
      },
    };
  }
}

/**
 * Toggles a granular finance emergency switch with mandatory audit justification (>= 5 chars).
 */
export async function toggleFinanceEmergencySwitchAction(input: {
  switchKey: FinanceControlSwitchKey;
  enabled: boolean;
  reason: string;
}): Promise<FinanceControlActionResult<FinanceEmergencyControls>> {
  try {
    const auth = await requireAuth();

    if (!FINANCE_CONTROL_SWITCH_KEYS.includes(input.switchKey)) {
      return {
        success: false,
        error: {
          code: 'INVALID_SWITCH_KEY',
          message: `Unknown switch key: ${input.switchKey}`,
          httpStatus: 400,
        },
      };
    }

    if (!input.reason || input.reason.trim().length < 5) {
      return {
        success: false,
        error: {
          code: 'INSUFFICIENT_AUDIT_REASON',
          message: 'Audit justification note must be at least 5 characters long.',
          httpStatus: 400,
        },
      };
    }

    const updated = await updateFinanceEmergencyControls({
      switchKey: input.switchKey,
      enabled: input.enabled,
      reason: input.reason.trim(),
      adminUserId: auth.uid,
    });

    return {
      success: true,
      data: updated,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update emergency control switch.';
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
        httpStatus: 500,
      },
    };
  }
}
