'use server';

/**
 * @fileoverview Server Actions for SmartSapp Performance Policy Studio (Phase 4).
 *
 * ARCHITECTURAL POINTER:
 * Provides secure, workspace-scoped server actions for RevOps and sales management:
 * 1. getWorkspacePolicyAction: Fetches active policy or auto-provisions via FER migration.
 * 2. simulatePolicyImpactAction: Bounded historical simulation predicting score/rank shifts.
 * 3. saveAndPublishPolicyAction: Enforces validation, generates diffs, and creates versioned snapshots.
 * 4. getPolicyVersionHistoryAction: Retrieves audit history of past policy versions.
 * 5. rollbackPolicyVersionAction: Restores any historical policy snapshot with rollback audit logging.
 * 6. resetPolicyToDefaultsAction: Resets workspace policy to system-standard baseline.
 * 7. getBackofficePoliciesListAction: Super-admin multi-tenant policy inspection.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Must strictly scope queries to active workspaceId.
 * - Enforces bounded queries: max 500 daily buckets, max 200 sample events, max 20 versions.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  PerformancePolicy,
  PolicyVersionRecord,
  PolicySimulationResult,
  PolicyChangeDiff,
} from '@/lib/policy-studio/types';
import {
  validatePolicyIntegrity,
  simulatePolicyImpact,
  generatePolicyChangeDiff,
} from '@/lib/policy-studio/policy-engine';
import {
  executePolicyMigration,
  buildDefaultPerformancePolicy,
} from '@/lib/policy-studio/migration-protocol';
import type { SalesPerformanceDaily } from '@/lib/sales-performance/types';

/**
 * Server Action: Retrieve the active PerformancePolicy for a workspace.
 * Auto-provisions via FER migration if none exists.
 */
export async function getWorkspacePolicyAction(params: {
  workspaceId: string;
  organizationId: string;
  actorId?: string;
  actorName?: string;
}): Promise<{
  success: boolean;
  policy?: PerformancePolicy;
  isInitialProvision?: boolean;
  error?: string;
}> {
  try {
    const { workspaceId, organizationId, actorId = 'system', actorName = 'System Administrator' } = params;
    if (!workspaceId || !organizationId) {
      return { success: false, error: 'Missing workspace or organization identifier.' };
    }

    const docRef = adminDb.collection('performancePolicies').doc(workspaceId);
    const snap = await docRef.get();

    if (!snap.exists) {
      // Auto-provision via idempotent FER migration
      const migrationRes = await executePolicyMigration({
        workspaceId,
        organizationId,
        actorId,
        actorName,
      });

      if (!migrationRes.success) {
        return { success: false, error: migrationRes.error || 'Failed to initialize policy.' };
      }

      const newSnap = await docRef.get();
      return {
        success: true,
        policy: newSnap.data() as PerformancePolicy,
        isInitialProvision: true,
      };
    }

    const policy = snap.data() as PerformancePolicy;
    return {
      success: true,
      policy,
      isInitialProvision: false,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PolicyStudio] Error fetching workspace policy:', err);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Deterministically simulate proposed policy changes against recent workspace data.
 */
export async function simulatePolicyImpactAction(params: {
  workspaceId: string;
  organizationId: string;
  proposedPolicy: PerformancePolicy;
}): Promise<{
  success: boolean;
  simulation?: PolicySimulationResult;
  error?: string;
}> {
  try {
    const { workspaceId, organizationId, proposedPolicy } = params;
    if (!workspaceId || !organizationId) {
      return { success: false, error: 'Missing required context.' };
    }

    // 1. Validate proposed policy integrity
    const validation = validatePolicyIntegrity(proposedPolicy);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Policy validation failed: ${validation.errors.join(' ')}`,
      };
    }

    // 2. Fetch current policy
    const curSnap = await adminDb.collection('performancePolicies').doc(workspaceId).get();
    const currentPolicy: PerformancePolicy = curSnap.exists
      ? (curSnap.data() as PerformancePolicy)
      : buildDefaultPerformancePolicy({
          workspaceId,
          organizationId,
          authorId: 'system',
          authorName: 'System',
        });

    // 3. Query recent historical performance records (bounded: last 30 days, limit 500)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [dailySnap, eventsSnap] = await Promise.all([
      adminDb
        .collection('salesPerformanceDaily')
        .where('workspaceId', '==', workspaceId)
        .where('date', '>=', thirtyDaysAgo)
        .limit(500)
        .get(),
      adminDb
        .collection('effortEvents')
        .where('workspaceId', '==', workspaceId)
        .limit(200)
        .get(),
    ]);

    const repsDaily: SalesPerformanceDaily[] = [];
    dailySnap.forEach((doc) => {
      repsDaily.push(doc.data() as SalesPerformanceDaily);
    });

    const sampleEvents: Array<{
      eventType: string;
      entityId: string;
      actorId: string;
      points: number;
      durationSeconds?: number;
      occurredAt: string;
      metadata?: Record<string, string | number | boolean>;
    }> = [];

    eventsSnap.forEach((doc) => {
      const e = doc.data();
      sampleEvents.push({
        eventType: e.eventType || '',
        entityId: e.entityId || '',
        actorId: e.actorId || '',
        points: e.points || 0,
        durationSeconds: e.metadata?.durationSeconds ? Number(e.metadata.durationSeconds) : undefined,
        occurredAt: e.createdAt || new Date().toISOString(),
        metadata: e.metadata,
      });
    });

    // 4. Run Pure Simulation Engine
    const simulation = simulatePolicyImpact({
      proposedPolicy,
      currentPolicy,
      repsDaily,
      sampleEvents,
    });

    return {
      success: true,
      simulation,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PolicyStudio] Error during simulation:', err);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Validate, version, and publish a new PerformancePolicy.
 */
export async function saveAndPublishPolicyAction(params: {
  workspaceId: string;
  organizationId: string;
  policy: PerformancePolicy;
  changeSummary: string;
  authorId: string;
  authorName: string;
  authorEmail?: string;
}): Promise<{
  success: boolean;
  version?: number;
  diff?: PolicyChangeDiff;
  error?: string;
}> {
  try {
    const {
      workspaceId,
      organizationId,
      policy,
      changeSummary,
      authorId,
      authorName,
      authorEmail,
    } = params;

    if (!workspaceId || !organizationId || !policy) {
      return { success: false, error: 'Missing required parameters.' };
    }

    // 1. Validate integrity
    const validation = validatePolicyIntegrity(policy);
    if (!validation.isValid) {
      return {
        success: false,
        error: `Integrity check failed: ${validation.errors.join(' ')}`,
      };
    }

    const docRef = adminDb.collection('performancePolicies').doc(workspaceId);
    const existingSnap = await docRef.get();

    let newVersion = 1;
    let oldPolicy: PerformancePolicy | null = null;

    if (existingSnap.exists) {
      oldPolicy = existingSnap.data() as PerformancePolicy;
      newVersion = (oldPolicy.version || 1) + 1;
    } else {
      oldPolicy = buildDefaultPerformancePolicy({
        workspaceId,
        organizationId,
        authorId,
        authorName,
      });
    }

    // 2. Generate Change Diff
    const diff = generatePolicyChangeDiff(oldPolicy, policy);

    const now = new Date().toISOString();
    const updatedPolicy: PerformancePolicy = {
      ...policy,
      workspaceId,
      organizationId,
      version: newVersion,
      effectiveFrom: now,
      updatedAt: now,
      updatedBy: {
        userId: authorId,
        userName: authorName,
        userEmail: authorEmail,
      },
    };

    // 3. Create Version Snapshot
    const versionRecord: PolicyVersionRecord = {
      id: `${workspaceId}_v${newVersion}`,
      policyId: updatedPolicy.id,
      workspaceId,
      organizationId,
      version: newVersion,
      policySnapshot: updatedPolicy,
      changeSummary: changeSummary || `Published policy update v${newVersion}.`,
      authorId,
      authorName,
      authorEmail,
      createdAt: now,
    };

    // 4. Atomic Write
    const batch = adminDb.batch();
    batch.set(docRef, updatedPolicy);
    batch.set(
      adminDb.collection('performancePolicyVersions').doc(`${workspaceId}_v${newVersion}`),
      versionRecord
    );

    await batch.commit();

    return {
      success: true,
      version: newVersion,
      diff,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PolicyStudio] Error publishing policy:', err);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Retrieve the version audit history for a workspace policy.
 */
export async function getPolicyVersionHistoryAction(params: {
  workspaceId: string;
  organizationId: string;
}): Promise<{
  success: boolean;
  versions?: PolicyVersionRecord[];
  error?: string;
}> {
  try {
    const { workspaceId } = params;
    if (!workspaceId) {
      return { success: false, error: 'Missing workspaceId.' };
    }

    const snap = await adminDb
      .collection('performancePolicyVersions')
      .where('workspaceId', '==', workspaceId)
      .limit(20)
      .get();

    const versions: PolicyVersionRecord[] = [];
    snap.forEach((doc) => {
      versions.push(doc.data() as PolicyVersionRecord);
    });

    // In-memory sort by version descending
    versions.sort((a, b) => b.version - a.version);

    return {
      success: true,
      versions,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PolicyStudio] Error fetching version history:', err);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Rollback active policy to a selected historical version snapshot.
 */
export async function rollbackPolicyVersionAction(params: {
  workspaceId: string;
  organizationId: string;
  targetVersion: number;
  authorId: string;
  authorName: string;
}): Promise<{
  success: boolean;
  newVersion?: number;
  error?: string;
}> {
  try {
    const { workspaceId, organizationId, targetVersion, authorId, authorName } = params;
    if (!workspaceId || !targetVersion) {
      return { success: false, error: 'Missing target version parameters.' };
    }

    const versionSnap = await adminDb
      .collection('performancePolicyVersions')
      .doc(`${workspaceId}_v${targetVersion}`)
      .get();

    if (!versionSnap.exists) {
      return { success: false, error: `Version v${targetVersion} not found.` };
    }

    const versionData = versionSnap.data() as PolicyVersionRecord;
    const restoredSnapshot = versionData.policySnapshot;

    // Get current version to increment
    const curSnap = await adminDb.collection('performancePolicies').doc(workspaceId).get();
    const currentVersion = curSnap.exists ? (curSnap.data() as PerformancePolicy).version || 1 : 1;
    const nextVersion = currentVersion + 1;

    const now = new Date().toISOString();
    const rollbackPolicy: PerformancePolicy = {
      ...restoredSnapshot,
      version: nextVersion,
      effectiveFrom: now,
      updatedAt: now,
      updatedBy: {
        userId: authorId,
        userName: authorName,
      },
    };

    const rollbackVersionRecord: PolicyVersionRecord = {
      id: `${workspaceId}_v${nextVersion}`,
      policyId: rollbackPolicy.id,
      workspaceId,
      organizationId,
      version: nextVersion,
      policySnapshot: rollbackPolicy,
      changeSummary: `Rolled back to configuration from version v${targetVersion}.`,
      authorId,
      authorName,
      createdAt: now,
    };

    const batch = adminDb.batch();
    batch.set(adminDb.collection('performancePolicies').doc(workspaceId), rollbackPolicy);
    batch.set(
      adminDb.collection('performancePolicyVersions').doc(`${workspaceId}_v${nextVersion}`),
      rollbackVersionRecord
    );

    await batch.commit();

    return {
      success: true,
      newVersion: nextVersion,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PolicyStudio] Error rolling back policy:', err);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Reset a workspace policy back to system standard defaults.
 */
export async function resetPolicyToDefaultsAction(params: {
  workspaceId: string;
  organizationId: string;
  authorId: string;
  authorName: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { workspaceId, organizationId, authorId, authorName } = params;
    const res = await executePolicyMigration({
      workspaceId,
      organizationId,
      actorId: authorId,
      actorName: authorName,
      forceReset: true,
    });

    return {
      success: res.success,
      error: res.error,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PolicyStudio] Error resetting policy:', err);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Backoffice Multi-Tenant Policy Inspection for Super Admins.
 */
export async function getBackofficePoliciesListAction(): Promise<{
  success: boolean;
  policies?: Array<{
    workspaceId: string;
    organizationId: string;
    name: string;
    version: number;
    updatedAt: string;
    updatedBy: string;
    antiGamingSummary: string;
    dimensionsSummary: string;
  }>;
  error?: string;
}> {
  try {
    const snap = await adminDb.collection('performancePolicies').limit(50).get();
    const policies: Array<{
      workspaceId: string;
      organizationId: string;
      name: string;
      version: number;
      updatedAt: string;
      updatedBy: string;
      antiGamingSummary: string;
      dimensionsSummary: string;
    }> = [];

    snap.forEach((doc) => {
      const p = doc.data() as PerformancePolicy;
      const dims = p.dimensions;
      policies.push({
        workspaceId: p.workspaceId,
        organizationId: p.organizationId,
        name: p.name || 'Standard Policy',
        version: p.version || 1,
        updatedAt: p.updatedAt || '',
        updatedBy: p.updatedBy?.userName || 'System',
        antiGamingSummary: `Cap: ${p.antiGaming?.tieredDailyCaps?.[0]?.tier1Limit || 40} calls, Min: ${p.antiGaming?.minCallDurationSeconds || 45}s`,
        dimensionsSummary: `Act ${Math.round((dims?.activityWeight || 0.3) * 100)}% / Eff ${Math.round((dims?.effortWeight || 0.25) * 100)}% / Qua ${Math.round((dims?.qualityWeight || 0.15) * 100)}%`,
      });
    });

    return {
      success: true,
      policies,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[PolicyStudio] Error in backoffice policy fetch:', err);
    return { success: false, error: msg };
  }
}
