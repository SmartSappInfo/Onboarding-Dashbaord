import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Headline regression guard: a send for Org-A must NEVER resolve Org-B's sender.
 *
 * Drives the REAL engine (`sendMessage`) with a two-org Firestore mock and
 * asserts the org-scoped resolver picks Org-A's sender, hard-rejects an explicit
 * Org-B sender, and surfaces a failure notice when no org sender exists. On the
 * pre-isolation code this would have silently picked a global default — the leak
 * this whole change closes.
 *
 * Note: the engine imports `./firebase-admin` (relative) but the sender resolver
 * and org-key helpers import it via the `@/lib/firebase-admin` alias, so BOTH
 * specifiers are mocked with one shared factory. Shared state lives in
 * `vi.hoisted` so the factories can read it safely.
 */

const h = vi.hoisted(() => {
  const config = { templateOrgId: 'orgA', orgADefaultSms: 'sender-A' as string | null };
  const scheduledWrites: Array<Record<string, unknown>> = [];
  const notifySpy = vi.fn().mockResolvedValue(undefined);
  const senders: Record<string, { organizationId: string; channel: string; isActive: boolean; identifier: string; name: string }> = {
    'sender-A': { organizationId: 'orgA', channel: 'sms', isActive: true, identifier: 'ORGA', name: 'Org A Sender' },
    'sender-B': { organizationId: 'orgB', channel: 'sms', isActive: true, identifier: 'ORGB', name: 'Org B Sender' },
  };

  const docResult = (exists: boolean, data: unknown) => ({ exists, id: 'x', data: () => data });
  const emptyWhere = () => {
    const chain = { where: () => chain, limit: () => chain, get: async () => ({ empty: true, docs: [] }) };
    return chain;
  };

  const makeAdminDb = () => ({
    adminDb: {
      batch: () => ({ set: () => {}, update: () => {}, commit: async () => {} }),
      collection: (name: string) => {
        if (name === 'message_templates') {
          return { doc: () => ({ get: async () => docResult(true, {
            channel: 'sms', scope: 'organization', organizationId: config.templateOrgId,
            category: 'general', name: 'T', body: 'Hi {{name}}', contentMode: 'plain_text',
          }) }) };
        }
        if (name === 'organizations') {
          return { doc: (id: string) => ({ get: async () => docResult(true, {
            name: id,
            defaultSenderProfileIds: id === 'orgA' && config.orgADefaultSms ? { sms: config.orgADefaultSms } : {},
          }) }) };
        }
        if (name === 'sender_profiles') {
          // Echo the requested id — the engine reads snap.id to build the profile.
          return { doc: (id: string) => ({ get: async () => ({ exists: !!senders[id], id, data: () => senders[id] }) }) };
        }
        if (name === 'workspaces') {
          return { doc: () => ({ get: async () => docResult(true, { organizationId: 'orgA' }) }) };
        }
        if (name === 'message_styles') {
          return { where: emptyWhere };
        }
        return {
          where: emptyWhere,
          add: async (data: Record<string, unknown>) => {
            if (data && data.status === 'pending') scheduledWrites.push(data);
            return { id: `doc-${scheduledWrites.length}` };
          },
          doc: () => ({ get: async () => docResult(false, undefined), set: async () => {}, update: async () => {} }),
        };
      },
    },
  });

  return { config, scheduledWrites, notifySpy, senders, makeAdminDb };
});

vi.mock('../../firebase-admin', () => h.makeAdminDb());
vi.mock('@/lib/firebase-admin', () => h.makeAdminDb());
vi.mock('../../resend-service', () => ({ sendEmail: vi.fn(), sendBatchEmails: vi.fn() }));
vi.mock('../../mnotify-service', () => ({ sendSms: vi.fn().mockResolvedValue({ summary: { _id: 'm1' }, status: 'success' }) }));
vi.mock('../../activity-logger', () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../suppression-service', () => ({ isSuppressed: vi.fn().mockResolvedValue(false) }));
// Keep the unsubscribe-link + hygiene side modules from touching Firestore.
vi.mock('../../services/unsubscribe-service', () => ({ generateSecureUnsubscribeLink: vi.fn().mockResolvedValue('https://x/unsub') }));
vi.mock('../../hygiene-repository', () => ({ ContactHygieneRepository: { getCache: vi.fn().mockResolvedValue(null) } }));
vi.mock('../../phone-hygiene-repository', () => ({ PhoneHygieneRepository: { getCache: vi.fn().mockResolvedValue(null), recordSmsOutcome: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../../messaging-branding', () => ({ resolveOrgBrandingVars: vi.fn().mockResolvedValue({}) }));
vi.mock('../messaging-failure-notice', () => ({ notifyMessagingFailure: (...args: unknown[]) => h.notifySpy(...args) }));

import { sendMessage } from '../../messaging-engine';

describe('cross-tenant sender isolation (regression guard)', () => {
  beforeEach(() => {
    h.scheduledWrites.length = 0;
    h.notifySpy.mockClear();
    h.config.templateOrgId = 'orgA';
    h.config.orgADefaultSms = 'sender-A';
  });

  it("resolves Org-A's own default sender, never another org's", async () => {
    const result = await sendMessage({
      templateId: 'tmpl-sms',
      senderProfileId: 'default',
      organizationId: 'orgA',
      recipient: '+233200000000',
      variables: { name: 'Alice' },
      scheduledAt: '2026-07-01T10:00:00Z',
      workspaceId: 'ws-A',
    });

    expect(result.success).toBe(true);
    expect(h.scheduledWrites).toHaveLength(1);
    expect(h.scheduledWrites[0].senderProfileId).toBe('sender-A');
    expect(h.scheduledWrites[0].senderIdentifier).toBe('ORGA');
    expect(h.notifySpy).not.toHaveBeenCalled();
  });

  it('hard-rejects an explicit sender owned by another org (no silent fallthrough)', async () => {
    // No org default → the explicit Org-B id is the only candidate; it must be
    // rejected outright, never falling through to anything.
    h.config.orgADefaultSms = null;
    const result = await sendMessage({
      templateId: 'tmpl-sms',
      senderProfileId: 'sender-B', // Org-B's sender on an Org-A send
      organizationId: 'orgA',
      recipient: '+233200000000',
      variables: { name: 'Alice' },
      workspaceId: 'ws-A',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/different organization/i);
    expect(h.scheduledWrites).toHaveLength(0);
    expect(h.notifySpy).toHaveBeenCalledTimes(1);
    expect(h.notifySpy.mock.calls[0][0]).toMatchObject({ orgId: 'orgA', outcome: 'cross_org_explicit' });
  });

  it('fails with a notice when the org has no configured sender', async () => {
    h.config.orgADefaultSms = null; // no org default
    const result = await sendMessage({
      templateId: 'tmpl-sms',
      senderProfileId: 'default',
      organizationId: 'orgA',
      recipient: '+233200000000',
      variables: { name: 'Alice' },
      workspaceId: 'ws-A',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no SMS sender/i);
    expect(h.notifySpy).toHaveBeenCalledTimes(1);
    expect(h.notifySpy.mock.calls[0][0]).toMatchObject({ orgId: 'orgA', outcome: 'no_sender' });
  });
});
