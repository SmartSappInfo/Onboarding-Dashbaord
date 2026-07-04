'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import { authorizeBackoffice } from './backoffice-auth';
import { getErrorMessage } from './backoffice-errors';
import type { PlatformAsset, PlatformAssetCategory } from './backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice Asset Server Actions
// Operations for managing global assets (logos, icons, defaults).
//
// Security: every action verifies the caller's ID token and enforces RBAC
// via `authorizeBackoffice` (server-auth-actions). Actor derived server-side.
// ─────────────────────────────────────────────────

export async function listAllAssets(idToken: string): Promise<{
  success: boolean;
  data?: PlatformAsset[];
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'assets', 'view');

    const snap = await adminDb.collection('platform_assets').orderBy('createdAt', 'desc').get();
    const assets = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PlatformAsset));

    return { success: true, data: assets };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_ASSETS] listAllAssets failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function saveAssetRecord(
  payload: Partial<PlatformAsset> & { name: string; url: string; category: PlatformAssetCategory },
  idToken: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'assets', 'edit');

    const collection = adminDb.collection('platform_assets');
    let docRef: FirebaseFirestore.DocumentReference;
    let before: Record<string, unknown> | null = null;

    if (payload.id) {
       docRef = collection.doc(payload.id);
       const snap = await docRef.get();
       if (snap.exists) {
          before = createAuditSnapshot(snap.data() as Record<string, unknown>);
       }
    } else {
       docRef = collection.doc();
    }

    const dataToSave: Partial<PlatformAsset> = {
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    if (!before) {
       dataToSave.createdAt = new Date().toISOString();
       dataToSave.uploadedBy = actor.userId;
       dataToSave.usageCount = 0;
    }

    // Do not save ID inside the doc
    const { id: _id, ...sanitized } = dataToSave;

    await docRef.set(sanitized, { merge: true });

    const afterSnap = await docRef.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, before ? 'asset.update' : 'asset.create', 'asset', docRef.id, {
      before,
      after,
    });

    return { success: true, data: docRef.id };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_ASSETS] saveAssetRecord failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteAssetRecord(
  assetId: string,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'assets', 'delete');

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
  } catch (error: unknown) {
    console.error('[BACKOFFICE_ASSETS] deleteAssetRecord failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
