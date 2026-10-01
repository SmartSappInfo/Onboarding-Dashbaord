
'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import type { Activity } from './types';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
import { canUser } from './workspace-permissions';
import { getActivitiesForContactCore } from './crm/activity-core';

/**
 * SECURITY (N1): note activities can only be changed by their author, inside a workspace the author
 * still belongs to. These used to rely on Firestore rules, which the Admin SDK bypasses, so any
 * signed-in user could edit or delete any activity.
 */
async function loadOwnNoteActivity(activityId: string): Promise<FirebaseFirestore.DocumentReference | null> {
  const { uid } = await requireAuth();
  const ref = adminDb.collection('activities').doc(activityId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const owner: unknown = snap.data()?.userId;
  const workspaceId: unknown = snap.data()?.workspaceId;
  if (owner !== uid || typeof workspaceId !== 'string' || !workspaceId) return null;
  await requireWorkspace(workspaceId);
  return ref;
}

/**
 * Updates the content of a specific note activity.
 * @param activityId The ID of the activity (note) to update.
 * @param newContent The new content for the note.
 */
export async function updateNote(activityId: string, newContent: string) {
  if (!activityId || !newContent.trim()) {
    return { error: 'Invalid input provided.' };
  }

  try {
    const ref = await loadOwnNoteActivity(activityId);
    if (!ref) return { error: 'You do not have permission to edit this note or it does not exist.' };
    await ref.update({
      'metadata.content': newContent,
      timestamp: new Date().toISOString(), // Also update the timestamp to reflect the edit time
    });
    revalidatePath('/admin/entities'); // Revalidate to show updated note
    return { success: true };
  } catch (error) {
    console.error('Failed to update note:', error);
    // In a real app, you might check error.code for 'permission-denied'
    return { error: 'You do not have permission to edit this note or it does not exist.' };
  }
}

/**
 * Deletes a specific note activity.
 * @param activityId The ID of the activity (note) to delete.
 */
export async function deleteNote(activityId: string) {
  if (!activityId) {
    return { error: 'Activity ID is required.' };
  }

  try {
    const ref = await loadOwnNoteActivity(activityId);
    if (!ref) return { error: 'You do not have permission to delete this note or it does not exist.' };
    await ref.delete();
    revalidatePath('/admin/entities'); // Revalidate to remove the note from the UI
    return { success: true };
  } catch (error) {
    console.error('Failed to delete note:', error);
    return { error: 'You do not have permission to delete this note or it does not exist.' };
  }
}

/**
 * Server Action entry point — a public HTTP endpoint, so it authenticates its caller and
 * scopes to the workspace being read (audit F2).
 */
export async function getActivitiesForContact(
    entityId: string,
    workspaceId: string,
    limit: number = 50
): Promise<Activity[]> {
  // SECURITY (N1): workspace membership plus permission to view contacts there.
  const { uid } = await requireWorkspace(workspaceId);
  const permission = await canUser(uid, 'operations', 'campuses', 'view', workspaceId);
  if (!permission.granted) return [];
  return getActivitiesForContactCore(entityId, workspaceId, limit);
}
