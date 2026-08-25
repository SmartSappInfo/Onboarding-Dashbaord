import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateEventEngagementScore, validateEventPayload } from '../event-collector';
import type { IngestEventPayload } from '../event-collector';

describe('Event Collector & Telemetry Ingestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates correct engagement score for event types', () => {
    expect(calculateEventEngagementScore('document_opened')).toBe(2);
    expect(calculateEventEngagementScore('page_viewed')).toBe(1);
    expect(calculateEventEngagementScore('page_flipped')).toBe(1);
    expect(calculateEventEngagementScore('cta_clicked')).toBe(10);
    expect(calculateEventEngagementScore('lead_gate_submitted')).toBe(20);
    expect(calculateEventEngagementScore('document_completed')).toBe(10);
  });

  it('validates required payload properties correctly', () => {
    const validPayload: IngestEventPayload = {
      workspaceId: 'ws_123',
      documentId: 'doc_456',
      sessionId: 'ses_789',
      visitorId: 'vis_abc',
      eventType: 'page_flipped',
      pageNumber: 2,
    };

    expect(validateEventPayload(validPayload).valid).toBe(true);

    // Missing workspaceId
    expect(validateEventPayload({ ...validPayload, workspaceId: '' }).valid).toBe(false);

    // Missing documentId
    expect(validateEventPayload({ ...validPayload, documentId: '' }).valid).toBe(false);

    // Missing sessionId
    expect(validateEventPayload({ ...validPayload, sessionId: '' }).valid).toBe(false);

    // Missing visitorId
    expect(validateEventPayload({ ...validPayload, visitorId: '' }).valid).toBe(false);
  });
});
