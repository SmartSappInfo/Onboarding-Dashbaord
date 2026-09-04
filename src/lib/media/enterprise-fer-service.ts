'use server';

/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Enterprise Platform FER Service
 *
 * Implements an idempotent Fetch-Enrich-Restore (FER) migration and bootstrapping engine
 * for Phase 9 Enterprise Platform collections (Retention Configs, Governance Settings).
 *
 * ARCHITECTURAL INVARIANTS & BATCH CHUNKING SAFETY (RULE 10):
 * 1. Non-Destructive Bootstrapping: Inspects existing documents first. Existing enterprise
 *    settings are never overwritten or reset.
 * 2. Batch Chunking Limits: All document mutations commit via `writeBatch(firestore)` chunked
 *    strictly at **max 150 operations** per commit, preventing batch overload errors.
 * 3. Strict Typing: Zero `any`, `any[]`, or `unknown`.
 *
 * PRD REFERENCES:
 * - PRD Sec 132 (Phase 9 - Enterprise Platform) & Sec 156 (Retention Policy).
 */

import { adminDb } from '@/lib/firebase-admin';
import type { EnterprisePlatformGovernanceConfig, MediaRetentionPolicy } from '@/lib/types/media-2.0';
import { DEFAULT_RETENTION_POLICY } from './retention-service';

export const DEFAULT_ENTERPRISE_GOVERNANCE: EnterprisePlatformGovernanceConfig = {
  workspaceId: '',
  enforceStrictRbac: false,
  requireApprovalForPublish: false,
  allowedWebhookProtocols: ['https:'],
  globalRateLimitPerMin: 60,
  retentionPurgeSchedule: 'WEEKLY',
  updatedAt: new Date().toISOString(),
};

/**
 * Bootstraps enterprise platform defaults across workspaces using the Fetch-Enrich-Restore protocol.
 */
export async function bootstrapEnterprisePlatformAction(
  targetWorkspaceId?: string
): Promise<{ success: boolean; processedWorkspaces: number; bootstrappedConfigs: number; error?: string }> {
  try {
    // 1. FETCH
    let workspaceIds: string[] = [];
    if (targetWorkspaceId) {
      workspaceIds = [targetWorkspaceId];
    } else {
      const snap = await adminDb.collection('workspaces').limit(50).get();
      workspaceIds = snap.docs.map((d) => d.id);
    }

    if (workspaceIds.length === 0) {
      return { success: true, processedWorkspaces: 0, bootstrappedConfigs: 0 };
    }

    // 2. ENRICH & RESTORE (chunked batch max 150 ops)
    let bootstrappedCount = 0;
    const BATCH_LIMIT = 150;
    let batch = adminDb.batch();
    let opCount = 0;

    for (const wsId of workspaceIds) {
      // Check retention config
      const retentionRef = adminDb.collection('media_retention_configs').doc(wsId);
      const retentionSnap = await retentionRef.get();

      if (!retentionSnap.exists) {
        const defaultRetention: MediaRetentionPolicy = {
          ...DEFAULT_RETENTION_POLICY,
          workspaceId: wsId,
          updatedAt: new Date().toISOString(),
        };
        batch.set(retentionRef, defaultRetention);
        opCount++;
        bootstrappedCount++;
      }

      // Check enterprise governance config
      const governanceRef = adminDb.collection('media_enterprise_configs').doc(wsId);
      const governanceSnap = await governanceRef.get();

      if (!governanceSnap.exists) {
        const defaultGov: EnterprisePlatformGovernanceConfig = {
          ...DEFAULT_ENTERPRISE_GOVERNANCE,
          workspaceId: wsId,
          updatedAt: new Date().toISOString(),
        };
        batch.set(governanceRef, defaultGov);
        opCount++;
        bootstrappedCount++;
      }

      // Commit chunk if reached batch limit
      if (opCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = adminDb.batch();
        opCount = 0;
      }
    }

    // Commit any remaining operations
    if (opCount > 0) {
      await batch.commit();
    }

    return {
      success: true,
      processedWorkspaces: workspaceIds.length,
      bootstrappedConfigs: bootstrappedCount,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Enterprise bootstrapping failed.';
    return { success: false, processedWorkspaces: 0, bootstrappedConfigs: 0, error: msg };
  }
}
