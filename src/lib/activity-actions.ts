
'use server';

import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getDb } from './server-only-firestore';
import { revalidatePath } from 'next/cache';

/**
 * Updates the content of a specific note activity.
 * @param activityId The ID of the activity (note) to update.
 * @param newContent The new content for the note.
 */
export async function updateNote(activityId: string, newContent: string) {
  if (!activityId || !newContent.trim()) {
    return { error: 'Invalid input provided.' };
  }

  const db = getDb();
  const noteRef = doc(db, 'activities', activityId);

  try {
    // The security rules ensure only the owner can update their own note.
    await updateDoc(noteRef, {
      'metadata.content': newContent,
      timestamp: new Date().toISOString(), // Also update the timestamp to reflect the edit time
    });
    revalidatePath('/admin/schools'); // Revalidate to show updated note
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
  
  const db = getDb();
  const noteRef = doc(db, 'activities', activityId);

  try {
    // The security rules ensure only the owner can delete their own note.
    await deleteDoc(noteRef);
    revalidatePath('/admin/schools'); // Revalidate to remove the note from the UI
    return { success: true };
  } catch (error) {
    console.error('Failed to delete note:', error);
    return { error: 'You do not have permission to delete this note or it does not exist.' };
  }
}
