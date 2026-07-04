'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import { authorizeBackoffice } from './backoffice-auth';
import { getErrorMessage } from './backoffice-errors';
import type { PlatformFeature, RolloutRule } from './backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice Feature Server Actions
// Operations for managing platform feature flags.
//
// Security: every action verifies the caller's Firebase ID
// token and enforces RBAC via `authorizeBackoffice` before
// touching data (server-auth-actions). The audit actor is
// derived server-side — never from client payloads.
// ─────────────────────────────────────────────────

export async function listAllFeatures(idToken: string): Promise<{
  success: boolean;
  data?: PlatformFeature[];
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'features', 'view');

    const snap = await adminDb.collection('platform_features').orderBy('key', 'asc').get();
    const features = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PlatformFeature));

    return { success: true, data: features };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FEATURE] listAllFeatures failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function getFeatureDetail(featureId: string, idToken: string): Promise<{
  success: boolean;
  data?: PlatformFeature;
  error?: string;
}> {
  try {
    await authorizeBackoffice(idToken, 'features', 'view');

    const doc = await adminDb.collection('platform_features').doc(featureId).get();
    if (!doc.exists) {
      return { success: false, error: 'Feature not found' };
    }

    return { success: true, data: { id: doc.id, ...doc.data() } as PlatformFeature };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FEATURE] getFeatureDetail failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function toggleFeatureKillSwitch(
  featureId: string,
  killSwitch: boolean,
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'features', 'execute');

    const ref = adminDb.collection('platform_features').doc(featureId);
    const snap = await ref.get();

    if (!snap.exists) {
      return { success: false, error: 'Feature not found' };
    }

    const before = createAuditSnapshot(snap.data() as Record<string, unknown>);

    await ref.update({
      killSwitch,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
    });

    const afterSnap = await ref.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'feature.toggle_kill_switch', 'feature', featureId, {
      before,
      after,
      metadata: { killSwitch }
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FEATURE] toggleFeatureKillSwitch failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateFeatureRolloutRules(
  featureId: string,
  rolloutRules: RolloutRule[],
  idToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await authorizeBackoffice(idToken, 'features', 'edit');

    const ref = adminDb.collection('platform_features').doc(featureId);
    const snap = await ref.get();

    if (!snap.exists) {
      return { success: false, error: 'Feature not found' };
    }

    const before = createAuditSnapshot(snap.data() as Record<string, unknown>);

    await ref.update({
      rolloutRules,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.userId,
    });

    const afterSnap = await ref.get();
    const after = createAuditSnapshot(afterSnap.data() as Record<string, unknown>);

    await logBackofficeAction(actor, 'feature.update_rollout', 'feature', featureId, {
      before,
      after,
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[BACKOFFICE_FEATURE] updateFeatureRolloutRules failed:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
