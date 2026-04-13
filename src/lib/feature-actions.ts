'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import { APP_FEATURES, type AppFeatureId, type FeatureToggleMap } from './types';

/**
 * @fileOverview Server actions for the Feature Toggle system.
 * Handles org-level and workspace-level feature persistence.
 */

/**
 * Update features enabled for an organization (Super Admin only).
 * This sets the ceiling for what workspaces under this org can enable.
 */
export async function updateOrganizationFeaturesAction(
  orgId: string,
  features: FeatureToggleMap
) {
  try {
    if (!orgId) throw new Error('Organization ID required');

    // Validate feature IDs
    const validIds = APP_FEATURES.map(f => f.id) as string[];
    const invalidKeys = Object.keys(features).filter(k => !validIds.includes(k));
    if (invalidKeys.length > 0) {
      throw new Error(`Invalid feature IDs: ${invalidKeys.join(', ')}`);
    }

    await adminDb.collection('organizations').doc(orgId).update({
      enabledFeatures: features,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/admin/settings');
    return { success: true };
  } catch (e: any) {
    console.error('[FEATURE_ACTIONS] Org update failed:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Update features enabled for a workspace (Workspace Admin).
 * Validates that a feature cannot be enabled at workspace level
 * if it's disabled at the organization level.
 */
export async function updateWorkspaceFeaturesAction(
  workspaceId: string,
  features: FeatureToggleMap
) {
  try {
    if (!workspaceId) throw new Error('Workspace ID required');

    // Validate feature IDs
    const validIds = APP_FEATURES.map(f => f.id) as string[];
    const invalidKeys = Object.keys(features).filter(k => !validIds.includes(k));
    if (invalidKeys.length > 0) {
      throw new Error(`Invalid feature IDs: ${invalidKeys.join(', ')}`);
    }

    // Get workspace to resolve its organization
    const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
    if (!wsSnap.exists) throw new Error('Workspace not found');

    const workspace = wsSnap.data()!;
    const orgId = workspace.organizationId;

    if (!orgId) throw new Error('Workspace has no organization');

    // Get org features to validate ceiling
    const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
    const orgFeatures: FeatureToggleMap = orgSnap.exists ? (orgSnap.data()?.enabledFeatures || {}) : {};

    // Check: cannot enable a feature the org has explicitly disabled
    for (const [featureId, enabled] of Object.entries(features)) {
      if (enabled) {
        const orgValue = orgFeatures[featureId as AppFeatureId];
        // If org explicitly disabled it, workspace cannot enable it
        if (orgValue === false) {
          throw new Error(
            `Cannot enable "${featureId}" — it is disabled at the organization level.`
          );
        }
      }
    }

    await adminDb.collection('workspaces').doc(workspaceId).update({
      enabledFeatures: features,
      updatedAt: new Date().toISOString(),
    });

    revalidatePath('/admin/settings');
    return { success: true };
  } catch (e: any) {
    console.error('[FEATURE_ACTIONS] Workspace update failed:', e);
    return { success: false, error: e.message };
  }
}
