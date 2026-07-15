import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSendMessage } from '../automations/actions/message-actions';
import { sendMessage } from '../messaging-engine';
import { resolveContact } from '../contact-adapter';

// Mock engines/adapters
vi.mock('../messaging-engine', () => ({
  sendMessage: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../contact-adapter', () => ({
  resolveContact: vi.fn(),
}));

vi.mock('../firebase-admin', () => {
  const mockCol = {
    doc: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ organizationId: 'org_123' }),
      }),
    })),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({
      empty: false,
      docs: [
        {
          data: () => ({
            id: 'tpl_123',
            subject: 'Rendered Subject',
            body: 'Rendered Body',
          }),
        },
      ],
    }),
  };
  return {
    adminDb: {
      collection: vi.fn(() => mockCol),
    },
  };
});

describe('Automation Message Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send email if contact email is valid and score is high', async () => {
    vi.mocked(resolveContact).mockResolvedValue({
      id: 'entity_123',
      name: 'Test Entity',
      entityContacts: [
        {
          email: 'valid@example.com',
          isPrimary: true,
          emailStatus: 'valid',
          emailVerificationScore: 100,
        },
      ],
    } as any);

    await handleSendMessage(
      {
        channel: 'email',
        recipientTargets: ['primary'],
        templateCategory: 'general',
        templateType: 'custom',
      },
      {
        entityId: 'entity_123',
        workspaceId: 'ws_123',
        payload: {},
      } as any
    );

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'valid@example.com' })
    );
  });

  it('should skip email if contact emailStatus is bounced', async () => {
    vi.mocked(resolveContact).mockResolvedValue({
      id: 'entity_123',
      name: 'Test Entity',
      entityContacts: [
        {
          email: 'bounced@example.com',
          isPrimary: true,
          emailStatus: 'bounced',
          emailVerificationScore: 10,
        },
      ],
    } as any);

    const runCall = () =>
      handleSendMessage(
        {
          channel: 'email',
          recipientTargets: ['primary'],
          templateCategory: 'general',
          templateType: 'custom',
        },
        {
          entityId: 'entity_123',
          workspaceId: 'ws_123',
          payload: {},
        } as any
      );

    await expect(runCall()).rejects.toThrow(
      'Message action could not resolve any recipients to send to.'
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('should skip email if contact emailVerificationScore is less than 40', async () => {
    vi.mocked(resolveContact).mockResolvedValue({
      id: 'entity_123',
      name: 'Test Entity',
      entityContacts: [
        {
          email: 'risky@example.com',
          isPrimary: true,
          emailStatus: 'valid',
          emailVerificationScore: 30,
        },
      ],
    } as any);

    const runCall = () =>
      handleSendMessage(
        {
          channel: 'email',
          recipientTargets: ['primary'],
          templateCategory: 'general',
          templateType: 'custom',
        },
        {
          entityId: 'entity_123',
          workspaceId: 'ws_123',
          payload: {},
        } as any
      );

    await expect(runCall()).rejects.toThrow(
      'Message action could not resolve any recipients to send to.'
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('should skip email if contact emailStatus is archived', async () => {
    vi.mocked(resolveContact).mockResolvedValue({
      id: 'entity_123',
      name: 'Test Entity',
      entityContacts: [
        {
          email: 'archived@example.com',
          isPrimary: true,
          emailStatus: 'archived',
          emailVerificationScore: 100,
        },
      ],
    } as any);

    const runCall = () =>
      handleSendMessage(
        {
          channel: 'email',
          recipientTargets: ['primary'],
          templateCategory: 'general',
          templateType: 'custom',
        },
        {
          entityId: 'entity_123',
          workspaceId: 'ws_123',
          payload: {},
        } as any
      );

    await expect(runCall()).rejects.toThrow(
      'Message action could not resolve any recipients to send to.'
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
