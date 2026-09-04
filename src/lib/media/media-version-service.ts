/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Asset Versioning:
 *    Provides version creation, version listing, and active version switching actions for `MediaAsset`.
 * 2. Cascading Version Updates:
 *    When a version is set as active, the service automatically cascades the active URL to corresponding
 *    `media_shares` documents so public share pages (`/m/[shareId]`) render the active version seamlessly.
 * 3. Chunked Write Safety & Strict Typing:
 *    Uses writeBatch chunking (max 150 operations) for multi-share updates and enforces zero `any`/`any[]`.
 */

import { 
  collection, doc, getDoc, getDocs, query, where, 
  setDoc, updateDoc, writeBatch, orderBy, type Firestore 
} from 'firebase/firestore';
import type { MediaVersion } from '../types/media-2.0';

export interface CreateVersionParams {
  assetId: string;
  workspaceId: string;
  url: string;
  storagePath?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: string;
  dimensions?: { width: number; height: number };
  createdById: string;
  changeLog?: string;
}

/**
 * Retrieves all version history records for a media asset sorted by version number descending.
 */
export async function listMediaVersionsAction(
  firestore: Firestore,
  assetId: string
): Promise<MediaVersion[]> {
  if (!firestore || !assetId) return [];

  try {
    const versionsRef = collection(firestore, 'media_versions');
    const q = query(
      versionsRef,
      where('assetId', '==', assetId),
      orderBy('versionNumber', 'desc')
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MediaVersion));
  } catch (err: unknown) {
    console.error('[listMediaVersionsAction] Error fetching version history:', err);
    return [];
  }
}

/**
 * Creates a new MediaVersion record, attaches it to the MediaAsset, and sets it as active.
 */
export async function createMediaVersionAction(
  firestore: Firestore,
  params: CreateVersionParams
): Promise<MediaVersion | null> {
  if (!firestore || !params.assetId) return null;

  try {
    const assetRef = doc(firestore, 'media', params.assetId);
    const assetSnap = await getDoc(assetRef);
    if (!assetSnap.exists()) {
      throw new Error(`Media asset ${params.assetId} does not exist.`);
    }

    const assetData = assetSnap.data();
    const existingVersions = await listMediaVersionsAction(firestore, params.assetId);
    const nextVersionNumber = existingVersions.length > 0 ? existingVersions[0].versionNumber + 1 : 1;

    const versionId = doc(collection(firestore, 'media_versions')).id;
    const newVersion: MediaVersion = {
      id: versionId,
      assetId: params.assetId,
      versionNumber: nextVersionNumber,
      url: params.url,
      storagePath: params.storagePath,
      fileName: params.fileName,
      fileSize: params.fileSize,
      mimeType: params.mimeType,
      duration: params.duration || assetData.duration,
      dimensions: params.dimensions,
      createdById: params.createdById,
      changeLog: params.changeLog || `Uploaded version ${nextVersionNumber}`,
      createdAt: new Date().toISOString(),
    };

    // Save version document
    await setDoc(doc(firestore, 'media_versions', versionId), newVersion);

    // Update parent MediaAsset with currentVersionId & URL
    await updateDoc(assetRef, {
      currentVersionId: versionId,
      versionCount: nextVersionNumber,
      url: params.url,
      fileName: params.fileName,
      fileSize: params.fileSize,
      updatedAt: new Date().toISOString(),
    });

    // Cascade URL to corresponding media_shares records
    const sharesRef = collection(firestore, 'media_shares');
    const sharesQuery = query(sharesRef, where('assetId', '==', params.assetId));
    const sharesSnap = await getDocs(sharesQuery);

    if (sharesSnap.docs.length > 0) {
      const BATCH_SIZE = 150;
      for (let i = 0; i < sharesSnap.docs.length; i += BATCH_SIZE) {
        const chunk = sharesSnap.docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestore);
        chunk.forEach((shareDoc) => {
          batch.update(shareDoc.ref, {
            assetUrl: params.url,
            url: params.url,
            activeVersionId: versionId,
            updatedAt: new Date().toISOString(),
          });
        });
        await batch.commit();
      }
    }

    return newVersion;
  } catch (err: unknown) {
    console.error('[createMediaVersionAction] Failed to create media version:', err);
    return null;
  }
}

/**
 * Switches the active version of a MediaAsset to a specific historical version ID.
 */
export async function setActiveMediaVersionAction(
  firestore: Firestore,
  assetId: string,
  versionId: string
): Promise<boolean> {
  if (!firestore || !assetId || !versionId) return false;

  try {
    const versionSnap = await getDoc(doc(firestore, 'media_versions', versionId));
    if (!versionSnap.exists()) {
      throw new Error(`Version ${versionId} not found.`);
    }

    const versionData = versionSnap.data() as MediaVersion;
    const assetRef = doc(firestore, 'media', assetId);

    await updateDoc(assetRef, {
      currentVersionId: versionId,
      url: versionData.url,
      fileName: versionData.fileName,
      fileSize: versionData.fileSize,
      updatedAt: new Date().toISOString(),
    });

    // Cascade to media_shares
    const sharesRef = collection(firestore, 'media_shares');
    const sharesQuery = query(sharesRef, where('assetId', '==', assetId));
    const sharesSnap = await getDocs(sharesQuery);

    if (sharesSnap.docs.length > 0) {
      const BATCH_SIZE = 150;
      for (let i = 0; i < sharesSnap.docs.length; i += BATCH_SIZE) {
        const chunk = sharesSnap.docs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(firestore);
        chunk.forEach((shareDoc) => {
          batch.update(shareDoc.ref, {
            assetUrl: versionData.url,
            url: versionData.url,
            activeVersionId: versionId,
            updatedAt: new Date().toISOString(),
          });
        });
        await batch.commit();
      }
    }

    return true;
  } catch (err: unknown) {
    console.error('[setActiveMediaVersionAction] Failed to set active version:', err);
    return false;
  }
}
