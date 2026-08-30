import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  savePipelineTargetAction,
  getPipelineTargetsAction,
  deletePipelineTargetAction,
} from '../deal-analytics-actions';
import { canUser } from '@/lib/workspace-permissions';

// Mock Next.js cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock permissions & activity logger
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn().mockResolvedValue({ granted: true }),
}));

vi.mock('@/lib/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// Mock Firestore
const mockDocSet = vi.fn().mockResolvedValue(undefined);
const mockDocUpdate = vi.fn().mockResolvedValue(undefined);
const mockDocDelete = vi.fn().mockResolvedValue(undefined);
let mockSnapshotDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn((id?: string) => ({
        id: id || 'target_doc_id',
        get: vi.fn().mockResolvedValue({
          exists: true,
          id: id || 'target_doc_id',
          data: () => ({ id, targetAmount: 50000, period: '2026-08' }),
        }),
        set: mockDocSet,
        update: mockDocUpdate,
        delete: mockDocDelete,
      })),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockImplementation(async () => ({
        empty: mockSnapshotDocs.length === 0,
        docs: mockSnapshotDocs,
      })),
    })),
  },
}));

describe('Phase 7 Revenue Targets Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSnapshotDocs = [];
  });

  it('saves a new pipeline revenue target with valid authorization and parameters', async () => {
    const res = await savePipelineTargetAction(
      {
        workspaceId: 'ws_123',
        pipelineId: 'pipe_abc',
        period: '2026-08',
        targetAmount: 100000,
        currency: 'GHS',
      },
      'user_123'
    );

    expect(res.success).toBe(true);
    expect(res.target).toBeDefined();
    expect(res.target?.targetAmount).toBe(100000);
    expect(res.target?.period).toBe('2026-08');
    expect(mockDocSet).toHaveBeenCalled();
  });

  it('rejects saving target when target amount is negative', async () => {
    const res = await savePipelineTargetAction(
      {
        workspaceId: 'ws_123',
        pipelineId: 'pipe_abc',
        period: '2026-08',
        targetAmount: -500,
      },
      'user_123'
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain('valid positive number');
  });

  it('rejects target mutation when user lacks workspace permissions', async () => {
    vi.mocked(canUser).mockResolvedValueOnce({ granted: false, reason: 'Unauthorized' });

    const res = await savePipelineTargetAction(
      {
        workspaceId: 'ws_123',
        period: '2026-08',
        targetAmount: 50000,
      },
      'unauthorized_user'
    );

    expect(res.success).toBe(false);
    expect(res.error).toContain('Unauthorized');
  });

  it('retrieves revenue targets for a workspace', async () => {
    mockSnapshotDocs = [
      {
        id: 'target_1',
        data: () => ({
          workspaceId: 'ws_123',
          pipelineId: 'pipe_abc',
          period: '2026-08',
          targetAmount: 150000,
          currency: 'GHS',
        }),
      },
    ];

    const res = await getPipelineTargetsAction('ws_123', 'pipe_abc');
    expect(res.success).toBe(true);
    expect(res.targets).toHaveLength(1);
    expect(res.targets?.[0].targetAmount).toBe(150000);
  });

  it('deletes a revenue target successfully', async () => {
    const res = await deletePipelineTargetAction('target_1', 'ws_123', 'user_123');
    expect(res.success).toBe(true);
    expect(mockDocDelete).toHaveBeenCalled();
  });
});
