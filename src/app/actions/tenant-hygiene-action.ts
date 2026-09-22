'use server';

import { requireAuth } from '@/lib/auth/require-auth';
import { requireOrgAdmin } from '@/lib/auth/require-org-admin';
import { runSenderProfileCleansing, type CleanseSummary } from '@/lib/migrations/cleanse-foreign-sender-profiles';

export interface TenantHygieneInput {
  organizationId: string;
  mode: 'dry-run' | 'apply';
}

export interface TenantHygieneResult {
  success: boolean;
  summary?: CleanseSummary;
  error?: string;
}

/**
 * Server Action: Scans or cleanses foreign sender profile contamination across organizations.
 * Accessible to Organization Admins and Super Admins.
 */
export async function runTenantSenderHygieneAction(
  idToken: string,
  input: TenantHygieneInput
): Promise<TenantHygieneResult> {
  await requireAuth();

  try {
    await requireOrgAdmin(idToken, input.organizationId);

    const summary = await runSenderProfileCleansing(input.mode);
    return {
      success: true,
      summary,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown hygiene scan error';
    return {
      success: false,
      error: message,
    };
  }
}
