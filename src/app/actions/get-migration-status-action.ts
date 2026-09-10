'use server';

import { adminDb } from '@/lib/firebase-admin';
import { SystemMigrationLog } from '@/lib/types';
import { authorizeBackofficeSession } from '@/lib/backoffice/backoffice-auth';
import { getErrorMessage } from '@/lib/errors/report-error';

/**
 * Fetches the status and logs of a specific migration
 */
export async function getMigrationStatusAction(migrationId: string): Promise<{
  success: boolean;
  log?: SystemMigrationLog;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints. This platform
  // migration was reachable unauthenticated. Identity and permission are resolved
  // server-side from the session; the caller supplies neither.
  await authorizeBackofficeSession('operations', 'view');

  try {
    const docRef = adminDb.collection('system_migrations').doc(migrationId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { success: true, log: undefined };
    }

    return { 
      success: true, 
      log: { id: docSnap.id, ...docSnap.data() } as SystemMigrationLog 
    };
  } catch (error: unknown) {
    console.error(`[getMigrationStatusAction] Error fetching ${migrationId}:`, error);
    return { success: false, error: getErrorMessage(error) || 'Failed to fetch migration status' };
  }
}
