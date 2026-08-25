import { describe, it, expect } from 'vitest';
import {
  validateEmailAgainstDomainPolicy,
  evaluateGDPRRetentionPurge,
  generateAuditExportCSV,
} from '../compliance-service';
import type { CompliancePolicy, AuditExportRecord } from '../types/compliance';

describe('Compliance & GDPR Retention Service', () => {
  it('enforces email domain whitelist policies', () => {
    const policy: CompliancePolicy = {
      workspaceId: 'w1',
      allowedEmailDomains: ['@acme.edu', '@smart.com'],
      updatedAt: '2026-08-25T10:00:00Z',
    };

    const allowed = validateEmailAgainstDomainPolicy('student@acme.edu', policy);
    expect(allowed.isAllowed).toBe(true);

    const rejected = validateEmailAgainstDomainPolicy('intruder@random.com', policy);
    expect(rejected.isAllowed).toBe(false);
  });

  it('evaluates GDPR data retention and ignores pinned meetings', () => {
    const now = new Date('2026-08-25T12:00:00Z');
    const meetings = [
      {
        id: 'm_old_1',
        meetingTime: '2026-01-01T10:00:00Z', // > 90 days ago
        hasRecording: true,
        hasTranscript: true,
      },
      {
        id: 'm_old_pinned',
        meetingTime: '2026-01-01T10:00:00Z', // > 90 days ago but pinned!
        hasRecording: true,
        hasTranscript: true,
        isPinned: true,
      },
      {
        id: 'm_recent',
        meetingTime: '2026-08-20T10:00:00Z', // 5 days ago
        hasRecording: true,
        hasTranscript: false,
      },
    ];

    const result = evaluateGDPRRetentionPurge(meetings, 90, now);
    expect(result.eligibleMeetingIds).toEqual(['m_old_1']);
    expect(result.eligibleRecordingsCount).toBe(1);
    expect(result.eligibleTranscriptsCount).toBe(1);
    expect(result.estimatedStorageFreedMb).toBe(151); // 150 + 1
  });

  it('generates well-formatted RFC 4180 audit CSV export', () => {
    const records: AuditExportRecord[] = [
      {
        meetingId: 'm1',
        meetingTitle: 'Annual Strategy',
        meetingTime: '2026-08-25T10:00:00Z',
        hostName: 'Alice',
        participantCount: 5,
        contactEmail: 'client@example.com',
        recordingPresent: true,
        aiInsightsGenerated: true,
        securityStatus: 'compliant',
      },
    ];

    const csv = generateAuditExportCSV(records);
    expect(csv).toContain('Meeting ID,Title,Meeting Time (UTC)');
    expect(csv).toContain('"m1","Annual Strategy","2026-08-25T10:00:00Z"');
  });
});
