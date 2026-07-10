/**
 * Image upload for the page builder. Files land under `media/page-builder/...`,
 * which Storage rules permit (authenticated write, public read) — so uploaded
 * images render on published pages without a rules change.
 */
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

/** Build the storage path for a page-builder image (pure, testable). */
export function buildPageImagePath(workspaceId: string, filename: string, uniqueId: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `media/page-builder/${workspaceId}/${uniqueId}-${safeName}`;
}

/** Upload a file and resolve with its public download URL. */
export async function uploadPageImage(
  file: File,
  workspaceId: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const storage = getStorage();
  const path = buildPageImagePath(workspaceId, file.name, crypto.randomUUID());
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type || undefined });

  return new Promise<string>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      reject,
      () => {
        getDownloadURL(task.snapshot.ref).then(resolve).catch(reject);
      },
    );
  });
}

/** Build the storage path for general page-builder media (pure, testable). */
export function buildPageMediaPath(workspaceId: string, filename: string, uniqueId: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `media/page-builder/${workspaceId}/${uniqueId}-${safeName}`;
}

/** Upload a generic media file (image, video, etc.) and resolve with its public download URL. */
export async function uploadPageMedia(
  file: File,
  workspaceId: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const storage = getStorage();
  const path = buildPageMediaPath(workspaceId, file.name, crypto.randomUUID());
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type || undefined });

  return new Promise<string>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      reject,
      () => {
        getDownloadURL(task.snapshot.ref).then(resolve).catch(reject);
      },
    );
  });
}
