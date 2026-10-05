'use server';

/**
 * @fileoverview Server Actions for Enterprise Compliance, Domain Whitelists & Audit Exports.
 *
 * SECURITY (Phase 11 M1 · T0, finding G2): saving a policy only checked `requireAuth()`, so any
 * signed-in user of any organization could overwrite any workspace's consent/retention settings.
 * Saving now needs `meetings_manage` in that workspace, merges only page-editable fields, can refuse
 * stale edits and records an append-only before/after history plus a hash-chained audit entry.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Queries are scoped strictly to active workspaceId.
 * - Never widen `CompliancePolicyUpdateSchema` with fields the page does not own.
 */

import { randomUUID } from 'node:crypto';
import { adminDb } from '@/lib/firebase-admin';
import { requireWorkspace } from '@/lib/auth/require-auth';
import { requireMeetingsPermission } from '@/lib/meetings/meeting-auth';
import {
  CompliancePolicyUpdateSchema,
  readCompliancePolicy,
  updateCompliancePolicy,
} from '@/lib/meetings/compliance-policy-store';
import { planWorkspaceRetention } from '@/lib/meetings/retention-service';
import { requireMeetingAccess } from '@/lib/meetings/meeting-auth';
import { sha256Hex } from '@/platform/capabilities/contracts/canonical-json';
import { defaultAuditSink } from '@/platform/capabilities/storage/audit-store';
import type {
  CompliancePolicy,
  AuditExportRecord,
  RetentionEvaluationResult,
} from '@/lib/meetings/types/compliance';
import { generateAuditExportCSV } from '@/lib/meetings/compliance-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Loads workspace compliance policy.
 */
export async function getWorkspaceCompliancePolicyAction(
  workspaceId: string
): Promise<{ success: boolean; policy?: CompliancePolicy; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    const policy = await readCompliancePolicy(adminDb, workspaceId, new Date().toISOString());
    return { success: true, policy };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Saves workspace compliance policy.
 */
/** Thrown inside the save when the confirmed preview no longer matches (Rule 22). */
class ImpactNotConfirmedError extends Error {
  constructor() {
    super('The data this change would remove has changed. Review the preview and confirm again.');
    this.name = 'ImpactNotConfirmedError';
  }
}

/**
 * Read-only preview of what a retention setting would remove on the next run (Rules 21/42).
 * The returned `candidateSetHash` is what the person confirms when switching to enforced mode or
 * tightening retention; the save is refused if the data set changed in between.
 */
export async function previewRetentionImpactAction(
  workspaceId: string,
  proposed: { retentionPeriodDays: number; autoPurgeTranscripts: boolean; autoPurgeRecordings: boolean }
): Promise<{ success: boolean; preview?: { meetings: number; transcripts: number; recordings: number; intelligence: number; truncated: boolean; candidateSetHash: string; cutoffIso: string }; error?: string }> {
  await requireMeetingsPermission(workspaceId, 'meetings_manage');
  try {
    const days = Number.isFinite(proposed?.retentionPeriodDays) ? Math.max(0, Math.floor(proposed.retentionPeriodDays)) : 0;
    const plan = await planWorkspaceRetention(adminDb, {
      workspaceId,
      nowMs: Date.now(),
      policyOverride: { retentionPeriodDays: days, autoPurgeTranscripts: proposed?.autoPurgeTranscripts === true, autoPurgeRecordings: proposed?.autoPurgeRecordings === true },
    });
    return { success: true, preview: { ...plan.counts, truncated: plan.truncated, candidateSetHash: plan.candidateSetHash, cutoffIso: plan.cutoffIso } };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

export async function saveWorkspaceCompliancePolicyAction(
  policy: CompliancePolicy,
  options?: { expectedUpdatedAt?: string; confirmedImpactHash?: string }
): Promise<{ success: boolean; error?: string; code?: 'IMPACT_NOT_CONFIRMED' }> {
  const parsed = CompliancePolicyUpdateSchema.safeParse(policy);
  if (!parsed.success) {
    return { success: false, error: 'Please check the settings and try again.' };
  }
  const ctx = await requireMeetingsPermission(parsed.data.workspaceId, 'meetings_manage');

  try {
    const startMs = Date.now();
    const nowIso = new Date(startMs).toISOString();
    const { before, after } = await updateCompliancePolicy(adminDb, {
      update: parsed.data,
      actorUid: ctx.uid,
      nowIso,
      expectedUpdatedAt: options?.expectedUpdatedAt,
      // Approval binding (Rules 21/22): changes that can delete more data must match the exact
      // preview the person confirmed.
      assertImpactConfirmed: async (after) => {
        const plan = await planWorkspaceRetention(adminDb, {
          workspaceId: parsed.data.workspaceId,
          nowMs: startMs,
          policyOverride: {
            retentionPeriodDays: typeof after.retentionPeriodDays === 'number' ? after.retentionPeriodDays : 0,
            autoPurgeTranscripts: after.autoPurgeTranscripts === true,
            autoPurgeRecordings: after.autoPurgeRecordings === true,
          },
        });
        if (!options?.confirmedImpactHash || options.confirmedImpactHash !== plan.candidateSetHash) throw new ImpactNotConfirmedError();
      },
    });

    // Hash-chained audit entry (Rule 40). Content lives in the history doc; the chain stores hashes.
    await defaultAuditSink({
      executionId: randomUUID(),
      capabilityId: 'meeting.update_compliance_policy',
      capabilityVersion: 'legacy-action',
      userId: ctx.uid,
      organizationId: ctx.profile.organizationId ?? '',
      workspaceId: parsed.data.workspaceId,
      correlationId: randomUUID(),
      decision: 'allowed',
      outcome: 'succeeded',
      durationMs: Math.max(0, Date.now() - startMs),
      stateChanged: 'yes',
      timestamp: nowIso,
      inputHash: sha256Hex({ before, after }),
    }).catch((auditErr: unknown) => {
      // CAUTION: the history doc already holds before/after; a chain write failure is logged loudly.
      console.error('[saveWorkspaceCompliancePolicyAction] audit write failed:', auditErr);
    });

    return { success: true };
  } catch (err) {
    if (err instanceof ImpactNotConfirmedError) return { success: false, code: 'IMPACT_NOT_CONFIRMED', error: err.message };
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Turns legal hold on or off for one meeting (M1 · T6). Held meetings are never purged. Records who
 * and why; audited. Non-delegable: this is a human Server Action only (no agent capability).
 */
export async function setMeetingLegalHoldAction(
  workspaceId: string,
  meetingId: string,
  hold: { on: boolean; reason?: string }
): Promise<{ success: boolean; error?: string }> {
  const { ctx } = await requireMeetingAccess(workspaceId, meetingId, 'meetings_manage');
  try {
    const nowIso = new Date().toISOString();
    const reason = typeof hold?.reason === 'string' ? hold.reason.trim().slice(0, 500) : '';
    const on = hold?.on === true;
    await adminDb.collection('meetings').doc(meetingId).update({
      legalHold: { on, by: ctx.uid, at: nowIso, ...(reason ? { reason } : {}) },
      updatedAt: nowIso,
    });
    await defaultAuditSink({
      executionId: randomUUID(),
      capabilityId: 'meeting.set_legal_hold',
      capabilityVersion: 'legacy-action',
      userId: ctx.uid,
      organizationId: ctx.profile.organizationId ?? '',
      workspaceId,
      correlationId: randomUUID(),
      decision: 'allowed',
      outcome: 'succeeded',
      durationMs: 0,
      stateChanged: 'yes',
      timestamp: nowIso,
      inputHash: sha256Hex({ meetingId, on, reason }),
    }).catch((auditErr: unknown) => console.error('[setMeetingLegalHoldAction] audit failed:', auditErr));
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Exports immutable CSV audit logs of all meetings in a workspace.
 */
export async function exportMeetingAuditLogsAction(
  workspaceId: string
): Promise<{ success: boolean; csvContent?: string; totalRecords?: number; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    const meetingsSnap = await adminDb
      .collection('meetings')
      .where('workspaceId', '==', workspaceId)
      .limit(300)
      .get();

    const records: AuditExportRecord[] = meetingsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        meetingId: doc.id,
        meetingTitle: data.title || 'Meeting',
        meetingTime: data.meetingTime || '',
        hostName: data.hostName || 'Host',
        participantCount: data.attendeeCount || 1,
        contactEmail: data.contactEmail,
        recordingPresent: Boolean(data.recordingUrl),
        aiInsightsGenerated: Boolean(data.aiInsights),
        securityStatus: data.status || 'scheduled',
      };
    });

    const csvContent = generateAuditExportCSV(records);
    return { success: true, csvContent, totalRecords: records.length };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Evaluates records eligible for GDPR data retention purge.
 *
 * Phase 11 M1 · T6: this read EVERY meeting of the workspace (unbounded, Rule 9) with its own copy
 * of the rules. It now uses the same bounded planner as the retention run (legal hold, pinned,
 * 30-day floor, owned data only), so the page shows exactly what a run would remove. The result
 * shape is unchanged for the Compliance page.
 */
export async function evaluateRetentionPurgeAction(
  workspaceId: string,
  retentionDays: number
): Promise<{ success: boolean; result?: RetentionEvaluationResult; error?: string }> {
  await requireWorkspace(workspaceId);

  try {
    const plan = await planWorkspaceRetention(adminDb, {
      workspaceId,
      nowMs: Date.now(),
      policyOverride: { retentionPeriodDays: Number(retentionDays) || 0, autoPurgeTranscripts: true, autoPurgeRecordings: true },
    });
    const result: RetentionEvaluationResult = {
      eligibleRecordingsCount: plan.counts.recordings,
      eligibleTranscriptsCount: plan.counts.transcripts,
      eligibleMeetingIds: plan.candidates.map((c) => c.meetingId),
      // Same estimate as before: ~150 MB per recording, ~1 MB per transcript.
      estimatedStorageFreedMb: plan.counts.recordings * 150 + plan.counts.transcripts,
    };
    return { success: true, result };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
