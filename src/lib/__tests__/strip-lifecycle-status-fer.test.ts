import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeStripLifecycleStatusFerAction } from '../../app/actions/strip-lifecycle-status-fer-action';
import { adminDb } from '../firebase-admin';

// Mock Firebase Admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
    batch: vi.fn(),
  },
}));

const createMockFirestoreChain = (docs: any[]) => {
  const chain: any = {};
  chain.get = vi.fn().mockResolvedValue({
    size: docs.length,
    docs: docs.map(d => ({
      ref: d.id,
      data: () => d.data,
    })),
  });
  return chain;
};

describe('executeStripLifecycleStatusFerAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs successfully and deletes lifecycleStatus keys from entities and workspace_entities', async () => {
    const mockEntities = [
      { id: 'e1', data: { name: 'Entity 1', lifecycleStatus: 'Active' } },
      { id: 'e2', data: { name: 'Entity 2' } }, // Already clean
    ];

    const mockWorkspaceEntities = [
      { id: 'we1', data: { displayName: 'WE 1', lifecycleStatus: 'Onboarding' } },
    ];

    const mockMigrationDoc = {
      set: vi.fn().mockResolvedValue(undefined),
    };

    const mockBatch = {
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };

    const mockCollection = vi.fn((colName: string) => {
      if (colName === 'system_migrations') {
        return { doc: vi.fn(() => mockMigrationDoc) };
      }
      if (colName === 'entities') {
        return createMockFirestoreChain(mockEntities);
      }
      if (colName === 'workspace_entities') {
        return createMockFirestoreChain(mockWorkspaceEntities);
      }
      return createMockFirestoreChain([]);
    });

    (adminDb.collection as any) = mockCollection;
    (adminDb.batch as any) = vi.fn(() => mockBatch);

    const result = await executeStripLifecycleStatusFerAction('user_test');

    expect(result.success).toBe(true);
    expect(result.details.entitiesScanned).toBe(2);
    expect(result.details.entitiesStripped).toBe(1);
    expect(result.details.workspaceEntitiesScanned).toBe(1);
    expect(result.details.workspaceEntitiesStripped).toBe(1);

    // Verify it called batch.update with FieldValue.delete() for the matching docs
    expect(mockBatch.update).toHaveBeenCalledTimes(2);
    
    // Verify migration log updates
    expect(mockMigrationDoc.set).toHaveBeenCalledTimes(2); // in_progress and completed
  });
});
