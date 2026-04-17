'use server';

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import type { AuditActor, PlatformFeature, RolloutRule } from './backoffice-types';

// ─────────────────────────────────────────────────
// Backoffice Feature Server Actions
// Operations for managing platform feature flags.
// ─────────────────────────────────────────────────

export async function listAllFeatures(): Promise<{
  success: boolean;
  data?: PlatformFeature[];
  error?: string;
}> {
  try {
    const snap = await adminDb.collection('platform_features').orderBy('key', 'asc').get();
    const features = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as PlatformFeature));

    return { success: true, data: features };
  } catch (error: any) {
    console.error('[BACKOFFICE_FEATURE] listAllFeatures failed:', error);
    return { success: false, error: error.message };
  }
}

export async function getFeatureDetail(featureId: string): Promise<{
  success: boolean;
  data?: PlatformFeature;
  error?: string;
}> {
  try {
    const doc = await adminDb.collection('platform_features').doc(featureId).get();
    if (!doc.exists) {
      return { success: false, error: 'Feature not found' };
    }

    return { success: true, data: { id: doc.id, ...doc.data() } as PlatformFeature };
  } catch (error: any) {
    console.error('[BACKOFFICE_FEATURE] getFeatureDetail failed:', error);
    return { success: false, error: error.message };
  }
}

export async function toggleFeatureKillSwitch(
  featureId: string,
  killSwitch: boolean,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
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
  } catch (error: any) {
    console.error('[BACKOFFICE_FEATURE] toggleFeatureKillSwitch failed:', error);
    return { success: false, error: error.message };
  }
}

export async function updateFeatureRolloutRules(
  featureId: string,
  rolloutRules: RolloutRule[],
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  try {
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
  } catch (error: any) {
    console.error('[BACKOFFICE_FEATURE] updateFeatureRolloutRules failed:', error);
    return { success: false, error: error.message };
  }
}
