'use server';

import { adminDb, adminStorage } from './firebase-admin';
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

/**
 * Permanently deletes a media asset from Firestore and Storage.
 */
export async function deleteMediaAsset(assetId: string, storagePath?: string) {
  if (!assetId) {
    return { success: false, error: 'Invalid asset ID.' };
  }

  try {
    // 1. Delete Firestore Document
    await adminDb.collection('media').doc(assetId).delete();
    
    // 2. Delete Physical File from Storage if path exists
    if (storagePath) {
        try {
            await adminStorage.file(storagePath).delete();
        } catch (storageError: any) {
            console.warn(">>> [MEDIA] Storage Deletion Warning (Document removed, file may persist):", storageError.message);
        }
    }
    
    revalidatePath('/admin/media');
    return { success: true };
  } catch (error: any) {
    console.error(">>> [MEDIA] Deletion Failed:", error.message);
    return { success: false, error: error.message };
  }
}
