/**
 * @fileOverview Unit Tests for MCP Tools Visibility Scoping & Anti-IDOR Protection
 *
 * Validates fail-closed scoping rules for taskListTool, dealListTool, and dealGetTool:
 * 1. Standard users only see tasks and deals they are assigned to, own, or created.
 * 2. Workspace admins & agents bypass scoping and can view all workspace items.
 * 3. Anti-IDOR masking prevents unauthorized deal enumeration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { McpExecutionContext } from '../types';

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      collection: vi.fn(),
    },
  };
});

// Mock Workspace Admin Check
vi.mock('@/lib/workspace-admin-utils', () => {
  return {
    isUserWorkspaceAdmin: vi.fn(),
  };
});

import { adminDb } from '@/lib/firebase-admin';
import { isUserWorkspaceAdmin } from '@/lib/workspace-admin-utils';
import { taskListTool } from '../tools/task-tools';
import { dealListTool, dealGetTool } from '../tools/deal-tools';
import { taskSearchCapability } from '@/platform/domains/tasks_productivity/contracts/task-search.contract';
import { dealSearchCapability, dealGetCapability } from '@/platform/domains/deals_revenue/contracts/deal-capabilities.contract';

describe('MCP Tools Tri-Domain Visibility Scoping', () => {
  const mockContext: McpExecutionContext = {
    callerType: 'user',
    callerId: 'usr_standard_1',
    workspaceId: 'ws_demo',
    organizationId: 'org_demo',
    requestId: 'req_123',
    timestamp: new Date().toISOString(),
    callDepth: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('taskListTool', () => {
    it('filters out tasks not assigned to or created by standard user in restricted workspace', async () => {
      vi.mocked(adminDb.collection).mockImplementation((colName: string) => {
        if (colName === 'workspaces') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ restrictTasksVisibilityToAssigned: true }),
              }),
            }),
          } as unknown as ReturnType<typeof adminDb.collection>;
        }
        if (colName === 'users') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ role: 'member' }),
              }),
            }),
          } as unknown as ReturnType<typeof adminDb.collection>;
        }
        return {} as unknown as ReturnType<typeof adminDb.collection>;
      });

      vi.mocked(isUserWorkspaceAdmin).mockReturnValue(false);

      vi.spyOn(taskSearchCapability, 'handler').mockResolvedValue({
        success: true,
        data: {
          totalFound: 3,
          tasks: [
            {
              id: 'task_1',
              title: 'My Assigned Task',
              description: '',
              status: 'todo',
              priority: 'high',
              dueDate: null,
              entityId: null,
              assignedTo: 'usr_standard_1',
            },
            {
              id: 'task_2',
              title: 'My Created Task',
              description: '',
              status: 'in_progress',
              priority: 'medium',
              dueDate: null,
              entityId: null,
              createdBy: 'usr_standard_1',
            },
            {
              id: 'task_3',
              title: 'Someone Else Task',
              description: '',
              status: 'completed',
              priority: 'low',
              dueDate: null,
              entityId: null,
              assignedTo: 'usr_other',
              createdBy: 'usr_other',
            },
          ],
        },
        executionId: 'exec_1',
        emittedEvents: [],
        durationMs: 10,
      });

      const result = await taskListTool.handler({}, mockContext);

      expect(result.totalFound).toBe(2);
      expect(result.tasks.map((t) => t.id)).toEqual(['task_1', 'task_2']);
    });

    it('returns all tasks when caller is a workspace admin', async () => {
      vi.mocked(adminDb.collection).mockImplementation((colName: string) => {
        if (colName === 'workspaces') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ restrictTasksVisibilityToAssigned: true }),
              }),
            }),
          } as unknown as ReturnType<typeof adminDb.collection>;
        }
        if (colName === 'users') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ role: 'admin' }),
              }),
            }),
          } as unknown as ReturnType<typeof adminDb.collection>;
        }
        return {} as unknown as ReturnType<typeof adminDb.collection>;
      });

      vi.mocked(isUserWorkspaceAdmin).mockReturnValue(true);

      vi.spyOn(taskSearchCapability, 'handler').mockResolvedValue({
        success: true,
        data: {
          totalFound: 2,
          tasks: [
            {
              id: 'task_1',
              title: 'Task 1',
              description: '',
              status: 'todo',
              priority: 'high',
              dueDate: null,
              entityId: null,
              assignedTo: 'usr_other',
            },
            {
              id: 'task_2',
              title: 'Task 2',
              description: '',
              status: 'todo',
              priority: 'medium',
              dueDate: null,
              entityId: null,
              assignedTo: 'usr_standard_1',
            },
          ],
        },
        executionId: 'exec_2',
        emittedEvents: [],
        durationMs: 10,
      });

      const result = await taskListTool.handler({}, mockContext);

      expect(result.totalFound).toBe(2);
      expect(result.tasks.length).toBe(2);
    });
  });

  describe('dealListTool', () => {
    it('filters out deals not assigned to, owned, or created by standard user in restricted workspace', async () => {
      vi.mocked(adminDb.collection).mockImplementation((colName: string) => {
        if (colName === 'workspaces') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ restrictDealsVisibilityToAssigned: true }),
              }),
            }),
          } as unknown as ReturnType<typeof adminDb.collection>;
        }
        if (colName === 'users') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ role: 'member' }),
              }),
            }),
          } as unknown as ReturnType<typeof adminDb.collection>;
        }
        return {} as unknown as ReturnType<typeof adminDb.collection>;
      });

      vi.mocked(isUserWorkspaceAdmin).mockReturnValue(false);

      vi.spyOn(dealSearchCapability, 'handler').mockResolvedValue({
        success: true,
        data: {
          totalFound: 3,
          deals: [
            {
              id: 'deal_1',
              name: 'My Assigned Deal',
              entityId: 'ent_1',
              stageId: 'lead',
              stageName: 'Lead',
              value: 1000,
              status: 'open',
              createdAt: new Date().toISOString(),
              assignedTo: 'usr_standard_1',
            },
            {
              id: 'deal_2',
              name: 'My Owned Deal',
              entityId: 'ent_2',
              stageId: 'proposal',
              stageName: 'Proposal',
              value: 5000,
              status: 'open',
              createdAt: new Date().toISOString(),
              ownerId: 'usr_standard_1',
            },
            {
              id: 'deal_3',
              name: 'Someone Else Deal',
              entityId: 'ent_3',
              stageId: 'won',
              stageName: 'Won',
              value: 10000,
              status: 'won',
              createdAt: new Date().toISOString(),
              ownerId: 'usr_other',
              assignedTo: 'usr_other',
            },
          ],
        },
        executionId: 'exec_3',
        emittedEvents: [],
        durationMs: 10,
      });

      const result = await dealListTool.handler({}, mockContext);

      expect(result.totalFound).toBe(2);
      expect(result.deals.map((d) => d.id)).toEqual(['deal_1', 'deal_2']);
    });
  });

  describe('dealGetTool', () => {
    it('throws Anti-IDOR not found error when standard user requests unassigned deal', async () => {
      vi.mocked(adminDb.collection).mockImplementation((colName: string) => {
        if (colName === 'workspaces') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ restrictDealsVisibilityToAssigned: true }),
              }),
            }),
          } as unknown as ReturnType<typeof adminDb.collection>;
        }
        if (colName === 'users') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ role: 'member' }),
              }),
            }),
          } as unknown as ReturnType<typeof adminDb.collection>;
        }
        return {} as unknown as ReturnType<typeof adminDb.collection>;
      });

      vi.mocked(isUserWorkspaceAdmin).mockReturnValue(false);

      vi.spyOn(dealGetCapability, 'handler').mockResolvedValue({
        success: true,
        data: {
          id: 'deal_secret',
          name: 'Secret Enterprise Deal',
          entityId: 'ent_99',
          stageId: 'proposal',
          stageName: 'Proposal',
          value: 500000,
          status: 'open',
          createdAt: new Date().toISOString(),
          ownerId: 'usr_other_exec',
          assignedTo: 'usr_other_exec',
          createdBy: 'usr_other_exec',
        },
        executionId: 'exec_4',
        emittedEvents: [],
        durationMs: 10,
      });

      await expect(
        dealGetTool.handler({ dealId: 'deal_secret' }, mockContext)
      ).rejects.toThrow('Deal "deal_secret" not found in workspace.');
    });

    it('allows standard user to retrieve their own assigned deal', async () => {
      vi.mocked(adminDb.collection).mockImplementation((colName: string) => {
        if (colName === 'workspaces') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ restrictDealsVisibilityToAssigned: true }),
              }),
            }),
          } as unknown as ReturnType<typeof adminDb.collection>;
        }
        if (colName === 'users') {
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ role: 'member' }),
              }),
            }),
          } as unknown as ReturnType<typeof adminDb.collection>;
        }
        return {} as unknown as ReturnType<typeof adminDb.collection>;
      });

      vi.mocked(isUserWorkspaceAdmin).mockReturnValue(false);

      vi.spyOn(dealGetCapability, 'handler').mockResolvedValue({
        success: true,
        data: {
          id: 'deal_my_deal',
          name: 'My Assigned Deal',
          entityId: 'ent_1',
          stageId: 'proposal',
          stageName: 'Proposal',
          value: 25000,
          status: 'open',
          createdAt: new Date().toISOString(),
          assignedTo: 'usr_standard_1',
        },
        executionId: 'exec_5',
        emittedEvents: [],
        durationMs: 10,
      });

      const result = await dealGetTool.handler({ dealId: 'deal_my_deal' }, mockContext);
      expect(result.id).toBe('deal_my_deal');
      expect(result.value).toBe(25000);
    });
  });
});
