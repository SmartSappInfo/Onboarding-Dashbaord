'use server';

import { adminDb } from '@/lib/firebase-admin';
import { seedNativeFieldsAction } from '@/lib/fields-actions';
import type { SystemMigrationLog } from '@/lib/types';

interface FerResult {
  success: boolean;
  message: string;
  details?: {
    workspacesScanned: number;
    workspacesSeeded: number;
    failed: number;
    errors: string[];
  };
}

export async function executeSeedAllWorkspacesFieldsFerAction(userId: string): Promise<FerResult> {
  const migrationId = 'fer_seed_all_workspaces_fields';
  const now = new Date().toISOString();

  // 1. Mark migration state as In Progress
  const migrationRef = adminDb.collection('system_migrations').doc(migrationId);
  await migrationRef.set({
    id: migrationId,
    status: 'in_progress',
    lastRunAt: now,
    executedBy: userId,
    summary: 'Restructured fields seeding execution started across all workspaces...',
  } as SystemMigrationLog, { merge: true });

  const stats = {
    workspacesScanned: 0,
    workspacesSeeded: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // 2. Fetch all active workspaces
    const workspacesSnapshot = await adminDb.collection('workspaces').get();
    stats.workspacesScanned = workspacesSnapshot.size;

    for (const wsDoc of workspacesSnapshot.docs) {
      const workspaceId = wsDoc.id;
      const wsData = wsDoc.data();
      const orgId = wsData?.organizationId || 'default';

      try {
        // Execute seeding with bypassPermissionCheck = true
        await seedNativeFieldsAction(workspaceId, orgId, userId, true);
        stats.workspacesSeeded += 1;
      } catch (err) {
        stats.failed += 1;
        const errMsg = err instanceof Error ? err.message : String(err);
        stats.errors.push(`Workspace ${workspaceId} failed: ${errMsg}`);
      }
    }

    const success = stats.failed === 0;
    const finalStatus = success ? 'completed' : 'failed';
    const summary = success
      ? `Successfully restructured and seeded fields for ${stats.workspacesSeeded} workspaces.`
      : `Restructured fields seeding completed with ${stats.failed} errors.`;

    // 3. Mark migration state as completed
    await migrationRef.set({
      id: migrationId,
      status: finalStatus,
      lastRunAt: new Date().toISOString(),
      executedBy: userId,
      summary,
    } as SystemMigrationLog, { merge: true });

    return {
      success,
      message: summary,
      details: stats,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await migrationRef.set({
      id: migrationId,
      status: 'failed',
      lastRunAt: new Date().toISOString(),
      executedBy: userId,
      summary: `Critical migration failure: ${errMsg}`,
    } as SystemMigrationLog, { merge: true });

    return {
      success: false,
      message: `Critical migration failure: ${errMsg}`,
      details: stats,
    };
  }
}
