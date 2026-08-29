import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateDealStageAction, bulkUpdateDealsStageAction } from '../deal-actions';
import type { Deal, OnboardingStage } from '@/lib/types';

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

// Mock orchestrator
vi.mock('@/lib/automations/orchestrator', () => ({
  triggerAutomationProtocols: vi.fn().mockResolvedValue(undefined),
}));

// Mock deal-expected-close
vi.mock('../../admin/pipeline/utils/deal-expected-close', () => ({
  calculateExpectedCloseDate: vi.fn().mockReturnValue('2026-10-15T00:00:00.000Z'),
}));

// Mock Firestore adminDb
const mockDealsStore = new Map<string, Deal>();
const mockStagesStore = new Map<string, OnboardingStage>();

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
          };
        }
        if (name === 'onboardingStages') {
          return {
            doc: vi.fn((id: string) => ({
              id,
              get: vi.fn().mockImplementation(async () => ({
                exists: mockStagesStore.has(id),
                data: () => mockStagesStore.get(id),
              })),
            })),
          };
        }
        return {
          doc: vi.fn((id: string) => ({
            id,
            get: vi.fn().mockResolvedValue({ exists: false }),
          })),
        };
      }),
      getAll: vi.fn().mockImplementation(async (...docRefs: Array<{ id: string }>) => {
        return docRefs.map((ref) => ({
          exists: mockDealsStore.has(ref.id),
          ref,
          data: () => mockDealsStore.get(ref.id),
        }));
      }),
      batch: vi.fn().mockReturnValue({
        update: vi.fn().mockImplementation((ref: { id: string }, data: Partial<Deal>) => {
          const existing = mockDealsStore.get(ref.id);
          if (existing) {
            mockDealsStore.set(ref.id, { ...existing, ...data } as Deal);
          }
        }),
        commit: vi.fn().mockResolvedValue(undefined),
      }),
    },
  };
});

describe('Phase 2 — Pipeline Engine Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionGranted = true;
    mockDealsStore.clear();
    mockStagesStore.clear();
    loggedActivities = [];

    // Seed stages
    mockStagesStore.set('stage-qualification', {
      id: 'stage-qualification',
      pipelineId: 'pipe-1',
      name: 'Qualification',
      order: 1,
      probability: 20,
      terminalType: 'none',
      requiredFields: [],
    });

    mockStagesStore.set('stage-proposal', {
      id: 'stage-proposal',
      pipelineId: 'pipe-1',
      name: 'Technical Proposal',
      order: 2,
      probability: 65,
      slaDays: 5,
      terminalType: 'none',
      requiredFields: ['value', 'expectedCloseDate'],
    });

    mockStagesStore.set('stage-won', {
      id: 'stage-won',
      pipelineId: 'pipe-1',
      name: 'Closed Won',
      order: 3,
      probability: 100,
      terminalType: 'won',
      isWon: true,
      requiredFields: [],
    });

    mockStagesStore.set('stage-lost', {
      id: 'stage-lost',
      pipelineId: 'pipe-1',
      name: 'Closed Lost',
      order: 4,
      probability: 0,
      terminalType: 'lost',
      isLost: true,
      requiredFields: [],
    });

    // Seed initial deal
    mockDealsStore.set('deal-1', {
      id: 'deal-1',
      workspaceId: 'ws-main',
      organizationId: 'org-1',
      entityId: 'ent-1',
      pipelineId: 'pipe-1',
      stageId: 'stage-qualification',
      stageName: 'Qualification',
      name: 'Oakridge Academy Partnership',
      status: 'open',
      value: 0,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
  });

  describe('updateDealStageAction (Process Gates & Validation)', () => {
    it('blocks stage transition when deal is missing required fields for the destination stage', async () => {
      const res = await updateDealStageAction('deal-1', 'stage-proposal', { userId: 'user-admin' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Cannot move to "Technical Proposal"');
      expect(res.error).toContain('Deal Value');

      // Deal in store should remain at Qualification
      const deal = mockDealsStore.get('deal-1');
      expect(deal?.stageId).toBe('stage-qualification');
    });

    it('allows stage transition when required fields are satisfied and syncs stage probability', async () => {
      // Update deal with required value and expected close date
      mockDealsStore.set('deal-1', {
        ...mockDealsStore.get('deal-1')!,
        value: 25000,
        expectedCloseDate: '2026-11-15T00:00:00.000Z',
      });

      const res = await updateDealStageAction('deal-1', 'stage-proposal', { userId: 'user-admin' });
      expect(res.success).toBe(true);

      const deal = mockDealsStore.get('deal-1');
      expect(deal?.stageId).toBe('stage-proposal');
      expect(deal?.stageName).toBe('Technical Proposal');
      expect(deal?.probability).toBe(65); // Auto-synced from stage
      expect(deal?.stageHistory?.length).toBe(1);
      expect(deal?.stageHistory?.[0].stageName).toBe('Qualification');
    });

    it('allows bypassing validation if explicitly requested by administrative bypass', async () => {
      const res = await updateDealStageAction('deal-1', 'stage-proposal', {
        userId: 'user-admin',
        bypassValidation: true,
      });
      expect(res.success).toBe(true);

      const deal = mockDealsStore.get('deal-1');
      expect(deal?.stageId).toBe('stage-proposal');
    });

    it('automatically transitions deal status to "won" when moved to terminal won stage', async () => {
      const res = await updateDealStageAction('deal-1', 'stage-won', { userId: 'user-admin' });
      expect(res.success).toBe(true);

      const deal = mockDealsStore.get('deal-1');
      expect(deal?.stageId).toBe('stage-won');
      expect(deal?.status).toBe('won');
      expect(deal?.probability).toBe(100);
    });

    it('automatically transitions deal status to "lost" and captures lostReason when moved to terminal lost stage', async () => {
      const res = await updateDealStageAction('deal-1', 'stage-lost', {
        userId: 'user-admin',
        lostReason: 'Budget constraints',
      });
      expect(res.success).toBe(true);

      const deal = mockDealsStore.get('deal-1');
      expect(deal?.stageId).toBe('stage-lost');
      expect(deal?.status).toBe('lost');
      expect(deal?.lostReason).toBe('Budget constraints');
    });

    it('resets status to "open" when moved from a terminal stage back to an active pipeline stage', async () => {
      // Setup deal as currently lost
      mockDealsStore.set('deal-1', {
        ...mockDealsStore.get('deal-1')!,
        stageId: 'stage-lost',
        stageName: 'Closed Lost',
        status: 'lost',
      });

      const res = await updateDealStageAction('deal-1', 'stage-qualification', { userId: 'user-admin' });
      expect(res.success).toBe(true);

      const deal = mockDealsStore.get('deal-1');
      expect(deal?.stageId).toBe('stage-qualification');
      expect(deal?.status).toBe('open');
    });

    it('enforces RBAC permission check before advancing stage', async () => {
      permissionGranted = false;
      const res = await updateDealStageAction('deal-1', 'stage-won', { userId: 'restricted-user' });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Permission denied');
    });
  });

  describe('bulkUpdateDealsStageAction', () => {
    it('bulk updates deals across matching workspace and resolves terminal status', async () => {
      mockDealsStore.set('deal-2', {
        id: 'deal-2',
        workspaceId: 'ws-main',
        organizationId: 'org-1',
        entityId: 'ent-2',
        pipelineId: 'pipe-1',
        stageId: 'stage-qualification',
        stageName: 'Qualification',
        name: 'Hilltop High',
        status: 'open',
        value: 10000,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      });

      const res = await bulkUpdateDealsStageAction(
        ['deal-1', 'deal-2'],
        'stage-won',
        'ws-main',
        'user-admin'
      );

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(2);

      const deal1 = mockDealsStore.get('deal-1');
      const deal2 = mockDealsStore.get('deal-2');
      expect(deal1?.stageId).toBe('stage-won');
      expect(deal1?.status).toBe('won');
      expect(deal2?.stageId).toBe('stage-won');
      expect(deal2?.status).toBe('won');
    });
  });
});
