import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  duplicateDealAction, 
  archiveDealAction, 
  unarchiveDealAction, 
  mergeDealsAction 
} from '../deal-actions';
import type { Deal, DealMergeOptions } from '@/lib/types';

// Mock canUser
let permissionGranted = true;
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn().mockImplementation(async () => {
    return { granted: permissionGranted, reason: permissionGranted ? undefined : 'Permission denied' };
  }),
}));

// Mock activity logger
let loggedActivities: Array<Record<string, unknown>> = [];
vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockImplementation(async (activity: Record<string, unknown>) => {
    loggedActivities.push(activity);
  }),
}));

// Mock deal-expected-close
vi.mock('../../admin/pipeline/utils/deal-expected-close', () => ({
  calculateExpectedCloseDate: vi.fn().mockResolvedValue('2026-10-15T00:00:00.000Z'),
}));

// Mock Firestore adminDb
const mockDealsStore = new Map<string, Deal>();
const mockTasksStore = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((name: string) => {
        if (name === 'deals') {
          return {
            doc: vi.fn((id: string) => ({
              id,
              get: vi.fn().mockImplementation(async () => ({
                exists: mockDealsStore.has(id),
                data: () => mockDealsStore.get(id),
              })),
              update: vi.fn().mockImplementation(async (data: Partial<Deal>) => {
                const existing = mockDealsStore.get(id);
                if (existing) {
                  mockDealsStore.set(id, { ...existing, ...data } as Deal);
                }
              }),
            })),
            add: vi.fn().mockImplementation(async (data: Omit<Deal, 'id'>) => {
              const newId = `deal-new-${Date.now()}`;
              const newDeal = { id: newId, ...data } as Deal;
              mockDealsStore.set(newId, newDeal);
              return { id: newId };
            }),
          };
        }
        if (name === 'onboardingStages') {
          return {
            doc: vi.fn((_id: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ name: 'Qualified Stage' }),
              }),
            })),
          };
        }
        if (name === 'tasks') {
          return {
            where: vi.fn((field: string, _op: string, val: string) => ({
              get: vi.fn().mockImplementation(async () => {
                const matching: Array<{ ref: { id: string }, data: () => Record<string, unknown> }> = [];
                mockTasksStore.forEach((task, id) => {
                  if (task[field] === val) {
                    matching.push({
                      ref: { id },
                      data: () => task,
                    });
                  }
                });
                return {
                  empty: matching.length === 0,
                  docs: matching,
                };
              }),
            })),
          };
        }
        return {};
      }),
      getAll: vi.fn().mockImplementation(async (...refs: Array<{ id: string }>) => {
        return refs.map(ref => ({
          exists: mockDealsStore.has(ref.id),
          data: () => mockDealsStore.get(ref.id),
        }));
      }),
      batch: vi.fn(() => ({
        update: vi.fn((ref: { id: string }, data: Record<string, unknown>) => {
          const task = mockTasksStore.get(ref.id);
          if (task) {
            mockTasksStore.set(ref.id, { ...task, ...data });
          }
          const deal = mockDealsStore.get(ref.id);
          if (deal) {
            mockDealsStore.set(ref.id, { ...deal, ...data } as Deal);
          }
        }),
        commit: vi.fn().mockResolvedValue(undefined),
      })),
    },
  };
});

describe('Phase 1 Deal Server Actions Suite', () => {
  beforeEach(() => {
    mockDealsStore.clear();
    mockTasksStore.clear();
    loggedActivities = [];
    permissionGranted = true;

    // Seed mock deals
    mockDealsStore.set('deal-1', {
      id: 'deal-1',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      entityId: 'ent-1',
      pipelineId: 'pipe-1',
      stageId: 'stage-1',
      stageName: 'Discovery',
      name: 'St. Patrick High Expansion',
      value: 15000,
      currency: 'USD',
      status: 'open',
      probability: 40,
      forecastCategory: 'pipeline',
      healthStatus: 'healthy',
      lineItems: [
        {
          id: 'li-1',
          name: 'Core SaaS License',
          quantity: 1,
          unitPrice: 15000,
          total: 15000,
        }
      ],
      contacts: [{ entityId: 'c-1', role: 'Decision Maker', name: 'Principal Jane', email: 'jane@stpatrick.edu' }],
      focalContacts: [{ id: 'fc-1', name: 'Dr. John', email: 'john@stpatrick.edu', role: 'Headmaster' }],
      customFields: { department: 'Science', year: 2026 },
      tags: ['enterprise', 'q3-rollout'],
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    });

    mockDealsStore.set('deal-2', {
      id: 'deal-2',
      organizationId: 'org-1',
      workspaceId: 'ws-1',
      entityId: 'ent-1',
      pipelineId: 'pipe-1',
      stageId: 'stage-1',
      stageName: 'Discovery',
      name: 'St. Patrick Training Package',
      value: 5000,
      currency: 'USD',
      status: 'open',
      probability: 40,
      forecastCategory: 'pipeline',
      healthStatus: 'healthy',
      lineItems: [
        {
          id: 'li-2',
          name: 'Teacher Onboarding Training',
          quantity: 2,
          unitPrice: 2500,
          total: 5000,
        }
      ],
      contacts: [{ entityId: 'c-2', role: 'Billing', name: 'Dean Thomas', email: 'thomas@stpatrick.edu' }],
      focalContacts: [{ id: 'fc-1', name: 'Dr. John', email: 'john@stpatrick.edu', role: 'Headmaster' }],
      customFields: { cohortSize: 45 },
      tags: ['training'],
      createdAt: '2026-06-05T00:00:00.000Z',
      updatedAt: '2026-06-05T00:00:00.000Z',
    });
  });

  describe('duplicateDealAction', () => {
    it('should duplicate deal with cloned line items and reset stage history', async () => {
      const res = await duplicateDealAction('deal-1', {
        newName: 'St. Patrick Expansion (2027 Cohort)',
      }, 'user-admin');

      expect(res.success).toBe(true);
      expect(res.newDealId).toBeDefined();

      const created = mockDealsStore.get(res.newDealId!);
      expect(created).toBeDefined();
      expect(created?.name).toBe('St. Patrick Expansion (2027 Cohort)');
      expect(created?.value).toBe(15000);
      expect(created?.lineItems?.length).toBe(1);
      // New line item ID should be generated
      expect(created?.lineItems?.[0].id).not.toBe('li-1');
      // Fresh stage history
      expect(created?.stageHistory?.length).toBe(1);
      expect(created?.stageHistory?.[0].notes).toContain('Deal cloned from "St. Patrick High Expansion"');
      expect(created?.status).toBe('open');
      expect(created?.isArchived).toBe(false);
    });

    it('should respect permission denial during duplicate', async () => {
      permissionGranted = false;
      const res = await duplicateDealAction('deal-1', {}, 'unauthorized-user');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Permission denied');
    });
  });

  describe('archiveDealAction & unarchiveDealAction', () => {
    it('should soft-archive a deal and log activity', async () => {
      const res = await archiveDealAction('deal-1', 'user-admin');
      expect(res.success).toBe(true);

      const deal = mockDealsStore.get('deal-1');
      expect(deal?.isArchived).toBe(true);
      expect(deal?.archivedAt).toBeDefined();
      expect(deal?.archivedBy).toBe('user-admin');

      expect(loggedActivities.some(a => a.type === 'deal_archived')).toBe(true);
    });

    it('should restore an archived deal', async () => {
      await archiveDealAction('deal-1', 'user-admin');
      const unarchiveRes = await unarchiveDealAction('deal-1', 'user-admin');
      expect(unarchiveRes.success).toBe(true);

      const deal = mockDealsStore.get('deal-1');
      expect(deal?.isArchived).toBe(false);
      expect(deal?.archivedAt).toBeNull();
      expect(deal?.archivedBy).toBeNull();
    });
  });

  describe('mergeDealsAction', () => {
    it('should combine line items, contacts, and soft-archive secondary deal', async () => {
      const mergeOptions: DealMergeOptions = {
        masterDealId: 'deal-1',
        secondaryDealId: 'deal-2',
        resolvedName: 'St. Patrick High - Combined Enterprise Bundle',
        resolvedValue: 20000,
        resolvedPipelineId: 'pipe-1',
        resolvedStageId: 'stage-1',
        mergeContacts: true,
        mergeLineItems: true,
        mergeCustomFields: true,
        mergeTasksAndNotes: true,
      };

      const result = await mergeDealsAction(mergeOptions, 'ws-1', 'user-admin');

      expect(result.success).toBe(true);
      expect(result.masterDealId).toBe('deal-1');
      expect(result.secondaryDealId).toBe('deal-2');
      expect(result.mergedContactsCount).toBe(1); // c-2 added (fc-1 deduplicated)
      expect(result.mergedLineItemsCount).toBe(1); // li-2 added

      // Check Master Deal
      const master = mockDealsStore.get('deal-1');
      expect(master?.name).toBe('St. Patrick High - Combined Enterprise Bundle');
      expect(master?.value).toBe(20000);
      expect(master?.lineItems?.length).toBe(2);
      expect(master?.contacts?.length).toBe(2);
      expect(master?.focalContacts?.length).toBe(1); // deduplicated
      expect(master?.customFields).toEqual({ department: 'Science', year: 2026, cohortSize: 45 });
      expect(master?.tags).toContain('enterprise');
      expect(master?.tags).toContain('training');

      // Check Secondary Deal
      const secondary = mockDealsStore.get('deal-2');
      expect(secondary?.isArchived).toBe(true);
      expect(secondary?.status).toBe('cancelled');
      expect(secondary?.mergedIntoDealId).toBe('deal-1');
    });

    it('should reject merging deals across different workspaces', async () => {
      mockDealsStore.set('deal-diff-ws', {
        ...mockDealsStore.get('deal-2')!,
        id: 'deal-diff-ws',
        workspaceId: 'other-ws',
      });

      const result = await mergeDealsAction({
        masterDealId: 'deal-1',
        secondaryDealId: 'deal-diff-ws',
        resolvedName: 'Cross WS',
        resolvedValue: 1000,
        resolvedPipelineId: 'pipe-1',
        resolvedStageId: 'stage-1',
        mergeContacts: true,
        mergeLineItems: true,
        mergeCustomFields: true,
        mergeTasksAndNotes: false,
      }, 'ws-1', 'user-admin');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot merge deals across different workspaces');
    });
  });
});
