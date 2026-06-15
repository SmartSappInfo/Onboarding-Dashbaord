'use client';

import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  attachmentTypeFromMime,
  buildAttachmentStoragePath,
  isAllowedAttachmentMime,
} from './quick-notes-domain';
import type { QuickNoteAttachment } from './quick-notes-types';

/**
 * Quick Notes — client-side attachment uploads.
 *
 * Mirrors the Storage pattern in media-uploader.tsx (uploadBytesResumable →
 * getDownloadURL). Files land under `quick-notes/{workspaceId}/…`, which the
 * Storage rules added in Phase 0 permit. The returned `storagePath` lets us
 * clean the object up when the note or attachment is deleted (R13).
 */

/** 25 MB ceiling, matched roughly to the media library's expectations. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export interface UploadNoteAttachmentParams {
  file: File;
  workspaceId: string;
  onProgress?: (percent: number) => void;
}

export async function uploadNoteAttachment(
  params: UploadNoteAttachmentParams
): Promise<QuickNoteAttachment> {
  const { file, workspaceId, onProgress } = params;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('File exceeds the 25 MB limit.');
  }
  if (!isAllowedAttachmentMime(file.type)) {
    throw new Error('Unsupported file type. Allowed: images, videos, and common documents.');
  }

  const storage = getStorage();
  const id = crypto.randomUUID();
  const storagePath = buildAttachmentStoragePath(workspaceId, id, file.name);
  const storageRef = ref(storage, storagePath);
  const task = uploadBytesResumable(storageRef, file, { contentType: file.type || undefined });

  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      reject,
      () => resolve()
    );
  });

  const url = await getDownloadURL(task.snapshot.ref);
  const type = attachmentTypeFromMime(file.type);

  return {
    id,
    type,
    url,
    storagePath,
    title: file.name,
    mimeType: file.type || undefined,
    sizeBytes: file.size,
    // For images the file itself is the thumbnail; videos/files have none yet.
    thumbnailUrl: type === 'image' ? url : undefined,
  };
}

/** Best-effort deletion of an owned Storage object. Never throws. */
export async function deleteAttachmentObject(storagePath: string): Promise<void> {
  try {
    await deleteObject(ref(getStorage(), storagePath));
  } catch {
    /* object may already be gone; deletion is best-effort */
  }
}
