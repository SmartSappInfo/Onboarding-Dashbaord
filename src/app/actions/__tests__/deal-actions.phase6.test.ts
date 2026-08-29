import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDealSavedViewAction,
  updateDealSavedViewAction,
  deleteDealSavedViewAction,
  listDealSavedViewsAction,
} from '../deal-saved-view-actions';
import {
  evaluateDealFilterTree,
  countMatchingDeals,
  type DealFilterTree,
} from '@/lib/deals/deal-filter-engine';
import type { Deal, OnboardingStage } from '@/lib/types';

// Mock Next.js cache revalidation
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock server-only dependencies
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn().mockResolvedValue({ granted: true }),
  hasPermission: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// Mock firestore
const mockDocSet = vi.fn().mockResolvedValue(undefined);
const mockDocUpdate = vi.fn().mockResolvedValue(undefined);
const mockDocDelete = vi.fn().mockResolvedValue(undefined);
let mockDocData: Record<string, unknown> | null = null;
let mockCollectionDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn((id?: string) => ({
        id: id || 'generated-view-id',
        get: vi.fn().mockImplementation(async () => ({
          exists: mockDocData !== null,
          id: id || 'generated-view-id',
          data: () => mockDocData,
        })),
        set: mockDocSet,
        update: mockDocUpdate,
        delete: mockDocDelete,
      })),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      get: vi.fn().mockImplementation(async () => ({
        docs: mockCollectionDocs,
      })),
    })),
  },
}));

describe('Phase 6: Deal Saved Views & Intelligent Filter Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocData = null;
    mockCollectionDocs = [];
  });

  describe('createDealSavedViewAction', () => {
    it('creates a saved view successfully with RBAC enforcement', async () => {
      const res = await createDealSavedViewAction(
        {
          name: 'Enterprise Deals Q3',
          workspaceId: 'ws-123',
          visibility: 'workspace',
          filters: {
            status: 'open',
            valueMin: 50000,
          },
          columns: ['name', 'value', 'stage', 'probability'],
          density: 'comfortable',
          viewMode: 'kanban',
        },
        'user-abc'
      );

      expect(res.success).toBe(true);
      expect(res.view).toBeDefined();
      expect(res.view?.name).toBe('Enterprise Deals Q3');
      expect(mockDocSet).toHaveBeenCalledTimes(1);
      const payload = mockDocSet.mock.calls[0][0];
      expect(payload.name).toBe('Enterprise Deals Q3');
      expect(payload.workspaceId).toBe('ws-123');
      expect(payload.userId).toBe('user-abc');
      expect(payload.visibility).toBe('workspace');
    });

    it('rejects view creation when name or workspaceId is missing', async () => {
      const res = await createDealSavedViewAction(
        {
          name: '',
          workspaceId: 'ws-123',
          filters: {},
        },
        'user-abc'
      );

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/parameters/i);
    });
  });

  describe('updateDealSavedViewAction', () => {
    it('updates view successfully when user has authorization', async () => {
      mockDocData = {
        id: 'view-123',
        name: 'Old View Name',
        workspaceId: 'ws-123',
        userId: 'user-abc',
        visibility: 'private',
        filters: {},
      };

      const res = await updateDealSavedViewAction(
        'view-123',
        {
          name: 'Updated View Name',
          density: 'compact',
        },
        'user-abc'
      );

      expect(res.success).toBe(true);
      expect(mockDocUpdate).toHaveBeenCalledTimes(1);
      const updateData = mockDocUpdate.mock.calls[0][0];
      expect(updateData.name).toBe('Updated View Name');
      expect(updateData.density).toBe('compact');
    });

    it('rejects update if view does not exist', async () => {
      mockDocData = null;

      const res = await updateDealSavedViewAction(
        'non-existent-id',
        { name: 'Test' },
        'user-abc'
      );

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/not found/i);
    });
  });

  describe('deleteDealSavedViewAction', () => {
    it('deletes view when user is authorized', async () => {
      mockDocData = {
        id: 'view-123',
        workspaceId: 'ws-123',
        userId: 'user-abc',
        visibility: 'private',
      };

      const res = await deleteDealSavedViewAction('view-123', 'user-abc');
      expect(res.success).toBe(true);
      expect(mockDocDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('listDealSavedViewsAction', () => {
    it('returns combined workspace and private saved views along with system presets', async () => {
      mockCollectionDocs = [
        {
          id: 'custom-view-1',
          data: () => ({
            id: 'custom-view-1',
            name: 'Custom Team View',
            workspaceId: 'ws-123',
            userId: 'user-abc',
            visibility: 'workspace',
            filters: { status: 'open' },
            createdAt: '2026-02-01T00:00:00.000Z',
          }),
        },
      ];

      const res = await listDealSavedViewsAction('ws-123', 'user-abc');
      expect(res.success).toBe(true);
      expect(res.views).toBeDefined();
      expect(res.views?.length).toBeGreaterThanOrEqual(1);
      const customView = res.views?.find(v => v.id === 'custom-view-1');
      expect(customView?.name).toBe('Custom Team View');
    });
  });

  describe('Pure Filter Engine: evaluateDealFilterTree & countMatchingDeals', () => {
    const mockStages: OnboardingStage[] = [
      { id: 'stage-lead', name: 'Lead Qualified', order: 0, probability: 20, color: '#3b82f6' } as OnboardingStage,
      { id: 'stage-demo', name: 'Demo Scheduled', order: 1, probability: 50, color: '#10b981' } as OnboardingStage,
      { id: 'stage-close', name: 'Closing Review', order: 2, probability: 90, color: '#f59e0b' } as OnboardingStage,
    ];

    const mockDeals: Deal[] = [
      {
        id: 'deal-1',
        name: 'Enterprise Cloud Deal',
        workspaceId: 'ws-123',
        value: 120000,
        mrr: 10000,
        stageId: 'stage-demo',
        stageName: 'Demo Scheduled',
        status: 'open',
        probability: 50,
        expectedCloseDate: '2026-09-30',
        forecastCategory: 'commit',
        createdAt: '2026-08-01T00:00:00.000Z',
      } as Deal,
      {
        id: 'deal-2',
        name: 'SMB Starter Deal',
        workspaceId: 'ws-123',
        value: 1500,
        mrr: 125,
        stageId: 'stage-lead',
        stageName: 'Lead Qualified',
        status: 'open',
        probability: 20,
        expectedCloseDate: '2026-08-15',
        forecastCategory: 'pipeline',
        createdAt: '2026-08-10T00:00:00.000Z',
      } as Deal,
      {
        id: 'deal-3',
        name: 'Strategic Global Expansion',
        workspaceId: 'ws-123',
        value: 500000,
        mrr: 40000,
        stageId: 'stage-close',
        stageName: 'Closing Review',
        status: 'open',
        probability: 90,
        expectedCloseDate: '2026-10-15',
        forecastCategory: 'commit',
        createdAt: '2026-07-01T00:00:00.000Z',
      } as Deal,
    ];

    it('evaluates single condition filter tree (value >= 50000)', () => {
      const tree: DealFilterTree = {
        conjunction: 'AND',
        groups: [
          {
            id: 'g1',
            conjunction: 'AND',
            rules: [
              {
                id: 'r1',
                field: 'value',
                operator: 'greater_than_or_equal',
                value: 50000,
              },
            ],
          },
        ],
      };

      expect(evaluateDealFilterTree(mockDeals[0], tree, { stages: mockStages })).toBe(true);
      expect(evaluateDealFilterTree(mockDeals[1], tree, { stages: mockStages })).toBe(false);
      expect(evaluateDealFilterTree(mockDeals[2], tree, { stages: mockStages })).toBe(true);

      const count = countMatchingDeals(mockDeals, tree, { stages: mockStages });
      expect(count).toBe(2);
    });

    it('evaluates nested AND/OR groups correctly', () => {
      // Group 1: status == 'open'
      // Group 2 (OR): value >= 100000 OR stage in ['stage-close']
      const tree: DealFilterTree = {
        conjunction: 'AND',
        groups: [
          {
            id: 'g-status',
            conjunction: 'AND',
            rules: [
              {
                id: 'r-status',
                field: 'status',
                operator: 'equals',
                value: 'open',
              },
            ],
          },
          {
            id: 'subgroup-1',
            conjunction: 'OR',
            rules: [
              { id: 'r-val', field: 'value', operator: 'greater_than_or_equal', value: 100000 },
              { id: 'r-stage', field: 'stageId', operator: 'in', value: ['stage-close'] },
            ],
          },
        ],
      };

      expect(evaluateDealFilterTree(mockDeals[0], tree, { stages: mockStages })).toBe(true); // value 120000 >= 100000
      expect(evaluateDealFilterTree(mockDeals[1], tree, { stages: mockStages })).toBe(false); // value 1500 < 100000 & stage not close
      expect(evaluateDealFilterTree(mockDeals[2], tree, { stages: mockStages })).toBe(true); // value 500000 & stage close
    });
  });
});
