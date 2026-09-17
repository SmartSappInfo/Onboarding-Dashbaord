'use server';

import { runVariablesFERMigration, type FERMigrationResult } from '@/lib/migrations/migrate-variables-fer';

export interface ExecuteFERMigrationParams {
  dryRun?: boolean;
  workspaceId?: string;
  organizationId?: string;
}

/**
 * Server action to execute the Fetch, Enrich, Restore (FER) Protocol
 * across message templates and custom fields in Firestore.
 */
export async function executeVariablesFERMigrationAction(
  params?: ExecuteFERMigrationParams
): Promise<FERMigrationResult> {
  try {
    return await runVariablesFERMigration({
      dryRun: params?.dryRun ?? false,
      workspaceId: params?.workspaceId,
      organizationId: params?.organizationId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during FER migration';
    console.error('[executeVariablesFERMigrationAction] Error:', error);
    return {
      success: false,
      dryRun: params?.dryRun ?? false,
      templatesScanned: 0,
      templatesMigrated: 0,
      fieldsScanned: 0,
      fieldsArchived: 0,
      details: [],
    };
  }
}
