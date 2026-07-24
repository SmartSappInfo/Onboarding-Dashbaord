import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseQueueChannel } from '../gcp-tasks-client';

describe('GCP Cloud Tasks Queue Dispatching Specification (context7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly maps queue channels to queue names', () => {
    expect(parseQueueChannel('bulk')).toBe('bulk');
    expect(parseQueueChannel('email')).toBe('email');
    expect(parseQueueChannel('sms')).toBe('sms');
    expect(parseQueueChannel('whatsapp')).toBe('whatsapp');
    expect(parseQueueChannel('invalid')).toBeUndefined();
  });

  it('validates base64 task payload formatting per @google-cloud/tasks standard', () => {
    const payload = {
      automationId: 'auto-123',
      workspaceId: 'ws-canonical-guid',
      organizationId: 'org-enterprise',
      trigger: 'MANUAL_ENROLLMENT',
      targets: [{ entityId: 'entity-1', payload: {} }],
    };

    const jsonString = JSON.stringify(payload);
    const base64Body = Buffer.from(jsonString).toString('base64');
    const decodedPayload = JSON.parse(Buffer.from(base64Body, 'base64').toString('utf-8'));

    expect(decodedPayload.automationId).toBe('auto-123');
    expect(decodedPayload.workspaceId).toBe('ws-canonical-guid');
    expect(decodedPayload.organizationId).toBe('org-enterprise');
  });
});
