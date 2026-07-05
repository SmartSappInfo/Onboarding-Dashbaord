// NOTE: intentionally NOT 'use server' — internal approval plumbing invoked
// only from already-authorized server actions. The executors mutate platform
// data with the APPROVER's identity and must never be public endpoints.

import { adminDb } from '../firebase-admin';
import { logBackofficeAction } from './audit-logger';
import { createAuditSnapshot } from './backoffice-utils';
import { scheduleJobExecution } from './job-execution';
import type {
  ApprovalActionKey,
  ApprovalRequest,
  AuditActor,
  PlatformJob,
  PlatformJobType,
} from './backoffice-types';

/** Approval requests expire 48h after creation (lazy expiry on read/decide). */
export const APPROVAL_TTL_MS = 48 * 60 * 60 * 1000;

export interface ExecutorResult {
  success: boolean;
  error?: string;
}

type ApprovalExecutor = (payload: Record<string, unknown>, approver: AuditActor) => Promise<ExecutorResult>;

// ─────────────────────────────────────────────────
// Enqueue
// ─────────────────────────────────────────────────

/**
 * Writes a pending approval request and audits it. The caller must already
 * hold the gated action's own permission (validated by the calling action).
 */
export async function enqueueApproval(
  actionKey: ApprovalActionKey,
  payload: Record<string, unknown>,
  summary: string,
  requestedBy: AuditActor
): Promise<{ requestId: string }> {
  const now = Date.now();
  const docRef = adminDb.collection('platform_approval_requests').doc();

  const request: Omit<ApprovalRequest, 'id'> = {
    actionKey,
    payload,
    summary,
    status: 'pending',
    requestedBy,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + APPROVAL_TTL_MS).toISOString(),
  };

  await docRef.set(request);

  await logBackofficeAction(requestedBy, 'approval.requested', 'approval_request', docRef.id, {
    metadata: { actionKey, summary },
  });

  return { requestId: docRef.id };
}

// ─────────────────────────────────────────────────
// Executors — run with the APPROVER's identity after four-eyes sign-off.
// Each mirrors the mutation the direct action used to perform, including
// its audit entry.
// ─────────────────────────────────────────────────

async function executeSuspendOrganization(payload: Record<string, unknown>, approver: AuditActor): Promise<ExecutorResult> {
  const orgId = String(payload.orgId ?? '');
  const reason = String(payload.reason ?? '');
  if (!orgId) return { success: false, error: 'Missing orgId in approval payload.' };

  const ref = adminDb.collection('organizations').doc(orgId);
  const snap = await ref.get();
  if (!snap.exists) return { success: false, error: 'Organization not found' };

  const before = createAuditSnapshot(snap.data() as Record<string, unknown>);

  await ref.update({
    status: 'suspended',
    suspendedAt: new Date().toISOString(),
    suspendedBy: approver.userId,
    suspensionReason: reason,
    updatedAt: new Date().toISOString(),
  });

  const afterSnap = await ref.get();
  await logBackofficeAction(approver, 'organization.suspend', 'organization', orgId, {
    scope: 'organization',
    scopeId: orgId,
    before,
    after: createAuditSnapshot(afterSnap.data() as Record<string, unknown>),
    metadata: { reason, viaApproval: true },
  });

  return { success: true };
}

async function executeClearActivityLogs(payload: Record<string, unknown>, approver: AuditActor): Promise<ExecutorResult> {
  const orgId = String(payload.orgId ?? '');
  if (!orgId) return { success: false, error: 'Missing orgId in approval payload.' };

  const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
  if (!orgSnap.exists) return { success: false, error: 'Organization not found' };

  let totalDeleted = 0;
  let hasMore = true;
  while (hasMore) {
    const snapshot = await adminDb.collection('activities')
      .where('organizationId', '==', orgId)
      .limit(500)
      .get();

    if (snapshot.empty) break;

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snapshot.size;
    hasMore = snapshot.size === 500;
  }

  await logBackofficeAction(approver, 'organization.clear_activity_logs', 'organization', orgId, {
    scope: 'organization',
    scopeId: orgId,
    metadata: { deletedCount: totalDeleted, viaApproval: true },
  });

  return { success: true };
}

async function executeEnableKillSwitch(payload: Record<string, unknown>, approver: AuditActor): Promise<ExecutorResult> {
  const featureId = String(payload.featureId ?? '');
  if (!featureId) return { success: false, error: 'Missing featureId in approval payload.' };

  const ref = adminDb.collection('platform_features').doc(featureId);
  const snap = await ref.get();
  if (!snap.exists) return { success: false, error: 'Feature not found' };

  const before = createAuditSnapshot(snap.data() as Record<string, unknown>);

  await ref.update({
    killSwitch: true,
    updatedAt: new Date().toISOString(),
    updatedBy: approver.userId,
  });

  const afterSnap = await ref.get();
  await logBackofficeAction(approver, 'feature.toggle_kill_switch', 'feature', featureId, {
    before,
    after: createAuditSnapshot(afterSnap.data() as Record<string, unknown>),
    metadata: { killSwitch: true, viaApproval: true },
  });

  return { success: true };
}

async function executeClearAutomationData(_payload: Record<string, unknown>, approver: AuditActor): Promise<ExecutorResult> {
  const BATCH_CAP = 499;

  async function deleteCollection(name: string): Promise<number> {
    const snap = await adminDb.collection(name).get();
    if (snap.empty) return 0;

    let batch = adminDb.batch();
    let count = 0;
    let total = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      count++;
      total++;
      if (count >= BATCH_CAP) {
        await batch.commit();
        batch = adminDb.batch();
        count = 0;
      }
    }
    if (count > 0) await batch.commit();
    return total;
  }

  const runsDeleted = await deleteCollection('automation_runs');
  const jobsDeleted = await deleteCollection('automation_jobs');

  await logBackofficeAction(approver, 'automation.clear', 'platform', 'automation_data', {
    metadata: { automation_runs: runsDeleted, automation_jobs: jobsDeleted, total: runsDeleted + jobsDeleted, viaApproval: true },
  });

  return { success: true };
}

async function executeCreateLiveJob(payload: Record<string, unknown>, approver: AuditActor): Promise<ExecutorResult> {
  const type = payload.type as PlatformJobType | undefined;
  const label = String(payload.label ?? '');
  const scope = payload.scope as PlatformJob['scope'] | undefined;
  if (!type || !scope) return { success: false, error: 'Missing job type/scope in approval payload.' };

  const docRef = adminDb.collection('platform_jobs').doc();
  const newJob: Omit<PlatformJob, 'id'> = {
    type,
    label: label || `${type}_${Date.now()}`,
    description: typeof payload.description === 'string' ? payload.description : undefined,
    status: 'pending',
    scope,
    isDryRun: false,
    progress: { total: 0, processed: 0, errors: 0 },
    logs: [{
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Live job approved and dispatched by ${approver.name} (${approver.email}).`,
    }],
    createdBy: approver,
    createdAt: new Date().toISOString(),
  };

  await docRef.set(newJob);

  await logBackofficeAction(approver, 'job.create', 'job', docRef.id, {
    before: null,
    after: createAuditSnapshot(newJob as unknown as Record<string, unknown>),
    metadata: { type, isDryRun: false, viaApproval: true },
  });

  scheduleJobExecution(docRef.id, approver);
  return { success: true };
}

export const APPROVAL_EXECUTORS: Record<ApprovalActionKey, ApprovalExecutor> = {
  'organization.suspend': executeSuspendOrganization,
  'organization.clear_activity_logs': executeClearActivityLogs,
  'feature.enable_kill_switch': executeEnableKillSwitch,
  'automation.clear': executeClearAutomationData,
  'job.create_live': executeCreateLiveJob,
};
