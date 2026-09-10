'use server';

import { adminDb, adminStorage } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/require-auth';
import { getErrorMessage } from '@/lib/errors/report-error';

/**
 * @fileOverview Server actions for media asset mutations.
 */

/**
 * Updates the display name of a media asset in Firestore.
 * This does NOT rename the physical file in storage, ensuring URLs remain valid.
 */
export async function updateMediaName(assetId: string, newName: string) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  if (!assetId || !newName.trim()) {
    return { success: false, error: 'Invalid asset ID or name.' };
  }

  try {
    await adminDb.collection('media').doc(assetId).update({
      name: newName.trim(),
    });
    
    revalidatePath('/admin/media');
    return { success: true };
  } catch (error: unknown) {
    console.error(">>> [MEDIA] Rename Failed:", getErrorMessage(error));
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Permanently deletes a media asset from Firestore and Storage.
 */
export async function deleteMediaAsset(assetId: string, storagePath?: string) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

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
        } catch (storageError: unknown) {
            console.warn(">>> [MEDIA] Storage Deletion Warning (Document removed, file may persist):", getErrorMessage(storageError));
        }
    }
    
    revalidatePath('/admin/media');
    return { success: true };
  } catch (error: unknown) {
    console.error(">>> [MEDIA] Deletion Failed:", getErrorMessage(error));
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Saves a base64 image or a public file URL to the Media Library.
 */
export async function saveImageToMediaLibrary(params: {
  name: string;
  dataUri: string;
  workspaceId: string;
  userId: string;
}) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  const { name, dataUri, workspaceId, userId } = params;
  if (!dataUri || !workspaceId || !userId) {
    return { success: false, error: 'Missing required parameters.' };
  }

  try {
    // 1. Parse Data URI
    const match = dataUri.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,(.+)$/);
    if (!match) {
      return { success: false, error: 'Invalid image data URI format.' };
    }

    const mimeType = match[1];
    const base64Data = match[2];
    const extension = mimeType.split('/')[1] || 'png';
    const cleanName = name.trim().replace(/\.[^/.]+$/, "") || 'attached_image';
    const timestamp = Date.now();
    const fileName = `${timestamp}_${cleanName}.${extension}`;
    const storagePath = `media/${workspaceId}/${fileName}`;

    // 2. Upload to Storage
    const buffer = Buffer.from(base64Data, 'base64');
    const file = adminStorage.file(storagePath);
    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
      },
    });

    // Make the file publicly readable
    await file.makePublic();
    const downloadUrl = `https://storage.googleapis.com/${adminStorage.name}/${storagePath}`;

    // 3. Register in Firestore media collection
    const mediaDoc = await adminDb.collection('media').add({
      name: `${cleanName}.${extension}`,
      originalName: name,
      url: downloadUrl,
      fullPath: storagePath,
      type: 'image',
      mimeType,
      size: buffer.length,
      uploadedBy: userId,
      workspaceIds: [workspaceId],
      category: 'General',
      createdAt: new Date().toISOString(),
    });

    return { success: true, assetId: mediaDoc.id, url: downloadUrl };
  } catch (error: unknown) {
    console.error(">>> [MEDIA] Save image to Media Library failed:", error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: msg };
  }
}
