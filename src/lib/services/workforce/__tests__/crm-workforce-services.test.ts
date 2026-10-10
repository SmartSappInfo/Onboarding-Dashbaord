/**
 * @fileOverview Unit & Integration Tests for CRM Workforce & Ownership Services
 *
 * Verifies workspace-scoped CRM workload aggregation, portfolio migrations,
 * and multi-tenant security boundaries.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Tests both composite assignee objects ({ userId, name, email }) and legacy string IDs.
 * - Confirms workspace scoping isolates asset aggregation from other workspaces.
 * - Zero `any` or `any[]` typing standard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OwnershipTransferService } from '../ownership-transfer-service';
import { CrmWorkloadService } from '../crm-workload-service';
import { PersonService } from '@/lib/services/identity/person-service';
import { adminDb } from '@/lib/firebase-admin';

// In-memory data store for mocking Firestore collections
interface MockDoc {
  id: string;
  data: Record<string, unknown>;
}

const mockStore: Record<string, MockDoc[]> = {
  workspace_memberships: [],
  users: [],
  deals: [],
  workspace_entities: [],
  contacts: [],
  tasks: [],
  crm_tasks: [],
  meetings: [],
  automations: [],
  crm_ownership_transfers: [],
};

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => {
  const queryBuilder = (colName: string, filters: Array<{ field: string; op: string; value: unknown }> = []) => {
    return {
      where: vi.fn((field: string, op: string, value: unknown) => {
        return queryBuilder(colName, [...filters, { field, op, value }]);
      }),
      get: vi.fn(async () => {
        const docs = mockStore[colName] || [];
        const filtered = docs.filter((d) => {
          for (const f of filters) {
            const val = d.data[f.field];
            if (f.op === '==') {
              if (val !== f.value) return false;
            } else if (f.op === 'array-contains') {
              if (!Array.isArray(val) || !val.includes(f.value)) return false;
            }
          }
          return true;
        });

        return {
          empty: filtered.length === 0,
          size: filtered.length,
          docs: filtered.map((d) => ({
            id: d.id,
            ref: {
              id: d.id,
              update: vi.fn(async (updates: Record<string, unknown>) => {
                Object.assign(d.data, updates);
              }),
            },
            data: () => ({ ...d.data }),
          })),
        };
      }),
      doc: vi.fn((docId?: string) => {
        const id = docId || `generated_${Date.now()}_${Math.random()}`;
        return {
          id,
          get: vi.fn(async () => {
            const found = (mockStore[colName] || []).find((d) => d.id === id);
            return {
              exists: Boolean(found),
              id,
              data: () => found ? { ...found.data } : undefined,
            };
          }),
          set: vi.fn(async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
            const list = mockStore[colName] || [];
            const existing = list.find((d) => d.id === id);
            if (existing) {
              if (opts?.merge) {
                Object.assign(existing.data, data);
              } else {
                existing.data = { ...data };
              }
            } else {
              list.push({ id, data: { ...data } });
            }
          }),
          update: vi.fn(async (updates: Record<string, unknown>) => {
            const list = mockStore[colName] || [];
            const existing = list.find((d) => d.id === id);
            if (existing) {
              Object.assign(existing.data, updates);
            }
          }),
        };
      }),
    };
  };

  return {
    adminDb: {
      collection: vi.fn((colName: string) => queryBuilder(colName)),
      batch: vi.fn(() => ({
        set: vi.fn((ref: { id: string }, data: Record<string, unknown>) => {
          // Find collection
          for (const key of Object.keys(mockStore)) {
            const item = mockStore[key].find((d) => d.id === ref.id);
            if (item) {
              item.data = { ...data };
              return;
            }
          }
        }),
        update: vi.fn((ref: { id: string }, updates: Record<string, unknown>) => {
          for (const key of Object.keys(mockStore)) {
            const item = mockStore[key].find((d) => d.id === ref.id);
            if (item) {
              Object.assign(item.data, updates);
              return;
            }
          }
        }),
        commit: vi.fn(async () => {}),
      })),
    },
    adminAuth: {
      verifyIdToken: vi.fn(async () => ({ uid: 'admin_test_uid' })),
    },
  };
});

// Mock SecurityAuditService
vi.mock('@/lib/services/governance/security-audit-service', () => ({
  SecurityAuditService: {
    logEvent: vi.fn(async () => {}),
  },
}));

// Mock PersonService
vi.mock('@/lib/services/identity/person-service', () => ({
  PersonService: {
    getPerson: vi.fn(async (id: string) => {
      if (id === 'user_alice') {
        return { id: 'user_alice', displayName: 'Alice Rep', email: 'alice@example.com' };
      }
      if (id === 'user_bob') {
        return { id: 'user_bob', displayName: 'Bob Rep', email: 'bob@example.com' };
      }
      if (id === 'user_charlie') {
        return { id: 'user_charlie', displayName: 'Charlie Other', email: 'charlie@example.com' };
      }
      return null;
    }),
    getOrganizationPeopleDirectory: vi.fn(async () => [
      { person: { id: 'user_alice', displayName: 'Alice Rep', email: 'alice@example.com' } },
      { person: { id: 'user_bob', displayName: 'Bob Rep', email: 'bob@example.com' } },
      { person: { id: 'user_charlie', displayName: 'Charlie Other', email: 'charlie@example.com' } },
    ]),
  },
}));

describe('CRM Workforce & Workload Services Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockStore)) {
      mockStore[key] = [];
    }
  });

  describe('OwnershipTransferService Validation', () => {
    it('rejects transfer when source and target members are identical', async () => {
      await expect(
        OwnershipTransferService.transferOwnership('org_1', {
          sourcePersonId: 'user_alice',
          targetPersonId: 'user_alice',
          entityTypes: ['deal', 'contact'],
          executedBy: 'admin_1',
        })
      ).rejects.toThrow('Source and destination members must be different');
    });

    it('rejects transfer when source or target member is not found', async () => {
      await expect(
        OwnershipTransferService.transferOwnership('org_1', {
          sourcePersonId: 'user_nonexistent',
          targetPersonId: 'user_bob',
          entityTypes: ['deal'],
          executedBy: 'admin_1',
        })
      ).rejects.toThrow('Source or target member not found');
    });
  });

  describe('CrmWorkloadService.getWorkspaceCrmWorkloadOverview', () => {
    it('returns empty array when no users belong to the workspace', async () => {
      const result = await CrmWorkloadService.getWorkspaceCrmWorkloadOverview('org_1', 'ws_empty');
      expect(result).toEqual([]);
    });

    it('strictly scopes members and CRM assets to the given workspace', async () => {
      // 1. Populate workspace memberships: Alice & Bob in ws_sales, Charlie in ws_marketing
      mockStore.workspace_memberships = [
        {
          id: 'wsm_1',
          data: {
            organizationId: 'org_1',
            workspaceId: 'ws_sales',
            userId: 'user_alice',
            status: 'active',
          },
        },
        {
          id: 'wsm_2',
          data: {
            organizationId: 'org_1',
            workspaceId: 'ws_sales',
            userId: 'user_bob',
            status: 'active',
          },
        },
        {
          id: 'wsm_3',
          data: {
            organizationId: 'org_1',
            workspaceId: 'ws_marketing',
            userId: 'user_charlie',
            status: 'active',
          },
        },
      ];

      // 2. Populate users
      mockStore.users = [
        {
          id: 'user_alice',
          data: {
            organizationId: 'org_1',
            workspaceIds: ['ws_sales'],
            name: 'Alice Rep',
            email: 'alice@example.com',
          },
        },
        {
          id: 'user_bob',
          data: {
            organizationId: 'org_1',
            workspaceIds: ['ws_sales'],
            name: 'Bob Rep',
            email: 'bob@example.com',
          },
        },
        {
          id: 'user_charlie',
          data: {
            organizationId: 'org_1',
            workspaceIds: ['ws_marketing'],
            name: 'Charlie Other',
            email: 'charlie@example.com',
          },
        },
      ];

      // 3. Populate Deals:
      // - Alice: 1 deal in ws_sales ($50,000) with composite assignedTo
      // - Alice: 1 deal in ws_other ($999,999) - MUST NOT be counted!
      // - Bob: 1 deal in ws_sales ($25,000) with string assignedTo
      mockStore.deals = [
        {
          id: 'deal_1',
          data: {
            organizationId: 'org_1',
            workspaceId: 'ws_sales',
            assignedTo: { userId: 'user_alice', name: 'Alice Rep' },
            value: 50000,
            status: 'active',
          },
        },
        {
          id: 'deal_2',
          data: {
            organizationId: 'org_1',
            workspaceId: 'ws_other',
            assignedTo: { userId: 'user_alice', name: 'Alice Rep' },
            value: 999999,
            status: 'active',
          },
        },
        {
          id: 'deal_3',
          data: {
            organizationId: 'org_1',
            workspaceId: 'ws_sales',
            assignedTo: 'user_bob',
            value: 25000,
            status: 'active',
          },
        },
      ];

      // 4. Populate Workspace Entities (Contacts/Leads):
      // - Alice: 2 leads in ws_sales
      // - Bob: 1 contact in ws_sales
      mockStore.workspace_entities = [
        {
          id: 'we_1',
          data: {
            workspaceId: 'ws_sales',
            assignedTo: { userId: 'user_alice' },
            entityType: 'lead',
            status: 'active',
          },
        },
        {
          id: 'we_2',
          data: {
            workspaceId: 'ws_sales',
            ownerId: 'user_alice',
            entityType: 'lead',
            status: 'active',
          },
        },
        {
          id: 'we_3',
          data: {
            workspaceId: 'ws_sales',
            assignedTo: 'user_bob',
            entityType: 'customer',
            status: 'active',
          },
        },
      ];

      // 5. Populate Tasks:
      // - Alice: 1 open task in ws_sales
      // - Alice: 1 completed task in ws_sales (should not be counted)
      mockStore.tasks = [
        {
          id: 'task_1',
          data: {
            workspaceId: 'ws_sales',
            assignedTo: 'user_alice',
            status: 'pending',
          },
        },
        {
          id: 'task_2',
          data: {
            workspaceId: 'ws_sales',
            assignedTo: 'user_alice',
            status: 'completed',
          },
        },
      ];

      // 6. Populate Automations:
      // - Alice: 1 automation in ws_sales
      mockStore.automations = [
        {
          id: 'auto_1',
          data: {
            workspaceIds: ['ws_sales'],
            createdBy: 'user_alice',
            isArchived: false,
          },
        },
      ];

      // Run overview calculation for ws_sales
      const overview = await CrmWorkloadService.getWorkspaceCrmWorkloadOverview('org_1', 'ws_sales');

      // Assertions
      expect(overview).toHaveLength(2); // Only Alice and Bob, Charlie omitted!

      const aliceWl = overview.find((w) => w.personId === 'user_alice')!;
      expect(aliceWl).toBeDefined();
      expect(aliceWl.personName).toBe('Alice Rep');
      expect(aliceWl.dealCount).toBe(1);
      expect(aliceWl.totalPipelineValue).toBe(50000); // 50k from ws_sales, not 999k!
      expect(aliceWl.leadCount).toBe(2);
      expect(aliceWl.openTaskCount).toBe(1);
      expect(aliceWl.automationCount).toBe(1);
      expect(aliceWl.totalActiveEntities).toBe(5); // 1 deal + 2 leads + 1 task + 1 auto
      expect(aliceWl.hasOrphanRisk).toBe(true);

      const bobWl = overview.find((w) => w.personId === 'user_bob')!;
      expect(bobWl).toBeDefined();
      expect(bobWl.dealCount).toBe(1);
      expect(bobWl.totalPipelineValue).toBe(25000);
      expect(bobWl.contactCount).toBe(1);
      expect(bobWl.openTaskCount).toBe(0);
      expect(bobWl.hasOrphanRisk).toBe(true);
    });
  });

  describe('OwnershipTransferService Workspace-Scoped Migration', () => {
    it('migrates deals and entities only within the target workspace', async () => {
      // Setup deals
      mockStore.deals = [
        {
          id: 'deal_in_ws',
          data: {
            workspaceId: 'ws_sales',
            organizationId: 'org_1',
            assignedTo: { userId: 'user_alice', name: 'Alice Rep' },
            value: 75000,
          },
        },
        {
          id: 'deal_in_other_ws',
          data: {
            workspaceId: 'ws_other',
            organizationId: 'org_1',
            assignedTo: { userId: 'user_alice', name: 'Alice Rep' },
            value: 120000,
          },
        },
      ];

      mockStore.workspace_entities = [
        {
          id: 'we_in_ws',
          data: {
            workspaceId: 'ws_sales',
            organizationId: 'org_1',
            assignedTo: 'user_alice',
            entityType: 'lead',
            status: 'active',
          },
        },
        {
          id: 'we_in_other_ws',
          data: {
            workspaceId: 'ws_other',
            organizationId: 'org_1',
            assignedTo: 'user_alice',
            entityType: 'lead',
            status: 'active',
          },
        },
      ];

      const job = await OwnershipTransferService.transferOwnership('org_1', {
        sourcePersonId: 'user_alice',
        targetPersonId: 'user_bob',
        entityTypes: ['deal', 'lead'],
        workspaceId: 'ws_sales',
        executedBy: 'admin_test_uid',
      });

      expect(job.status).toBe('completed');
      expect(job.workspaceId).toBe('ws_sales');
      expect(job.transferredCounts.deal).toBe(1);
      expect(job.transferredCounts.lead).toBe(1);

      // Verify that deal in ws_sales was transferred to Bob
      const dealInWs = mockStore.deals.find((d) => d.id === 'deal_in_ws')!;
      expect((dealInWs.data.assignedTo as { userId: string }).userId).toBe('user_bob');
      expect(dealInWs.data.ownerId).toBe('user_bob');

      // Verify that deal in ws_other was NOT touched
      const dealInOtherWs = mockStore.deals.find((d) => d.id === 'deal_in_other_ws')!;
      expect((dealInOtherWs.data.assignedTo as { userId: string }).userId).toBe('user_alice');

      // Verify workspace entity in ws_sales was transferred
      const weInWs = mockStore.workspace_entities.find((d) => d.id === 'we_in_ws')!;
      expect((weInWs.data.assignedTo as { userId: string }).userId).toBe('user_bob');

      // Verify workspace entity in other workspace was NOT touched
      const weInOtherWs = mockStore.workspace_entities.find((d) => d.id === 'we_in_other_ws')!;
      expect(weInOtherWs.data.assignedTo).toBe('user_alice');
    });
  });
});
