'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import { authorizeBackoffice } from './backoffice-auth';
import { getErrorMessage } from './backoffice-errors';
import type { PlatformProviderSetting, PlatformProviderType } from './backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice Provider Server Actions
// Operations for managing global provider configs (Email, SMS, Webhooks).
//
// Security: every action verifies the caller's ID token and enforces RBAC
// via `authorizeBackoffice` (server-auth-actions). Actor derived server-side.
// ─────────────────────────────────────────────────

export async function listProviderSettings(idToken: string): Promise<{
  success: boolean;
  data?: PlatformProviderSetting[];
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'settings', 'view');

    const snap = await adminDb.collection('platform_provider_settings').get();
    const providers = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PlatformProviderSetting));

    return { success: true, data: providers };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_PROVIDER] listProviderSettings failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function saveProviderSetting(
  payload: Partial<PlatformProviderSetting> & { provider: string; type: PlatformProviderType },
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'settings', 'edit');

    const collection = adminDb.collection('platform_provider_settings');
    let docRef: FirebaseFirestore.DocumentReference;
    let before = null;

    if (payload.id) {
       docRef = collection.doc(payload.id);
       const snap = await docRef.get();
       if (snap.exists) {
          before = createAuditSnapshot(snap.data() as Record<string, unknown>);
       }
    } else {
       // Search if the provider already exists
       const extSnap = await collection
         .where('provider', '==', payload.provider)
         .where('type', '==', payload.type)
         .limit(1)
         .get();
         
       if (!extSnap.empty) {
          docRef = extSnap.docs[0].ref;
          before = createAuditSnapshot(extSnap.docs[0].data() as Record<string, unknown>);
       } else {
          docRef = collection.doc();
       }
    }

    const dataToSave = {
      ...payload,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
    };
    
    if (!before) {
       dataToSave.createdAt = new Date().toISOString();
    }
    
    // Do not save ID inside the doc
    const { id: _id, ...sanitized } = dataToSave;

    await docRef.set(sanitized, { merge: true });

    const afterSnap = await docRef.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, before ? 'provider.update' : 'provider.create', 'provider', docRef.id, {
      before,
      after,
      metadata: { type: payload.type, provider: payload.provider }
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_PROVIDER] saveProviderSetting failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
