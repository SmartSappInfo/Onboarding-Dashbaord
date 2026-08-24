'use server';

/**
 * SmartSapp Finance 2.0 - Migration & Parity Server Actions
 * Server actions for data parity checks, bulk ledger backfills, and summary recalibration with canUser RBAC.
 */

import { canUser } from './workspace-permissions';
import { 
  ActionResponse, 
  MigrationParityResult, 
  MigrationProgressPayload, 
  WorkspaceFinancialSummary 
} from './types';
import { FinanceMigrationService } from './services/finance-migration-service';
import { MaterializedSummaryService } from './services/materialized-summary-service';
import { revalidatePath } from 'next/cache';

export async function getMigrationParityStatusAction(
  workspaceId: string,
  userId: string
): Promise<ActionResponse & { parity?: MigrationParityResult }> {
  try {
    const permission = await canUser(userId, 'finance', 'settings', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient viewing permissions.' };
    }

    const parity = await FinanceMigrationService.runParityCheck(workspaceId);
    return { success: true, parity };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to run parity check';
    return { success: false, error: msg };
  }
}

export async function executeFinanceMigrationAction(
  workspaceId: string,
  userId: string,
  userName: string
): Promise<ActionResponse & { progress?: MigrationProgressPayload }> {
  try {
    const permission = await canUser(userId, 'finance', 'settings', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: only finance administrators can execute migrations.' };
    }

    const progress = await FinanceMigrationService.executeMigration(workspaceId, userId, userName);
    revalidatePath('/admin/finance/migration');
    revalidatePath('/admin/finance/reports');
    revalidatePath('/admin/finance/accounts');
    return { success: true, progress };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to execute finance migration';
    return { success: false, error: msg };
  }
}

export async function recalibrateSummaryAction(
  workspaceId: string,
  userId: string
): Promise<ActionResponse & { summary?: WorkspaceFinancialSummary }> {
  try {
    const permission = await canUser(userId, 'finance', 'settings', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient administrative permissions.' };
    }

    const summary = await MaterializedSummaryService.recalibrateWorkspaceSummary(workspaceId);
    revalidatePath('/admin/finance/reports');
    return { success: true, summary };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to recalibrate workspace summary';
    return { success: false, error: msg };
  }
}
