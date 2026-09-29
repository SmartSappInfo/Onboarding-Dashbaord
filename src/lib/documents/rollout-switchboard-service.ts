/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Staged Canary Switchboard & Rollout Controls (Phase 7):
 * 1. Purpose (DocSigning_roadmap.md §16.2 & §17):
 *    Controls progressive canary rollout of modern document signing flows:
 *    - Deterministic entity-level hashing ensures a specific contract/envelope consistently
 *      stays on either the legacy or modern execution path throughout its lifecycle.
 *    - 5-Stage Staged Rollout: 0% Internal -> 10% Canary -> 25% Beta -> 50% Majority -> 100% GA.
 *    - Emergency 1-Click Rollback (FM-P7-05): Lossless instant cutover back to legacy compatibility mode.
 * 2. Strict Tenant Scoping (Rule 5 & 8):
 *    All cohort configurations partition strictly under `workspaces/{workspaceId}/rollout_cohort/config`.
 * 3. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { adminDb } from '@/lib/firebase-admin';
import {
  RolloutCohortConfig,
  RolloutCohortConfigSchema,
} from '@/lib/types/document-signing';
import { createHash } from 'crypto';

/**
 * Computes a deterministic integer modulo 100 [0..99] for a given entity ID.
 */
export function computeEntityCohortHash(entityId: string): number {
  const hash = createHash('md5').update(entityId).digest('hex');
  const num = parseInt(hash.slice(0, 8), 16);
  return num % 100;
}

/**
 * Retrieves the active rollout cohort configuration for a workspace.
 */
export async function getWorkspaceRolloutCohort(
  workspaceId: string
): Promise<RolloutCohortConfig> {
  const docRef = adminDb
    .collection(`workspaces/${workspaceId}/rollout_cohort`)
    .doc('config');

  const snap = await docRef.get();
  if (!snap.exists) {
    return {
      workspaceId,
      cohortPercentage: 0,
      isEmergencyRollbackActive: false,
      legacyDualWriteEnabled: true,
      shadowReadsEnabled: true,
      updatedAt: new Date().toISOString(),
      updatedByUserId: 'system_default',
    };
  }

  const parsed = RolloutCohortConfigSchema.safeParse(snap.data());
  if (parsed.success && parsed.data.workspaceId === workspaceId) {
    return parsed.data;
  }

  return {
    workspaceId,
    cohortPercentage: 0,
    isEmergencyRollbackActive: false,
    legacyDualWriteEnabled: true,
    shadowReadsEnabled: true,
    updatedAt: new Date().toISOString(),
    updatedByUserId: 'system_default',
  };
}

/**
 * Updates the rollout cohort settings for a workspace.
 */
export async function updateWorkspaceRolloutCohort(
  workspaceId: string,
  input: Partial<Omit<RolloutCohortConfig, 'workspaceId' | 'updatedAt' | 'updatedByUserId'>>,
  actorId: string
): Promise<RolloutCohortConfig> {
  const current = await getWorkspaceRolloutCohort(workspaceId);

  const updated: RolloutCohortConfig = {
    ...current,
    ...input,
    workspaceId,
    updatedAt: new Date().toISOString(),
    updatedByUserId: actorId,
  };

  const validated = RolloutCohortConfigSchema.parse(updated);

  await adminDb
    .collection(`workspaces/${workspaceId}/rollout_cohort`)
    .doc('config')
    .set(validated);

  return validated;
}

/**
 * Immediately triggers an emergency rollback, routing 100% of signing traffic
 * back to the legacy-safe compatibility mode (FM-P7-05).
 */
export async function triggerEmergencyRollback(
  workspaceId: string,
  reason: string,
  actorId: string
): Promise<RolloutCohortConfig> {
  console.warn(`[EMERGENCY ROLLBACK TRIGGERED] Workspace: ${workspaceId}, Reason: ${reason}, Actor: ${actorId}`);

  return await updateWorkspaceRolloutCohort(
    workspaceId,
    {
      isEmergencyRollbackActive: true,
      legacyDualWriteEnabled: true,
      shadowReadsEnabled: false,
    },
    actorId
  );
}

/**
 * Determines whether a specific contract, template, or envelope should execute
 * on the modern domain model or stay on the legacy compatibility route.
 */
export async function shouldRouteToModernDomain(
  workspaceId: string,
  entityId: string
): Promise<boolean> {
  const config = await getWorkspaceRolloutCohort(workspaceId);

  // FM-P7-05: Emergency rollback bypasses modern routing immediately
  if (config.isEmergencyRollbackActive) {
    return false;
  }

  if (config.cohortPercentage >= 100) {
    return true;
  }

  if (config.cohortPercentage <= 0) {
    return false;
  }

  const hashBucket = computeEntityCohortHash(entityId);
  return hashBucket < config.cohortPercentage;
}
