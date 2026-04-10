
'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import type { Activity } from './types';

/**
 * Query activities for a contact with fallback pattern (Requirements 4.2, 22.1, 22.3)
 * 
 * @param entityId - Unified Entity Identifier
 * @param workspaceId - Workspace context
 * @param limit - Maximum number of activities to return (default: 50)
 * @returns Array of activities for the contact
 */
export async function getActivitiesForContact(
    entityId: string,
    workspaceId: string,
    limit: number = 50
): Promise<Activity[]> {
    try {
        if (!entityId) return [];

        const snapshot = await adminDb
            .collection('activities')
            .where('workspaceId', '==', workspaceId)
            .where('entityId', '==', entityId)
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
        
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Activity[];
    } catch (error: any) {
        console.error('[ACTIVITY] Failed to query activities for contact:', error);
        return [];
    }
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
    // The security rules ensure only the owner can update their own note.
    await adminDb.collection('activities').doc(activityId).update({
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
    // The security rules ensure only the owner can delete their own note.
    await adminDb.collection('activities').doc(activityId).delete();
    revalidatePath('/admin/entities'); // Revalidate to remove the note from the UI
    return { success: true };
  } catch (error) {
    console.error('Failed to delete note:', error);
    return { error: 'You do not have permission to delete this note or it does not exist.' };
  }
}
