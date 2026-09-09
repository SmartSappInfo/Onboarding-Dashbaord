/**
 * @fileOverview Core logic for the "seed fields across all workspaces" migration.
 *
 * Deliberately NOT a Server Action. The Server Action wrapper
 * (`src/app/actions/seed-all-workspaces-fields-fer-action.ts`) is a public HTTP
 * endpoint and must authenticate its caller (audit F2), but this same migration is also
 * run from the command line via `pnpm migrate:workspace-fields`, where there is no
 * request and therefore no session to read.
 *
 * Keeping the work here lets the action stay guarded without breaking the CLI: the
 * action resolves a real identity and passes it in, while the CLI passes its own marker.
 * Anything reachable over HTTP goes through the wrapper, never through this module.
 */
import { adminDb } from '@/lib/firebase-admin';
import { seedNativeFieldsAction } from '@/lib/fields-actions';
import type { SystemMigrationLog } from '@/lib/types';

export interface SeedAllWorkspacesFieldsResult {
  success: boolean;
  message: string;
  details?: {
    workspacesScanned: number;
    workspacesSeeded: number;
    failed: number;
    errors: string[];
  };
}

/**
 * @param executedBy Identity recorded on the migration log. Callers must supply a
 *        *verified* id — the Server Action derives it from the session, and the CLI
 *        uses a fixed marker. Never pass a value taken from request input.
 */
export async function seedAllWorkspacesFields(
  executedBy: string
): Promise<SeedAllWorkspacesFieldsResult> {
  const migrationId = 'fer_seed_all_workspaces_fields';
  const now = new Date().toISOString();

  const migrationRef = adminDb.collection('system_migrations').doc(migrationId);
  await migrationRef.set({
    id: migrationId,
    status: 'in_progress',
    lastRunAt: now,
    executedBy,
    summary: 'Restructured fields seeding execution started across all workspaces...',
  } as SystemMigrationLog, { merge: true });

  const stats = {
    workspacesScanned: 0,
    workspacesSeeded: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    const workspacesSnapshot = await adminDb.collection('workspaces').get();
    stats.workspacesScanned = workspacesSnapshot.size;

    for (const wsDoc of workspacesSnapshot.docs) {
      const workspaceId = wsDoc.id;
      const wsData = wsDoc.data();
      const orgId = wsData?.organizationId || 'default';

      try {
        // bypassPermissionCheck = true: the caller has already been authorised (or is
        // the CLI, which runs with Admin SDK credentials by definition).
        await seedNativeFieldsAction(workspaceId, orgId, executedBy, true);
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

    await migrationRef.set({
      id: migrationId,
      status: finalStatus,
      lastRunAt: new Date().toISOString(),
      executedBy,
      summary,
    } as SystemMigrationLog, { merge: true });

    return { success, message: summary, details: stats };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await migrationRef.set({
      id: migrationId,
      status: 'failed',
      lastRunAt: new Date().toISOString(),
      executedBy,
      summary: `Critical migration failure: ${errMsg}`,
    } as SystemMigrationLog, { merge: true });

    return {
      success: false,
      message: `Critical migration failure: ${errMsg}`,
      details: stats,
    };
  }
}
