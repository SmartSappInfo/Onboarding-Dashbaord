import { describe, it, expect } from 'vitest';
import { failureNoticeId, buildFailureBody, buildFailureTitle } from '../messaging-failure-notice';

describe('failureNoticeId', () => {
  const base = { orgId: 'orgA', templateId: 't1', channel: 'sms' as const, recipient: '+233200000000' };

  it('is stable for the same failure inputs', () => {
    expect(failureNoticeId(base)).toBe(failureNoticeId({ ...base }));
  });

  it('differs when a component changes', () => {
    expect(failureNoticeId(base)).not.toBe(failureNoticeId({ ...base, channel: 'email' }));
    expect(failureNoticeId(base)).not.toBe(failureNoticeId({ ...base, recipient: '+233200000001' }));
    expect(failureNoticeId(base)).not.toBe(failureNoticeId({ ...base, orgId: 'orgB' }));
  });

  it('produces a Firestore-safe id (no slashes, non-empty)', () => {
    const id = failureNoticeId(base);
    expect(id.length).toBeGreaterThan(0);
    expect(id).not.toContain('/');
  });
});

describe('buildFailureBody', () => {
  it('explains a missing-sender failure actionably', () => {
    const body = buildFailureBody('no_sender', 'sms');
    expect(body).toMatch(/no SMS sender/i);
    expect(body).toMatch(/default sender/i);
  });

  it('explains a cross-org sender rejection', () => {
    const body = buildFailureBody('cross_org_explicit', 'email');
    expect(body).toMatch(/different organization/i);
  });
});

describe('buildFailureTitle', () => {
  it('names the channel', () => {
    expect(buildFailureTitle('whatsapp')).toMatch(/WhatsApp/i);
  });
});
