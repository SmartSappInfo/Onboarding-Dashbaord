// @ts-nocheck
/**
 * Regression tests for createDeal's assignee resolution.
 *
 * Locks the contract the deal-creation UIs depend on:
 *  - 'direct' (the default) inherits the entity's workspace owner
 *  - an explicit `assignedTo` overrides the strategy
 *  - 'unassigned' clears the owner
 *
 * stageId + stageName are passed so no onboardingStages read is needed, and
 * the direct/explicit/unassigned paths never touch the `deals` collection for
 * stats — so the mock only needs workspace_entities.get and deals.add.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const ENTITY_OWNER = { userId: 'owner-1', name: 'Ada Owner', email: 'ada@example.com' };

// Captures the document handed to deals.add(...)
let lastAddedDeal: any = null;

vi.mock('@/lib/activity-logger', () => ({ logActivity: vi.fn().mockResolvedValue(undefined) }));

vi.mock('@/lib/firebase-admin', () => {
  const mockUsers = {
    'user-1': { id: 'user-1', name: 'User One', email: 'user1@example.com' },
    'user-2': { id: 'user-2', name: 'User Two', email: 'user2@example.com' },
  };

  return {
    adminDb: {
      collection: vi.fn((name: string) => {
        if (name === 'workspace_entities') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ assignedTo: ENTITY_OWNER }),
              }),
            })),
          };
        }
        if (name === 'pipelines') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => {
                  if (id === 'pipe-rr') {
                    return { assignmentStrategy: 'round-robin', assignmentUserIds: ['user-1', 'user-2'] };
                  }
                  if (id === 'pipe-val') {
                    return { assignmentStrategy: 'value-based', assignmentUserIds: ['user-1', 'user-2'] };
                  }
                  return { assignmentStrategy: 'direct', assignmentUserIds: [] };
                },
              }),
            })),
          };
        }
        if (name === 'onboardingStages') {
          return {
            doc: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ name: 'Discovery' }),
              }),
            })),
          };
        }
        if (name === 'users') {
          return {
            doc: vi.fn((id: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: !!mockUsers[id],
                data: () => mockUsers[id],
              }),
            })),
          };
        }
        if (name === 'deals') {
          return {
            add: vi.fn(async (doc: any) => {
              lastAddedDeal = doc;
              return { id: 'deal-123' };
            }),
            where: vi.fn((field1, op1, uid) => ({
              where: vi.fn((field2, op2, val2) => ({
                get: vi.fn().mockImplementation(async () => {
                  let size = 0;
                  let dealsList: any[] = [];
                  if (uid === 'user-1') {
                    size = 5;
                    dealsList = [{ value: 5000 }];
                  } else if (uid === 'user-2') {
                    size = 2;
                    dealsList = [{ value: 2000 }];
                  }
                  return {
                    size,
                    forEach: (cb: any) => {
                      dealsList.forEach(d => cb({ data: () => d }));
                    }
                  };
                })
              }))
            }))
          };
        }
        throw new Error(`Unexpected collection: ${name}`);
      }),
    },
  };
});

import { createDeal } from '../deal-actions';

const base = {
  entityId: 'ent-1',
  workspaceId: 'ws-1',
  organizationId: 'org-1',
  pipelineId: 'pipe-1',
  stageId: 'stage-1',
  stageName: 'Discovery',
  name: 'Acme Expansion',
};

describe('createDeal — assignee resolution', () => {
  beforeEach(() => {
    lastAddedDeal = null;
  });

  it("'direct' (default) inherits the entity's workspace owner", async () => {
    const res = await createDeal({ ...base, assignmentStrategy: 'direct' });
    expect(res.id).toBe('deal-123');
    expect(lastAddedDeal.assignedTo).toEqual(ENTITY_OWNER);
  });

  it('an explicit assignedTo overrides the strategy', async () => {
    const override = { userId: 'rep-9', name: 'Rep Nine', email: 'rep9@example.com' };
    await createDeal({ ...base, assignmentStrategy: 'direct', assignedTo: override });
    expect(lastAddedDeal.assignedTo).toEqual(override);
  });

  it("'unassigned' leaves the deal with no owner", async () => {
    await createDeal({ ...base, assignmentStrategy: 'unassigned' });
    expect(lastAddedDeal.assignedTo).toBeNull();
  });

  it('defaults focalContacts to an empty array when none provided', async () => {
    await createDeal({ ...base, assignmentStrategy: 'direct' });
    expect(lastAddedDeal.focalContacts).toEqual([]);
  });

  it("uses round-robin strategy from pipeline config when strategy is omitted/direct and selects user with fewest deals", async () => {
    await createDeal({ ...base, pipelineId: 'pipe-rr', assignmentStrategy: undefined });
    expect(lastAddedDeal.assignedTo).toEqual({ userId: 'user-2', name: 'User Two', email: 'user2@example.com' });
  });

  it("uses value-based strategy from pipeline config when strategy is omitted/direct and selects user with lowest total value", async () => {
    await createDeal({ ...base, pipelineId: 'pipe-val', assignmentStrategy: undefined });
    expect(lastAddedDeal.assignedTo).toEqual({ userId: 'user-2', name: 'User Two', email: 'user2@example.com' });
  });

  it("permits explicit eligibleUserIds override for round-robin", async () => {
    await createDeal({ ...base, pipelineId: 'pipe-rr', assignmentStrategy: 'round-robin', eligibleUserIds: ['user-1'] });
    expect(lastAddedDeal.assignedTo).toEqual({ userId: 'user-1', name: 'User One', email: 'user1@example.com' });
  });
});
