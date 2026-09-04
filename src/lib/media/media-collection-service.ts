/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Collections & Packages:
 *    Manages creation, updates, and asset assignments for MediaCollections (Folders/Campaigns)
 *    and MediaPackages (Sales Kits/Content Bundles).
 * 2. Strict Typing & Performance:
 *    Uses typed Firestore converters and enforces zero `any`/`any[]`.
 */

import { 
  collection, doc, getDoc, getDocs, query, where, 
  setDoc, updateDoc, orderBy, type Firestore 
} from 'firebase/firestore';
import type { MediaCollection, MediaPackage, CollectionType } from '../types/media-2.0';

export interface CreateCollectionParams {
  workspaceId: string;
  name: string;
  description?: string;
  type: CollectionType;
  iconName?: string;
  colorHex?: string;
  assetIds?: string[];
  createdById: string;
}

/**
 * Creates a new MediaCollection document in Firestore.
 */
export async function createCollectionAction(
  firestore: Firestore,
  params: CreateCollectionParams
): Promise<MediaCollection | null> {
  if (!firestore || !params.workspaceId || !params.name) return null;

  try {
    const colId = doc(collection(firestore, 'media_collections')).id;
    const newCollection: MediaCollection = {
      id: colId,
      workspaceId: params.workspaceId,
      name: params.name,
      description: params.description || '',
      type: params.type,
      iconName: params.iconName || 'Folder',
      colorHex: params.colorHex || '#3b82f6',
      assetIds: params.assetIds || [],
      createdById: params.createdById,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(firestore, 'media_collections', colId), newCollection);
    return newCollection;
  } catch (err: unknown) {
    console.error('[createCollectionAction] Error creating media collection:', err);
    return null;
  }
}

/**
 * Lists all MediaCollections in a workspace sorted by creation date descending.
 */
export async function listCollectionsAction(
  firestore: Firestore,
  workspaceId: string
): Promise<MediaCollection[]> {
  if (!firestore || !workspaceId) return [];

  try {
    const colRef = collection(firestore, 'media_collections');
    const q = query(
      colRef,
      where('workspaceId', '==', workspaceId),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MediaCollection));
  } catch (err: unknown) {
    console.error('[listCollectionsAction] Error fetching collections:', err);
    return [];
  }
}

/**
 * Adds an asset to a collection.
 */
export async function addAssetToCollectionAction(
  firestore: Firestore,
  collectionId: string,
  assetId: string
): Promise<boolean> {
  if (!firestore || !collectionId || !assetId) return false;

  try {
    const colRef = doc(firestore, 'media_collections', collectionId);
    const colSnap = await getDoc(colRef);
    if (!colSnap.exists()) return false;

    const data = colSnap.data() as MediaCollection;
    const currentAssetIds = data.assetIds || [];

    if (!currentAssetIds.includes(assetId)) {
      await updateDoc(colRef, {
        assetIds: [...currentAssetIds, assetId],
        updatedAt: new Date().toISOString(),
      });
    }

    return true;
  } catch (err: unknown) {
    console.error('[addAssetToCollectionAction] Error adding asset to collection:', err);
    return false;
  }
}
