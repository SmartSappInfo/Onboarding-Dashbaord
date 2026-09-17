import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Entity, EntityContact, WorkspaceEntity } from '../types';

// Mock Next.js cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: 'test-user', email: 'test@example.com' }),
  requireWorkspace: vi.fn().mockResolvedValue(true),
}));

// Mock activity logger
vi.mock('../activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// In-memory Firestore collections for testing
const entitiesStore = new Map<string, Record<string, unknown>>();
const workspaceEntitiesStore = new Map<string, Record<string, unknown>>();
const workspaceContactsStore = new Map<string, Record<string, unknown>>();

// Mock contact projection writer
vi.mock('../contacts/contact-projection-writer', () => ({
  syncContactProjectionForWE: vi.fn().mockImplementation(async (we: WorkspaceEntity) => {
    return { upserts: (we.entityContacts || []).length, deletes: 0 };
  }),
  deleteContactProjectionForEntity: vi.fn().mockImplementation(async (workspaceId: string, entityId: string) => {
    return { deleted: 1 };
  }),
}));

// Mock Firestore adminDb
vi.mock('../firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === 'entities') {
          return {
            doc: vi.fn((id: string) => ({
              _docId: id,
              get: vi.fn().mockImplementation(async () => {
                const data = entitiesStore.get(id);
                return {
                  exists: Boolean(data),
                  id,
                  data: () => data,
                };
              }),
              update: vi.fn().mockImplementation(async (updates: Record<string, unknown>) => {
                const existing = entitiesStore.get(id) || {};
                entitiesStore.set(id, { ...existing, ...updates });
              }),
            })),
            orderBy: vi.fn(() => ({
              limit: vi.fn((_limit: number) => ({
                get: vi.fn().mockImplementation(async () => {
                  const docs = Array.from(entitiesStore.entries()).map(([id, data]) => ({
                    id,
                    data: () => data,
                    ref: {
                      update: vi.fn().mockImplementation(async (updates: Record<string, unknown>) => {
                        entitiesStore.set(id, { ...data, ...updates });
                      }),
                    },
                  }));
                  return {
                    empty: docs.length === 0,
                    size: docs.length,
                    docs,
                  };
                }),
              })),
            })),
          };
        } else if (collectionName === 'workspace_entities') {
          return {
            doc: vi.fn((id: string) => ({
              _docId: id,
              get: vi.fn().mockImplementation(async () => {
                const data = workspaceEntitiesStore.get(id);
                return {
                  exists: Boolean(data),
                  id,
                  data: () => data,
                };
              }),
              delete: vi.fn().mockImplementation(async () => {
                workspaceEntitiesStore.delete(id);
              }),
            })),
            where: vi.fn((field: string, op: string, val: unknown) => {
              const filters: Array<{ field: string; op: string; val: unknown }> = [{ field, op, val }];
              const chainable = {
                where: vi.fn((f: string, o: string, v: unknown) => {
                  filters.push({ field: f, op: o, val: v });
                  return chainable;
                }),
                get: vi.fn().mockImplementation(async () => {
                  let results = Array.from(workspaceEntitiesStore.entries());
                  for (const filter of filters) {
                    if (filter.op === 'in' && Array.isArray(filter.val)) {
                      results = results.filter(([_, data]) => (filter.val as unknown[]).includes(data[filter.field]));
                    } else {
                      results = results.filter(([_, data]) => data[filter.field] === filter.val);
                    }
                  }
                  return {
                    empty: results.length === 0,
                    size: results.length,
                    docs: results.map(([id, data]) => ({
                      id,
                      data: () => data,
                      ref: {
                        _docId: id,
                        _collection: 'workspace_entities',
                      },
                    })),
                  };
                }),
              };
              return chainable;
            }),
          };
        }
        return {};
      }),
      batch: vi.fn(() => {
        const batchOps: Array<{ type: 'update' | 'set' | 'delete'; docId: string; collection?: string; data?: Record<string, unknown> }> = [];
        return {
          update: vi.fn((ref: { _docId: string; _collection?: string }, data: Record<string, unknown>) => {
            batchOps.push({ type: 'update', docId: ref._docId, collection: ref._collection, data });
          }),
          set: vi.fn((ref: { _docId: string; _collection?: string }, data: Record<string, unknown>) => {
            batchOps.push({ type: 'set', docId: ref._docId, collection: ref._collection, data });
          }),
          delete: vi.fn((ref: { _docId: string; _collection?: string }) => {
            batchOps.push({ type: 'delete', docId: ref._docId, collection: ref._collection });
          }),
          commit: vi.fn().mockImplementation(async () => {
            for (const op of batchOps) {
              if (op.type === 'delete') {
                workspaceEntitiesStore.delete(op.docId);
                entitiesStore.delete(op.docId);
              } else if (op.type === 'update' || op.type === 'set') {
                if (entitiesStore.has(op.docId)) {
                  const existing = entitiesStore.get(op.docId) || {};
                  // Emulate FieldValue.arrayRemove if present
                  const mergedData = { ...existing };
                  for (const [k, v] of Object.entries(op.data || {})) {
                    if (v && typeof v === 'object' && 'isEqual' in v) {
                      // FieldValue mock
                      continue;
                    }
                    mergedData[k] = v;
                  }
                  entitiesStore.set(op.docId, mergedData);
                }
                if (workspaceEntitiesStore.has(op.docId) || op.collection === 'workspace_entities') {
                  const existing = workspaceEntitiesStore.get(op.docId) || {};
                  workspaceEntitiesStore.set(op.docId, { ...existing, ...op.data });
                }
              }
            }
          }),
        };
      }),
    },
  };
});

import { EntitySyncGateway, detectEntityDrift } from '../services/entity-sync-gateway';
import { reconcileEntitiesAndWorkspaces } from '../entities/backfill-entity-sync';

describe('Entity and Workspace Synchronization Invariants (Zero-Drift Standard)', () => {
  beforeEach(() => {
    entitiesStore.clear();
    workspaceEntitiesStore.clear();
    workspaceContactsStore.clear();
    vi.clearAllMocks();
  });

  it('Invariant 1 (Multi-Workspace Propagation): Identity changes on master entity propagate atomically across all linked workspaces', async () => {
    const entityId = 'entity-test-101';
    const ws1Id = 'ws-engineering';
    const ws2Id = 'ws-sales';

    const initialContacts: EntityContact[] = [
      {
        id: 'contact-c1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+233201112222',
        typeKey: 'cto',
        typeLabel: 'Chief Technology Officer',
        order: 0,
        isSignatory: true,
        isPrimary: true,
      },
    ];

    // Seed master entity
    entitiesStore.set(entityId, {
      id: entityId,
      name: 'Original Company Ltd',
      entityType: 'institution',
      workspaceIds: [ws1Id, ws2Id],
      entityContacts: initialContacts,
      status: 'active',
    });

    // Seed Workspace 1 operational projection
    workspaceEntitiesStore.set(`${ws1Id}_${entityId}`, {
      id: `${ws1Id}_${entityId}`,
      entityId,
      workspaceId: ws1Id,
      displayName: 'Original Company Ltd',
      displayNameLower: 'original company ltd',
      primaryContactName: 'Jane Doe',
      primaryEmail: 'jane@example.com',
      primaryPhone: '+233201112222',
      entityContacts: initialContacts,
      assignedTo: { userId: 'user-engineer-1', name: 'Bob Eng', email: 'bob@example.com' },
      workspaceTags: ['tag-tech'],
      status: 'active',
    });

    // Seed Workspace 2 operational projection
    workspaceEntitiesStore.set(`${ws2Id}_${entityId}`, {
      id: `${ws2Id}_${entityId}`,
      entityId,
      workspaceId: ws2Id,
      displayName: 'Original Company Ltd',
      displayNameLower: 'original company ltd',
      primaryContactName: 'Jane Doe',
      primaryEmail: 'jane@example.com',
      primaryPhone: '+233201112222',
      entityContacts: initialContacts,
      assignedTo: { userId: 'user-sales-1', name: 'Alice Sales', email: 'alice@example.com' },
      workspaceTags: ['tag-deal'],
      status: 'active',
    });

    // Mutate Identity via EntitySyncGateway
    const updatedContacts: EntityContact[] = [
      {
        id: 'contact-c2',
        name: 'Sarah Connor',
        email: 'sarah@skynet.com',
        phone: '+15551234567',
        typeKey: 'founder_ceo',
        typeLabel: 'Founder & CEO',
        order: 0,
        isSignatory: true,
        isPrimary: true,
      },
    ];

    const result = await EntitySyncGateway.syncEntityAndWorkspaces(
      entityId,
      {
        name: 'Updated Enterprise Group',
        entityContacts: updatedContacts,
      },
      {
        sourceWorkspaceId: ws1Id,
        workspaceUpdates: {
          workspaceTags: ['tag-tech', 'tag-vip'],
        },
      }
    );

    expect(result.success).toBe(true);
    expect(result.workspacesUpdatedCount).toBe(2);

    // Verify master entity was updated
    const masterEntity = entitiesStore.get(entityId) as unknown as Entity;
    expect(masterEntity.name).toBe('Updated Enterprise Group');
    expect(masterEntity.entityContacts?.[0].name).toBe('Sarah Connor');

    // Verify Workspace 1 received new identity AND preserved its own assignee
    const ws1Entity = workspaceEntitiesStore.get(`${ws1Id}_${entityId}`) as unknown as WorkspaceEntity;
    expect(ws1Entity.displayName).toBe('Updated Enterprise Group');
    expect(ws1Entity.displayNameLower).toBe('updated enterprise group');
    expect(ws1Entity.primaryContactName).toBe('Sarah Connor');
    expect(ws1Entity.primaryEmail).toBe('sarah@skynet.com');
    expect(ws1Entity.primaryPhone).toBe('+15551234567');
    expect(ws1Entity.assignedTo?.userId).toBe('user-engineer-1');
    expect(ws1Entity.workspaceTags).toEqual(['tag-tech', 'tag-vip']);

    // Verify Workspace 2 received new identity AND kept its own untouched workspaceTags & assignee
    const ws2Entity = workspaceEntitiesStore.get(`${ws2Id}_${entityId}`) as unknown as WorkspaceEntity;
    expect(ws2Entity.displayName).toBe('Updated Enterprise Group');
    expect(ws2Entity.displayNameLower).toBe('updated enterprise group');
    expect(ws2Entity.primaryContactName).toBe('Sarah Connor');
    expect(ws2Entity.primaryEmail).toBe('sarah@skynet.com');
    expect(ws2Entity.primaryPhone).toBe('+15551234567');
    expect(ws2Entity.assignedTo?.userId).toBe('user-sales-1');
    expect(ws2Entity.workspaceTags).toEqual(['tag-deal']);
  });

  it('Invariant 2 (Pure Drift Detection): detectEntityDrift accurately identifies divergent denormalized fields', () => {
    const entity: Entity = {
      id: 'entity-drift-1',
      organizationId: 'org-test',
      entityType: 'institution',
      name: 'St. Peter High School',
      entityContacts: [
        {
          id: 'c1',
          name: 'Father Andrew',
          email: 'andrew@stpeters.edu',
          phone: '+233240001111',
          typeKey: 'headmaster',
          typeLabel: 'Headmaster',
          order: 0,
          isSignatory: true,
          isPrimary: true,
        },
      ],
      globalTags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Stale workspace entity with mismatched displayName and old phone
    const staleWE: WorkspaceEntity = {
      id: 'ws1_entity-drift-1',
      organizationId: 'org-test',
      workspaceId: 'ws1',
      entityId: 'entity-drift-1',
      entityType: 'institution',
      displayName: 'Old St. Peter Name',
      displayNameLower: 'old st. peter name',
      primaryContactName: 'Father Andrew',
      primaryEmail: 'andrew@stpeters.edu',
      primaryPhone: '+233249999999', // Drifted!
      entityContacts: [], // Drifted count!
      workspaceTags: [],
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
    };

    const report = detectEntityDrift(entity, staleWE);
    expect(report.hasDrift).toBe(true);
    expect(report.driftFields).toContain('displayName');
    expect(report.driftFields).toContain('displayNameLower');
    expect(report.driftFields).toContain('primaryPhone');
    expect(report.driftFields).toContain('entityContacts_count');
    expect(report.driftFields).not.toContain('primaryContactName');
    expect(report.driftFields).not.toContain('primaryEmail');

    // Matching WE has zero drift
    const cleanWE: WorkspaceEntity = {
      ...staleWE,
      displayName: 'St. Peter High School',
      displayNameLower: 'st. peter high school',
      primaryPhone: '+233240001111',
      entityContacts: entity.entityContacts,
    };

    const cleanReport = detectEntityDrift(entity, cleanWE);
    expect(cleanReport.hasDrift).toBe(false);
    expect(cleanReport.driftFields).toHaveLength(0);
  });

  it('Invariant 3 (Self-Healing Reconciliation): reconcileEntitiesAndWorkspaces dry-run and live-repair', async () => {
    const entityId = 'entity-reconcile-test';
    const wsId = 'ws-test-heal';

    const canonicalContacts: EntityContact[] = [
      {
        id: 'c-head',
        name: 'Dr. Mensah',
        email: 'mensah@hospital.com',
        phone: '+233501234567',
        typeKey: 'medical_director',
        typeLabel: 'Medical Director',
        order: 0,
        isSignatory: true,
        isPrimary: true,
      },
    ];

    entitiesStore.set(entityId, {
      id: entityId,
      name: 'Ridge Specialist Hospital',
      entityType: 'institution',
      workspaceIds: [wsId],
      entityContacts: canonicalContacts,
      status: 'active',
    });

    workspaceEntitiesStore.set(`${wsId}_${entityId}`, {
      id: `${wsId}_${entityId}`,
      entityId,
      workspaceId: wsId,
      displayName: 'Ridge Clinic', // Outdated
      displayNameLower: 'ridge clinic', // Outdated
      primaryContactName: 'Nurse Grace', // Outdated
      primaryEmail: 'grace@hospital.com', // Outdated
      primaryPhone: '+233500000000', // Outdated
      entityContacts: [],
      workspaceTags: [],
      status: 'active',
    });

    // 1. Dry Run: detect drift without modifying
    const dryRunResult = await reconcileEntitiesAndWorkspaces({
      limit: 10,
      dryRun: true,
    });

    expect(dryRunResult.processedEntities).toBe(1);
    expect(dryRunResult.driftedEntitiesCount).toBe(1);
    expect(dryRunResult.healedEntitiesCount).toBe(0);
    expect(dryRunResult.driftReports[0].driftFields).toContain('displayName');

    // Workspace entity is still unhealed
    const weBeforeHeal = workspaceEntitiesStore.get(`${wsId}_${entityId}`) as unknown as WorkspaceEntity;
    expect(weBeforeHeal.displayName).toBe('Ridge Clinic');

    // 2. Live Run: repair drift
    const liveRunResult = await reconcileEntitiesAndWorkspaces({
      limit: 10,
      dryRun: false,
    });

    expect(liveRunResult.processedEntities).toBe(1);
    expect(liveRunResult.healedEntitiesCount).toBe(1);
    expect(liveRunResult.healedWorkspaceEntitiesCount).toBe(1);

    // Workspace entity is now fully healed to match canonical golden record
    const weAfterHeal = workspaceEntitiesStore.get(`${wsId}_${entityId}`) as unknown as WorkspaceEntity;
    expect(weAfterHeal.displayName).toBe('Ridge Specialist Hospital');
    expect(weAfterHeal.displayNameLower).toBe('ridge specialist hospital');
    expect(weAfterHeal.primaryContactName).toBe('Dr. Mensah');
    expect(weAfterHeal.primaryEmail).toBe('mensah@hospital.com');
    expect(weAfterHeal.primaryPhone).toBe('+233501234567');

    // 3. Subsequent run verifies complete convergence (0 drift)
    const postConvergenceResult = await reconcileEntitiesAndWorkspaces({
      limit: 10,
      dryRun: true,
    });
    expect(postConvergenceResult.driftedEntitiesCount).toBe(0);
  });
});
