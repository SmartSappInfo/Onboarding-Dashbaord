/**
 * @fileoverview Domain Types for Enterprise Compliance, Data Retention & Audit Exports.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Retention rules must be strictly tested to prevent accidental permanent deletion.
 * - Zero 'any' policy strictly enforced.
 */

export interface CompliancePolicy {
  workspaceId: string;
  allowedEmailDomains?: string[]; // e.g. ["@acme.edu", "@enterprise.com"]
  blockedEmailDomains?: string[]; // e.g. ["@tempmail.com"]
  retentionPeriodDays?: number;   // e.g. 90 days (0 = retain forever)
  autoPurgeTranscripts?: boolean;
  autoPurgeRecordings?: boolean;
  requireMeetingPasscode?: boolean;
  enforceHostConsentForAI?: boolean;
  updatedAt: string;
}

export interface AuditExportRecord {
  meetingId: string;
  meetingTitle: string;
  meetingTime: string;
  hostName: string;
  participantCount: number;
  contactEmail?: string;
  recordingPresent: boolean;
  aiInsightsGenerated: boolean;
  securityStatus: string;
}

export interface RetentionEvaluationResult {
  eligibleRecordingsCount: number;
  eligibleTranscriptsCount: number;
  eligibleMeetingIds: string[];
  estimatedStorageFreedMb: number;
}
