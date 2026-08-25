'use server';

/**
 * @fileoverview Server Actions for Enterprise Compliance, Domain Whitelists & Audit Exports.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Queries are scoped strictly to active workspaceId.
 */

import { adminDb } from '@/lib/firebase-admin';
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
  try {
    const docRef = adminDb.collection('meeting_compliance_policies').doc(workspaceId);
    const snap = await docRef.get();

    if (!snap.exists) {
      const defaultPolicy: CompliancePolicy = {
        workspaceId,
        retentionPeriodDays: 0, // Indefinite by default
        requireMeetingPasscode: false,
        enforceHostConsentForAI: false,
        updatedAt: new Date().toISOString(),
      };
      return { success: true, policy: defaultPolicy };
    }

    return { success: true, policy: snap.data() as CompliancePolicy };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Saves workspace compliance policy.
 */
export async function saveWorkspaceCompliancePolicyAction(
  policy: CompliancePolicy
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('meeting_compliance_policies').doc(policy.workspaceId);
    await docRef.set({
      ...policy,
      updatedAt: new Date().toISOString(),
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
