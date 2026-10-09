// @vitest-environment node
/**
 * @fileOverview Security Confinement, Cross-Tenant Authorization & Anti-IDOR Test Suite (Phase 6 / PRD §14.1 / Roadmap §79).
 *
 * Validates:
 * - SEC-01: Mutation core (task-core.ts) is NOT exposed via `'use server'`.
 * - SEC-02: Create operations strictly validate workspace membership.
 * - SEC-03: Update, delete, and retry operations reject foreign workspace task IDs (anti-IDOR).
 * - SEC-04: Bulk mutations reject mixed-workspace arrays and enforce tenant isolation.
 * - Capability contract tenancy scoping (Rule 12 & Rule 16).
 *
 * Strict Typing Standard: ZERO `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const h = vi.hoisted(() => ({
  tasks: new Map<string, Record<string, unknown>>(),
  workspaces: new Map<string, Record<string, unknown>>(),
  deletedTasks: new Set<string>(),
  sessionUid: 'user-tenant-a',
  validWorkspaceId: 'ws-tenant-a',
  foreignWorkspaceId: 'ws-tenant-b',
  permissionsGranted: true,
}));

vi.mock('@/lib/firebase-admin', () => {
  const doc = (col: string, id: string) => ({
    get: async () => {
      if (col === 'workspaces') {
        const ws = h.workspaces.get(id);
        return {
          exists: Boolean(ws),
          id,
          data: () => ws,
        };
      }
      return {
        exists: h.tasks.has(id),
        id,
        data: () => h.tasks.get(id),
      };
    },
    update: async (data: Record<string, unknown>) => {
      const existing = h.tasks.get(id) || {};
      h.tasks.set(id, { ...existing, ...data });
    },
    delete: async () => {
      h.tasks.delete(id);
      h.deletedTasks.add(id);
    },
  });

  return {
    adminDb: {
      collection: (col: string) => {
        if (col === 'tasks') {
          return {
            doc: (id: string) => doc('tasks', id),
            add: async (data: Record<string, unknown>) => {
              const newId = `task-${Date.now()}`;
              h.tasks.set(newId, data);
              return { id: newId };
            },
            where: () => ({
              get: async () => ({
                docs: Array.from(h.tasks.entries()).map(([id, data]) => ({
                  id,
                  data: () => data,
                })),
              }),
            }),
          };
        }
        if (col === 'workspaces') {
          return {
            doc: (id: string) => doc('workspaces', id),
          };
        }
        return {
          doc: (id: string) => doc(col, id),
          add: async () => ({ id: `doc-${Date.now()}` }),
        };
      },
      batch: () => {
        const operations: Array<() => void> = [];
        return {
          update: (docRef: { id?: string }, data: Record<string, unknown>) => {
            operations.push(() => {
              const id = docRef.id || '';
              const existing = h.tasks.get(id) || {};
              h.tasks.set(id, { ...existing, ...data });
            });
          },
          delete: (docRef: { id?: string }) => {
            operations.push(() => {
              const id = docRef.id || '';
              h.tasks.delete(id);
              h.deletedTasks.add(id);
            });
          },
          commit: async () => {
            operations.forEach((op) => op());
          },
        };
      },
    },
  };
});

vi.mock('@/lib/auth/require-auth', () => ({
  requireWorkspace: vi.fn(async (wsId: string) => {
    if (wsId !== h.validWorkspaceId) {
      throw new Error(`Unauthorized workspace access: ${wsId}`);
    }
    return { uid: h.sessionUid };
  }),
}));

vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn(async (_uid, _domain, _resource, _action, wsId) => {
    if (wsId !== h.validWorkspaceId || !h.permissionsGranted) {
      return { granted: false, reason: 'Permission denied: unauthorized workspace or role.' };
    }
    return { granted: true };
  }),
}));

import {
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
  bulkUpdateTasksAction,
  bulkDeleteTasksAction,
  retryTaskObligationSyncAction,
} from '@/lib/task-server-actions';
import { taskObligationSyncCapability } from '@/platform/domains/tasks_productivity/contracts/task-obligation-sync.contract';

describe('Tasks Security Confinement & Anti-IDOR Suite (Phase 6 / SEC-01–04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.tasks.clear();
    h.workspaces.clear();
    h.deletedTasks.clear();
    h.permissionsGranted = true;

    // Seed workspace
    h.workspaces.set(h.validWorkspaceId, {
      id: h.validWorkspaceId,
      organizationId: 'org-tenant-a',
    });

    // Seed a task in the caller's valid workspace
    h.tasks.set('task-valid-1', {
      id: 'task-valid-1',
      title: 'Valid Tenant Task',
      workspaceId: h.validWorkspaceId,
      status: 'todo',
      priority: 'high',
      category: 'general',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    });

    // Seed a task in a FOREIGN workspace (Tenant B)
    h.tasks.set('task-foreign-1', {
      id: 'task-foreign-1',
      title: 'Foreign Tenant Confidential Task',
      workspaceId: h.foreignWorkspaceId,
      status: 'todo',
      priority: 'urgent',
      category: 'general',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    });
  });

  describe('SEC-01: Mutation Core RPC Exposure Defense', () => {
    it('verifies that task-core.ts is not marked with "use server" directive', () => {
      const taskCorePath = path.resolve(process.cwd(), 'src/lib/tasks/task-core.ts');
      const content = fs.readFileSync(taskCorePath, 'utf8');

      // The file must not have a top-level 'use server' directive
      const lines = content.split('\n').map((l) => l.trim());
      const hasUseServerDirective = lines.some(
        (l) => l === "'use server';" || l === '"use server";'
      );
      expect(hasUseServerDirective).toBe(false);
    });
  });

  describe('SEC-02: Tenant Confinement on Task Creation', () => {
    it('rejects task creation targeting an unauthorized foreign workspace', async () => {
      const result = await createTaskAction({
        workspaceId: h.foreignWorkspaceId,
        title: 'Attacker injected task',
        status: 'todo',
        priority: 'medium',
        category: 'general',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Unauthorized workspace access/i);
    });

    it('succeeds for authorized workspace creation', async () => {
      const result = await createTaskAction({
        workspaceId: h.validWorkspaceId,
        title: 'Authorized Task',
        status: 'todo',
        priority: 'medium',
        category: 'general',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });
  });

  describe('SEC-03: Anti-IDOR Protection on Single Task Mutations', () => {
    it('rejects updating a task belonging to a foreign workspace', async () => {
      const result = await updateTaskAction('task-foreign-1', {
        title: 'Tampered title by Tenant A',
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Task does not belong to this workspace|Unauthorized workspace access/i);

      // Verify foreign record remains untampered in database
      const foreignTask = h.tasks.get('task-foreign-1');
      expect(foreignTask?.title).toBe('Foreign Tenant Confidential Task');
    });

    it('rejects deleting a task belonging to a foreign workspace', async () => {
      const result = await deleteTaskAction('task-foreign-1');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Task does not belong to this workspace|Unauthorized workspace access/i);
      expect(h.deletedTasks.has('task-foreign-1')).toBe(false);
    });

    it('rejects obligation retry on a foreign workspace task', async () => {
      const result = await retryTaskObligationSyncAction(
        h.validWorkspaceId,
        'task-foreign-1',
        '2026-10-01T00:00:00Z'
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Task does not belong to this workspace/i);
    });
  });

  describe('SEC-04: Bulk Operations Workspace Boundary Validation', () => {
    it('rejects bulk update when foreign workspace IDs are injected', async () => {
      const result = await bulkUpdateTasksAction(
        ['task-valid-1', 'task-foreign-1'],
        { status: 'done' },
        h.validWorkspaceId
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Some tasks are not in this workspace/i);

      // Verify foreign task was not updated
      const foreignTask = h.tasks.get('task-foreign-1');
      expect(foreignTask?.status).toBe('todo');
    });

    it('rejects bulk delete when foreign workspace IDs are injected', async () => {
      const result = await bulkDeleteTasksAction(
        ['task-valid-1', 'task-foreign-1'],
        h.validWorkspaceId
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Some tasks are not in this workspace/i);
      expect(h.deletedTasks.has('task-foreign-1')).toBe(false);
    });
  });

  describe('Capability Contract Tenancy Scoping (Rules 11, 12, 16)', () => {
    it('enforces tenant scoping and L2_STATE_MUTATION risk level', () => {
      expect(taskObligationSyncCapability.tenantScoped).toBe(true);
      expect(taskObligationSyncCapability.workspaceScoped).toBe(true);
      expect(taskObligationSyncCapability.risk.level).toBe('L2_STATE_MUTATION');
      expect(taskObligationSyncCapability.permissions).toContain('operations:tasks:edit');
    });
  });
});
