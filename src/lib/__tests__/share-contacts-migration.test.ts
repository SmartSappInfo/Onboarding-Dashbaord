import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminDb } from '../firebase-admin';
import { handleMigration, handleRollback, handleVerify } from '../../../scripts/share-contacts-migration';
import { syncContactProjectionForWE, deleteContactProjectionForEntity } from '../contacts/contact-projection-writer';

// Mock progress states and documents
const mockMigrationStatesCollection = {
  doc: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue({
      exists: false,
      data: () => null
    }),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined)
  })
};

const mockWorkspaceEntitiesCollection = {
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  startAfter: vi.fn().mockReturnThis(),
  get: vi.fn(),
  doc: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue({ exists: false }),
    ref: { id: 'mock-ref' }
  }),
  count: vi.fn().mockReturnThis()
};

const mockEntitiesCollection = {
  doc: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue({ exists: true })
  })
};

// Mock adminDb
vi.mock('../firebase-admin', () => {
  const mockBatch = {
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined)
  };
  
  return {
    adminDb: {
      collection: vi.fn((name: string) => {
        if (name === 'migration_states') return mockMigrationStatesCollection;
        if (name === 'workspace_entities') return mockWorkspaceEntitiesCollection;
        if (name === 'entities') return mockEntitiesCollection;
        return mockWorkspaceEntitiesCollection;
      }),
      batch: vi.fn().mockReturnValue(mockBatch)
    }
  };
});

vi.mock('../contacts/contact-projection-writer', () => ({
  syncContactProjectionForWE: vi.fn().mockResolvedValue({ upserts: 1, deletes: 0 }),
  deleteContactProjectionForEntity: vi.fn().mockResolvedValue(1)
}));

vi.mock('../entity-audit', () => ({
  logWorkspaceEntityCreated: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined)
}));

describe('Share Contacts Migration Protocol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully fetch, enrich, and restore source workspace contacts', async () => {
    const mockSourceWEs = [
      {
        id: 'prospect_entity_1',
        data: () => ({
          id: 'prospect_entity_1',
          entityId: 'entity_1',
          workspaceId: 'prospect',
          organizationId: 'smartsapp-hq',
          entityType: 'institution',
          displayName: 'Test Institution'
        })
      }
    ];

    // Setup sequence for gets on workspace_entities
    vi.spyOn(mockWorkspaceEntitiesCollection, 'get')
      .mockResolvedValueOnce({
        empty: false,
        docs: mockSourceWEs,
        length: 1
      } as any) // 1st page
      .mockResolvedValueOnce({
        empty: true,
        docs: [],
        length: 0
      } as any); // 2nd page (empty check)

    await handleMigration(false);

    const batch = adminDb.batch();
    expect(batch.commit).toHaveBeenCalled();
    expect(syncContactProjectionForWE).toHaveBeenCalled();
  });

  it('should handle rollbacks cleanly by deleting target relationships and projection records', async () => {
    const mockMigratedWEs = [
      {
        id: 'enrollment-marketing_entity_1',
        ref: { id: 'enrollment-marketing_entity_1' },
        data: () => ({
          id: 'enrollment-marketing_entity_1',
          entityId: 'entity_1',
          workspaceId: 'enrollment-marketing'
        })
      }
    ];

    vi.spyOn(mockWorkspaceEntitiesCollection, 'get').mockResolvedValueOnce({
      empty: false,
      size: mockMigratedWEs.length,
      docs: mockMigratedWEs
    } as any);

    await handleRollback();

    const batch = adminDb.batch();
    expect(batch.commit).toHaveBeenCalled();
    expect(deleteContactProjectionForEntity).toHaveBeenCalledWith('enrollment-marketing', 'entity_1');
  });

  it('should run verification audits and output matching metrics', async () => {
    const mockCountResult = {
      data: () => ({ count: 10 })
    };

    vi.spyOn(mockWorkspaceEntitiesCollection, 'get').mockResolvedValueOnce({
      empty: true,
      docs: []
    } as any); // orphans check

    const countSpy = vi.spyOn(mockWorkspaceEntitiesCollection, 'get');
    countSpy.mockResolvedValueOnce(mockCountResult as any); // source count get
    countSpy.mockResolvedValueOnce(mockCountResult as any); // target count get

    await handleVerify();

    expect(mockWorkspaceEntitiesCollection.count).toHaveBeenCalledTimes(2);
  });
});
