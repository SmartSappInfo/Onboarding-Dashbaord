/**
 * @fileoverview Pure Compliance, Email Domain Whitelists & GDPR Retention Evaluator.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Minimum 30 days floor enforced for GDPR retention purge.
 * - 100% pure with zero side-effects.
 */

import type {
  CompliancePolicy,
  AuditExportRecord,
  RetentionEvaluationResult,
} from './types/compliance';

/**
 * Validates whether an email address is permitted according to workspace domain policies.
 */
export function validateEmailAgainstDomainPolicy(
  email: string,
  policy?: CompliancePolicy
): { isAllowed: boolean; reason?: string } {
  if (!policy || !email) return { isAllowed: true };

  const lowerEmail = email.toLowerCase().trim();

  // 1. Check blocked domains
  if (policy.blockedEmailDomains && policy.blockedEmailDomains.length > 0) {
    for (const blocked of policy.blockedEmailDomains) {
      const cleanBlocked = blocked.toLowerCase().trim().replace(/^@/, '');
      if (lowerEmail.endsWith(`@${cleanBlocked}`)) {
        return {
          isAllowed: false,
          reason: `Email domain @${cleanBlocked} is restricted by policy.`,
        };
      }
    }
  }

  // 2. Check allowed domains (whitelist)
  if (policy.allowedEmailDomains && policy.allowedEmailDomains.length > 0) {
    let matched = false;
    for (const allowed of policy.allowedEmailDomains) {
      const cleanAllowed = allowed.toLowerCase().trim().replace(/^@/, '');
      if (lowerEmail.endsWith(`@${cleanAllowed}`)) {
        matched = true;
        break;
      }
    }

    if (!matched) {
      return {
        isAllowed: false,
        reason: `Only authorized organization email domains are allowed to book.`,
      };
    }
  }

  return { isAllowed: true };
}

/**
 * Identifies expired recordings and transcripts eligible for GDPR data retention purge.
 */
export function evaluateGDPRRetentionPurge(
  meetings: Array<{
    id: string;
    meetingTime: string;
    hasRecording: boolean;
    hasTranscript: boolean;
    isPinned?: boolean;
  }>,
  retentionDays: number,
  referenceNow = new Date()
): RetentionEvaluationResult {
  // If retentionDays is 0 or less, retain indefinitely
  if (retentionDays <= 0) {
    return {
      eligibleRecordingsCount: 0,
      eligibleTranscriptsCount: 0,
      eligibleMeetingIds: [],
      estimatedStorageFreedMb: 0,
    };
  }

  // Enforce safety floor of 30 days
  const safeDays = Math.max(30, retentionDays);
  const cutoffMs = referenceNow.getTime() - safeDays * 86400000;

  const eligibleIds: string[] = [];
  let eligibleRecordings = 0;
  let eligibleTranscripts = 0;

  for (const m of meetings) {
    if (m.isPinned) continue; // Pinned records are never purged

    const mTimeMs = new Date(m.meetingTime).getTime();
    if (mTimeMs < cutoffMs) {
      if (m.hasRecording || m.hasTranscript) {
        eligibleIds.push(m.id);
        if (m.hasRecording) eligibleRecordings++;
        if (m.hasTranscript) eligibleTranscripts++;
      }
    }
  }

  // Estimate: ~150MB per recording, ~1MB per transcript
  const estimatedStorageFreedMb = eligibleRecordings * 150 + eligibleTranscripts * 1;

  return {
    eligibleRecordingsCount: eligibleRecordings,
    eligibleTranscriptsCount: eligibleTranscripts,
    eligibleMeetingIds: eligibleIds,
    estimatedStorageFreedMb,
  };
}

/**
 * Generates RFC 4180 compliant CSV content for audit log exports.
 */
export function generateAuditExportCSV(records: AuditExportRecord[]): string {
  const headers = [
    'Meeting ID',
    'Title',
    'Meeting Time (UTC)',
    'Host Name',
    'Participants',
    'Contact Email',
    'Recording Present',
    'AI Insights',
    'Security Status',
  ];

  const escapeCSV = (val: string | number | boolean | undefined) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = records.map(r =>
    [
      escapeCSV(r.meetingId),
      escapeCSV(r.meetingTitle),
      escapeCSV(r.meetingTime),
      escapeCSV(r.hostName),
      escapeCSV(r.participantCount),
      escapeCSV(r.contactEmail),
      escapeCSV(r.recordingPresent),
      escapeCSV(r.aiInsightsGenerated),
      escapeCSV(r.securityStatus),
    ].join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}
