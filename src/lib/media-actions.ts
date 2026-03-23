'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';

/**
 * @fileOverview Server actions for media asset mutations.
 */

/**
 * Updates the display name of a media asset in Firestore.
 * This does NOT rename the physical file in storage, ensuring URLs remain valid.
 */
export async function updateMediaName(assetId: string, newName: string) {
  if (!assetId || !newName.trim()) {
    return { success: false, error: 'Invalid asset ID or name.' };
  }

  try {
    await adminDb.collection('media').doc(assetId).update({
      name: newName.trim(),
    });
    
    revalidatePath('/admin/media');
    return { success: true };
  } catch (error: any) {
    console.error(">>> [MEDIA] Rename Failed:", error.message);
    return { success: false, error: error.message };
  }
}
