/**
 * @fileOverview Activity read core (agents_mcp PR-1 / N1).
 *
 * WHY THIS FILE IS NOT `'use server'`: `getActivitiesForContactCore` trusts its `workspaceId`. It
 * used to be exported from `activity-actions.ts` (a `'use server'` module), so anyone could read
 * any contact's timeline. Callers must already have authorized the caller for `workspaceId`: the
 * session wrapper `getActivitiesForContact` and the token-authenticated `/api/activities` route.
 */
import { adminDb } from '@/lib/firebase-admin';
import type { Activity } from '@/lib/types';

/** Activities of one contact in one workspace, newest first. */
export async function getActivitiesForContactCore(
  entityId: string,
  workspaceId: string,
  limit: number = 50
): Promise<Activity[]> {
  try {
    if (!entityId || !workspaceId) return [];

    const snapshot = await adminDb
      .collection('activities')
      .where('workspaceId', '==', workspaceId)
      .where('entityId', '==', entityId)
      .orderBy('timestamp', 'desc')
      .limit(Math.min(Math.max(1, limit), 200))
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Activity[];
  } catch (error: unknown) {
    console.error('[ACTIVITY] Failed to query activities for contact:', error);
    return [];
  }
}
