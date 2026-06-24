'use server';

import { requireSystemAdmin } from '@/lib/auth/require-org-admin';
import { backfillSenderOrg, type BackfillMode, type BackfillReport } from '@/lib/migrations/backfill-sender-org';

export interface BackfillSenderOrgResult {
  success: boolean;
  report?: BackfillReport;
  error?: string;
}

/**
 * Run the sender-profile organization backfill (Phase 1 of org-sender-isolation).
 *
 * Cross-tenant migration → requires a platform system admin. Defaults to a
 * non-destructive dry-run; pass `mode: 'apply'` only after reviewing the
 * dry-run report (no ambiguous/orphan active profiles, every active org has a
 * default).
 */
export async function backfillSenderOrgAction(
  idToken: string,
  mode: BackfillMode = 'dry-run',
): Promise<BackfillSenderOrgResult> {
  try {
    await requireSystemAdmin(idToken);
    const report = await backfillSenderOrg(mode);
    return { success: true, report };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during sender-org backfill.';
    console.error('[BACKFILL_SENDER_ORG] failed:', message);
    return { success: false, error: message };
  }
}
