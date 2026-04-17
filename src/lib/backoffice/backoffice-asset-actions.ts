'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import type { AuditActor, PlatformAsset, PlatformAssetCategory } from './backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice Asset Server Actions
// Operations for managing global assets (logos, icons, defaults).
// ─────────────────────────────────────────────────

export async function listAllAssets(): Promise<{
  success: boolean;
  data?: PlatformAsset[];
  error?: string;
}> {
  try {
    const snap = await adminDb.collection('platform_assets').orderBy('createdAt', 'desc').get();
    const assets = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PlatformAsset));

    return { success: true, data: assets };
  } catch (error: any) {
    console.error('[BACKOFFICE_ASSETS] listAllAssets failed:', error);
    return { success: false, error: error.message };
  }
}

export async function saveAssetRecord(
  payload: Partial<PlatformAsset> & { name: string; url: string; category: PlatformAssetCategory },
  actor: AuditActor
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const collection = adminDb.collection('platform_assets');
    let docRef: FirebaseFirestore.DocumentReference;
    let before = null;

    if (payload.id) {
       docRef = collection.doc(payload.id);
       const snap = await docRef.get();
       if (snap.exists) {
          before = createAuditSnapshot(snap.data() as Record<string, unknown>);
       }
    } else {
       docRef = collection.doc();
    }

    const dataToSave = {
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    
    if (!before) {
       dataToSave.createdAt = new Date().toISOString();
       dataToSave.uploadedBy = actor.userId;
       dataToSave.usageCount = 0;
    }
    
    // Do not save ID inside the doc
    const { id, ...sanitized } = dataToSave as any;

    await docRef.set(sanitized, { merge: true });

    const afterSnap = await docRef.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, before ? 'asset.update' : 'asset.create', 'asset', docRef.id, {
      before,
      after,
    });

    return { success: true, data: docRef.id };
  } catch (error: any) {
    console.error('[BACKOFFICE_ASSETS] saveAssetRecord failed:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteAssetRecord(
  assetId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('platform_assets').doc(assetId);
    const snap = await docRef.get();
    
    if (!snap.exists) {
      return { success: false, error: 'Asset not found' };
    }

    const before = createAuditSnapshot(snap.data() as Record<string, unknown>);

    await docRef.delete();

    await logBackofficeAction(actor, 'asset.delete', 'asset', assetId, {
      before,
      after: null,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[BACKOFFICE_ASSETS] deleteAssetRecord failed:', error);
    return { success: false, error: error.message };
  }
}
