'use server';

import { adminDb } from '@/lib/firebase-admin';
import { SystemMigrationLog } from '@/lib/types';

/**
 * Fetches the status and logs of a specific migration
 */
export async function getMigrationStatusAction(migrationId: string): Promise<{
  success: boolean;
  log?: SystemMigrationLog;
  error?: string;
}> {
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
  } catch (error: any) {
    console.error(`[getMigrationStatusAction] Error fetching ${migrationId}:`, error);
    return { success: false, error: error.message || 'Failed to fetch migration status' };
  }
}
