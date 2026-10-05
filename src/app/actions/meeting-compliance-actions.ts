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
import { sha256Hex } from '@/platform/capabilities/contracts/canonical-json';
import { defaultAuditSink } from '@/platform/capabilities/storage/audit-store';
import type {
  CompliancePolicy,
  AuditExportRecord,
  RetentionEvaluationResult,
} from '@/lib/meetings/types/compliance';
import {
  evaluateGDPRRetentionPurge,
  generateAuditExportCSV,
} from '@/lib/meetings/compliance-service';

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
export async function saveWorkspaceCompliancePolicyAction(
  policy: CompliancePolicy,
  options?: { expectedUpdatedAt?: string }
): Promise<{ success: boolean; error?: string }> {
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
 */
export async function evaluateRetentionPurgeAction(
  workspaceId: string,
  retentionDays: number
): Promise<{ success: boolean; result?: RetentionEvaluationResult; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    const meetingsSnap = await adminDb
      .collection('meetings')
      .where('workspaceId', '==', workspaceId)
      .get();

    const meetings = meetingsSnap.docs.map(doc => ({
      id: doc.id,
      meetingTime: doc.data().meetingTime || '',
      hasRecording: Boolean(doc.data().recordingUrl),
      hasTranscript: Boolean(doc.data().hasTranscript),
      isPinned: Boolean(doc.data().isPinned),
    }));

    const result = evaluateGDPRRetentionPurge(meetings, retentionDays);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
