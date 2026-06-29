import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSendMessage } from '../automations/actions/message-actions';
import type { ExecutionContext } from '../automations/execution-types';

/**
 * Behavior coverage for the templated SEND_MESSAGE / SEND_EMAIL / SEND_SMS /
 * SEND_WHATSAPP automation step (handleSendMessage). Focus areas:
 *  - recipient resolution for every configurable target (triggering / primary /
 *    signatories / roles / all / fixed)
 *  - channel → email-vs-phone field selection
 *  - templateId path vs templateCategory+type (resolveAndRender) path
 *  - failure surfacing (throws on { success: false })
 */

const mockSendMessage = vi.fn().mockResolvedValue({ success: true, logId: 'log-1' });
const mockResolveContact = vi.fn();
const mockResolveAndRender = vi.fn().mockResolvedValue({ subject: 'Rendered Subject', body: 'Rendered Body' });

vi.mock('../messaging-engine', () => ({
  sendMessage: (args: Record<string, unknown>) => mockSendMessage(args),
}));

vi.mock('../contact-adapter', () => ({
  resolveContact: (id: string, wsId: string) => mockResolveContact(id, wsId),
}));

vi.mock('../template-resolver', () => ({
  resolveAndRender: (...args: unknown[]) => mockResolveAndRender(...args),
}));

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ organizationId: 'org-1' }) }),
      })),
    })),
  },
}));

const baseContext = (overrides: Partial<ExecutionContext> = {}): ExecutionContext => ({
  automationId: 'auto-1',
  runId: 'run-1',
  workspaceId: 'ws-1',
  entityId: 'ent-1',
  entityType: 'institution',
  organizationId: 'org-1',
  payload: {},
  ...overrides,
});

const CONTACT = {
  id: 'ent-1',
  primaryContactEmail: 'fallback-primary@x.com',
  primaryContactPhone: '+233200000000',
  contacts: [],
  entityContacts: [
    { email: 'primary@x.com', phone: '+233201111111', isPrimary: true, isSignatory: false, typeLabel: 'Owner', typeKey: 'owner' },
    { email: 'sig@x.com', phone: '+233202222222', isPrimary: false, isSignatory: true, typeLabel: 'Signatory', typeKey: 'signatory' },
    { email: 'finance@x.com', phone: '+233203333333', isPrimary: false, isSignatory: false, typeLabel: 'Finance', typeKey: 'finance' },
  ],
};

describe('handleSendMessage (SEND_MESSAGE / SEND_EMAIL / SEND_SMS / SEND_WHATSAPP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({ success: true, logId: 'log-1' });
    mockResolveContact.mockResolvedValue(CONTACT);
  });

  const recipientsOf = () =>
    mockSendMessage.mock.calls.map((c) => (c[0] as Record<string, unknown>).recipient);

  it('requires a template (throws when neither templateId nor category+type given)', async () => {
    await expect(handleSendMessage({ recipientTargets: ['fixed'], recipient: 'a@x.com' }, baseContext()))
      .rejects.toThrow(/template configuration/i);
  });

  it("resolves the 'triggering' contact from the payload email", async () => {
    await handleSendMessage(
      { templateId: 'tmpl-1', channel: 'email', recipientTargets: ['triggering'] },
      baseContext({ payload: { email: 'trigger@x.com' } }),
    );
    expect(recipientsOf()).toEqual(['trigger@x.com']);
  });

  it("falls back to the primary contact when 'triggering' has no payload value", async () => {
    await handleSendMessage(
      { templateId: 'tmpl-1', channel: 'email', recipientTargets: ['triggering'] },
      baseContext({ payload: {} }),
    );
    expect(recipientsOf()).toEqual(['primary@x.com']);
  });

  it("resolves the 'primary' entity contact email", async () => {
    await handleSendMessage(
      { templateId: 'tmpl-1', channel: 'email', recipientTargets: ['primary'] },
      baseContext(),
    );
    expect(recipientsOf()).toEqual(['primary@x.com']);
  });

  it("resolves 'signatories' to all signatory contacts", async () => {
    await handleSendMessage(
      { templateId: 'tmpl-1', channel: 'email', recipientTargets: ['signatories'] },
      baseContext(),
    );
    expect(recipientsOf()).toEqual(['sig@x.com']);
  });

  it("resolves 'roles' by typeLabel/typeKey (case-insensitive)", async () => {
    await handleSendMessage(
      { templateId: 'tmpl-1', channel: 'email', recipientTargets: ['roles'], recipientRoles: ['finance'] },
      baseContext(),
    );
    expect(recipientsOf()).toEqual(['finance@x.com']);
  });

  it("resolves 'all' to every entity contact (deduped)", async () => {
    await handleSendMessage(
      { templateId: 'tmpl-1', channel: 'email', recipientTargets: ['all'] },
      baseContext(),
    );
    expect(recipientsOf().sort()).toEqual(['finance@x.com', 'primary@x.com', 'sig@x.com']);
  });

  it("resolves 'fixed' to the configured recipient", async () => {
    await handleSendMessage(
      { templateId: 'tmpl-1', channel: 'email', recipientTargets: ['fixed'], recipient: 'manual@x.com' },
      baseContext(),
    );
    expect(recipientsOf()).toEqual(['manual@x.com']);
  });

  it('dedupes when triggering + primary resolve to the same address', async () => {
    await handleSendMessage(
      { templateId: 'tmpl-1', channel: 'email', recipientTargets: ['triggering', 'primary'] },
      baseContext({ payload: { email: 'primary@x.com' } }),
    );
    expect(recipientsOf()).toEqual(['primary@x.com']);
  });

  it('uses the PHONE field for the sms channel', async () => {
    await handleSendMessage(
      { templateId: 'tmpl-1', channel: 'sms', recipientTargets: ['primary'] },
      baseContext(),
    );
    expect(recipientsOf()).toEqual(['+233201111111']);
  });

  it('uses the PHONE field for the whatsapp channel', async () => {
    await handleSendMessage(
      { templateId: 'tmpl-1', channel: 'whatsapp', recipientTargets: ['all'] },
      baseContext(),
    );
    expect(recipientsOf().sort()).toEqual(['+233201111111', '+233202222222', '+233203333333']);
  });

  it('passes templateId, org, automation/run/node correlation to sendMessage', async () => {
    await handleSendMessage(
      { templateId: 'tmpl-1', channel: 'email', recipientTargets: ['fixed'], recipient: 'a@x.com', senderProfileId: 'sp-1' },
      baseContext(),
      'node-7',
    );
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'tmpl-1',
        senderProfileId: 'sp-1',
        organizationId: 'org-1',
        recipient: 'a@x.com',
        entityId: 'ent-1',
        workspaceId: 'ws-1',
        automationId: 'auto-1',
        runId: 'run-1',
        nodeId: 'node-7',
      }),
    );
  });

  it('throws when no recipient can be resolved', async () => {
    mockResolveContact.mockResolvedValueOnce({ entityContacts: [], contacts: [] });
    await expect(
      handleSendMessage({ templateId: 'tmpl-1', channel: 'email', recipientTargets: ['primary'] }, baseContext({ payload: {} })),
    ).rejects.toThrow(/could not resolve any recipients/i);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('throws when sendMessage reports failure (surfaces the provider error)', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: false, error: 'RESEND_API_KEY is not configured.' });
    await expect(
      handleSendMessage({ templateId: 'tmpl-1', channel: 'email', recipientTargets: ['fixed'], recipient: 'a@x.com' }, baseContext()),
    ).rejects.toThrow('RESEND_API_KEY is not configured.');
  });

  it('uses the category/type path: renders via resolveAndRender then sends the rendered body', async () => {
    await handleSendMessage(
      { templateCategory: 'reminders', templateType: 'generic', channel: 'email', recipientTargets: ['fixed'], recipient: 'a@x.com' },
      baseContext(),
    );
    expect(mockResolveAndRender).toHaveBeenCalledWith('reminders', 'generic', 'org-1', expect.any(Object));
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'a@x.com', body: 'Rendered Body', subject: 'Rendered Subject' }),
    );
  });
});
