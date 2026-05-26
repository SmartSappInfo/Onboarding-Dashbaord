// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGet, mockCollection } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockWhere = vi.fn(() => ({
    where: mockWhere,
    limit: vi.fn(() => ({ get: mockGet })),
    get: mockGet,
  }));
  const mockDoc = vi.fn(() => ({ get: mockGet }));
  const mockCollection = vi.fn(() => ({ doc: mockDoc, where: mockWhere }));
  return { mockGet, mockCollection };
});

vi.mock('../firebase-admin', () => ({
  adminDb: { collection: mockCollection, getAll: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../automations/repository', () => ({
  documentsExist: vi.fn().mockResolvedValue(new Set()),
}));

import { validateAutomationBlueprint } from '../automation-validation';

describe('validateAutomationBlueprint', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ exists: true, empty: false, data: () => ({ status: 'active', name: 'T' }) });
  });

  it('rejects ADD_NOTE without content', async () => {
    await expect(
      validateAutomationBlueprint({
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

  it('rejects condition node without operator', async () => {
    await expect(
      validateAutomationBlueprint({
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
    mockGet.mockResolvedValueOnce({ exists: false });

    await expect(
      validateAutomationBlueprint({
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
});
