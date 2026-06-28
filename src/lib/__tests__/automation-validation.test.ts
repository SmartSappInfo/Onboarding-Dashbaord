// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGet, mockCollection, mockDocumentsExist } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockWhere = vi.fn(() => ({
    where: mockWhere,
    limit: vi.fn(() => ({ get: mockGet })),
    get: mockGet,
  }));
  const mockDoc = vi.fn((id) => ({ id, get: mockGet }));
  const mockCollection = vi.fn(() => ({ doc: mockDoc, where: mockWhere }));
  const mockDocumentsExist = vi.fn();
  return { mockGet, mockCollection, mockDocumentsExist };
});

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: mockCollection,
    getAll: vi.fn(async (...refs) => {
      return Promise.all(
        refs.map(async (ref) => {
          const snap = await ref.get();
          return {
            id: ref.id,
            exists: snap.exists,
            data: () => snap.data(),
          };
        })
      );
    }),
  },
}));

vi.mock('../automations/repository', () => ({
  documentsExist: mockDocumentsExist,
}));

import { validateAutomationBlueprint } from '../automation-validation';

// ── Helpers ────────────────────────────────────────────────────────────────────

const makeNotificationNode = (actionType: string, config: Record<string, unknown>) => ({
  id: 'n1',
  type: 'actionNode',
  data: { label: 'Notify', actionType, config },
});

const VALID_TEMPLATE_ID = 'template-abc';

/** Sets up mocks for a happy-path notification test (template exists + is active). */
function mockValidTemplate() {
  mockDocumentsExist.mockResolvedValue(new Set([VALID_TEMPLATE_ID]));
  mockGet.mockResolvedValue({
    exists: true,
    data: () => ({ status: 'active', name: 'Alert Template', subject: 'Hello', body: 'Body' }),
  });
}

// ── Existing tests (unchanged) ─────────────────────────────────────────────────

describe('validateAutomationBlueprint', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockDocumentsExist.mockReset();
    mockGet.mockResolvedValue({
      exists: true,
      empty: false,
      data: () => ({ status: 'active', name: 'T' }),
    });
    mockDocumentsExist.mockResolvedValue(new Set());
  });

  it('rejects ADD_NOTE without content', async () => {
    await expect(
      validateAutomationBlueprint({
        triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
        nodes: [
          {
            id: 'a1',
            type: 'actionNode',
            data: { label: 'Note', actionType: 'ADD_NOTE', config: {} },
          },
        ],
      })
    ).rejects.toThrow(/note content/i);
  });

  it('includes step number reference in validation error message', async () => {
    await expect(
      validateAutomationBlueprint({
        triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
        nodes: [
          {
            id: 'a1',
            type: 'actionNode',
            position: { x: 100, y: 150 },
            data: { label: 'My Note Step', actionType: 'ADD_NOTE', config: {} },
          },
        ],
      })
    ).rejects.toThrow(/Add note in "My Note Step \(Step #1\)" requires note content/i);
  });

  it('rejects condition node without operator', async () => {
    await expect(
      validateAutomationBlueprint({
        triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
        nodes: [
          {
            id: 'c1',
            type: 'conditionNode',
            data: { label: 'If', config: { field: 'status' } },
          },
        ],
      })
    ).rejects.toThrow(/operator/i);
  });

  it('rejects RUN_AUTOMATION when target missing in Firestore', async () => {
    mockDocumentsExist.mockResolvedValue(new Set());

    await expect(
      validateAutomationBlueprint({
        triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
        nodes: [
          {
            id: 'a1',
            type: 'actionNode',
            data: {
              label: 'Chain',
              actionType: 'RUN_AUTOMATION',
              config: { automationId: 'missing-id' },
            },
          },
        ],
      })
    ).rejects.toThrow(/not found/i);
  });

  // ── Notification validation — new tests ──────────────────────────────────────

  describe('SEND_NOTIFICATION_* validation', () => {
    it('passes when templateId set and targets configured', async () => {
      mockValidTemplate();
      await expect(
        validateAutomationBlueprint({
          triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
          nodes: [
            makeNotificationNode('SEND_NOTIFICATION_EMAIL', {
              templateId: VALID_TEMPLATE_ID,
              notificationTargets: ['assignee'],
            }),
          ],
        })
      ).resolves.toBeUndefined();
    });

    it('passes for SEND_NOTIFICATION_SMS with templateId and targets', async () => {
      mockValidTemplate();
      await expect(
        validateAutomationBlueprint({
          triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
          nodes: [
            makeNotificationNode('SEND_NOTIFICATION_SMS', {
              templateId: VALID_TEMPLATE_ID,
              notificationTargets: ['custom'],
              customRecipient: '+15551234567',
            }),
          ],
        })
      ).resolves.toBeUndefined();
    });

    it('rejects when templateId is missing', async () => {
      await expect(
        validateAutomationBlueprint({
          triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
          nodes: [
            makeNotificationNode('SEND_NOTIFICATION_EMAIL', {
              notificationTargets: ['assignee'],
              // templateId intentionally absent
            }),
          ],
        })
      ).rejects.toThrow(/requires a notification template/i);
    });

    it('rejects when no targets are selected', async () => {
      await expect(
        validateAutomationBlueprint({
          triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
          nodes: [
            makeNotificationNode('SEND_NOTIFICATION_EMAIL', {
              templateId: VALID_TEMPLATE_ID,
              notificationTargets: [], // empty
            }),
          ],
        })
      ).rejects.toThrow(/at least one target/i);
    });

    it('rejects when "users" target active but no userIds provided', async () => {
      await expect(
        validateAutomationBlueprint({
          triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
          nodes: [
            makeNotificationNode('SEND_NOTIFICATION_IN_APP', {
              templateId: VALID_TEMPLATE_ID,
              notificationTargets: ['users'],
              notificationUserIds: [], // empty
            }),
          ],
        })
      ).rejects.toThrow(/no users are selected/i);
    });

    it('rejects when "custom" target active but no customRecipient provided', async () => {
      await expect(
        validateAutomationBlueprint({
          triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
          nodes: [
            makeNotificationNode('SEND_NOTIFICATION_EMAIL', {
              templateId: VALID_TEMPLATE_ID,
              notificationTargets: ['custom'],
              // customRecipient intentionally absent
            }),
          ],
        })
      ).rejects.toThrow(/no custom recipient/i);
    });

    it('rejects when selected template is not active (draft status)', async () => {
      // documentsExist passes (template doc exists), but status check fails
      mockDocumentsExist.mockResolvedValue(new Set([VALID_TEMPLATE_ID]));
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ status: 'draft', name: 'Draft Alert' }),
      });
      await expect(
        validateAutomationBlueprint({
          triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
          nodes: [
            makeNotificationNode('SEND_NOTIFICATION_EMAIL', {
              templateId: VALID_TEMPLATE_ID,
              notificationTargets: ['assignee'],
            }),
          ],
        })
      ).rejects.toThrow(/not active/i);
    });
  });

  describe('DIRECT_EMAIL and DIRECT_SMS validation', () => {
    it('passes DIRECT_EMAIL with subject, body, and recipientTargets, no templateId', async () => {
      await expect(
        validateAutomationBlueprint({
          triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
          nodes: [
            {
              id: 'a1',
              type: 'actionNode',
              data: {
                label: 'Direct Email',
                actionType: 'DIRECT_EMAIL',
                config: {
                  recipientTargets: ['triggering'],
                  directSubject: 'Hello World',
                  directBody: 'This is a direct message body.',
                },
              },
            },
          ],
        })
      ).resolves.toBeUndefined();
    });

    it('rejects DIRECT_EMAIL with missing subject', async () => {
      await expect(
        validateAutomationBlueprint({
          triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
          nodes: [
            {
              id: 'a1',
              type: 'actionNode',
              data: {
                label: 'Direct Email',
                actionType: 'DIRECT_EMAIL',
                config: {
                  recipientTargets: ['triggering'],
                  directBody: 'This is a direct message body.',
                },
              },
            },
          ],
        })
      ).rejects.toThrow(/must specify a subject line/i);
    });

    it('rejects DIRECT_EMAIL with missing body', async () => {
      await expect(
        validateAutomationBlueprint({
          triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
          nodes: [
            {
              id: 'a1',
              type: 'actionNode',
              data: {
                label: 'Direct Email',
                actionType: 'DIRECT_EMAIL',
                config: {
                  recipientTargets: ['triggering'],
                  directSubject: 'Subject',
                },
              },
            },
          ],
        })
      ).rejects.toThrow(/must specify a message body/i);
    });

    it('passes DIRECT_SMS with body and recipientTargets, no templateId', async () => {
      await expect(
        validateAutomationBlueprint({
          triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
          nodes: [
            {
              id: 'a1',
              type: 'actionNode',
              data: {
                label: 'Direct SMS',
                actionType: 'DIRECT_SMS',
                config: {
                  recipientTargets: ['triggering'],
                  directBody: 'This is a direct SMS text.',
                },
              },
            },
          ],
        })
      ).resolves.toBeUndefined();
    });

    it('rejects DIRECT_SMS with missing body', async () => {
      await expect(
        validateAutomationBlueprint({
          triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
          nodes: [
            {
              id: 'a1',
              type: 'actionNode',
              data: {
                label: 'Direct SMS',
                actionType: 'DIRECT_SMS',
                config: {
                  recipientTargets: ['triggering'],
                },
              },
            },
          ],
        })
      ).rejects.toThrow(/must specify a message body/i);
    });

    it('rejects DIRECT_SMS with missing recipient targets', async () => {
      await expect(
        validateAutomationBlueprint({
          triggers: [{ id: 't1', type: 'ENTITY_CREATED', config: {} }],
          nodes: [
            {
              id: 'a1',
              type: 'actionNode',
              data: {
                label: 'Direct SMS',
                actionType: 'DIRECT_SMS',
                config: {
                  directBody: 'Text body',
                  recipientTargets: [],
                },
              },
            },
          ],
        })
      ).rejects.toThrow(/must select at least one recipient target/i);
    });
  });
});
