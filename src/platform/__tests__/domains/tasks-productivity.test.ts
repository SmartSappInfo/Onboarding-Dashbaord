/**
 * @fileOverview Unit & Contract Tests for Domain: tasks_productivity (PR-11 / Wave B-1)
 *
 * Implements Rule 2 (TDD), Rule 4 (Strict Typing), Rule 12 (Risk Level), Rule 18 (TOCTOU),
 * Rule 23 (State Changed Invariant), Rule 31 (Output Schema Validation), and Rule 47 (Tenant Isolation).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { defineContractSuite } from '../contract/define-contract-suite';
import type { AgentPrincipal } from '../../capabilities/contracts/capability-definition';
import { taskSearchCapability } from '../../domains/tasks_productivity/contracts/task-search.contract';
import { taskGetCapability } from '../../domains/tasks_productivity/contracts/task-get.contract';
import { taskCreateCapability } from '../../domains/tasks_productivity/contracts/task-create.contract';
import { taskUpdateCapability } from '../../domains/tasks_productivity/contracts/task-update.contract';
import { taskCompleteCapability } from '../../domains/tasks_productivity/contracts/task-complete.contract';

const authorizedPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_tasks_author',
  organizationId: 'org_tasks_test',
  workspaceId: 'ws_tasks_test',
  grantedScopes: [
    'operations:tasks:view',
    'operations:tasks:create',
    'operations:tasks:edit',
    'app:tasks_view',
    'app:tasks_create',
    'app:tasks_edit',
    'tasks:read',
    'tasks:create',
    'tasks:edit',
  ],
  effectiveRole: 'admin',
};

const unauthorizedPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_tasks_unauth',
  organizationId: 'org_tasks_test',
  workspaceId: 'ws_tasks_test',
  grantedScopes: ['finance:invoices:view'],
  effectiveRole: 'viewer',
};

const foreignWorkspacePrincipal: AgentPrincipal = {
  ...authorizedPrincipal,
  workspaceId: 'ws_foreign_tasks',
  organizationId: 'org_foreign_tasks',
};

// 1. Contract Suite: task.search
defineContractSuite({
  capability: taskSearchCapability,
  validInput: { workspaceId: 'ws_tasks_test', limit: 10 },
  invalidInput: { workspaceId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 2. Contract Suite: task.get
defineContractSuite({
  capability: taskGetCapability,
  validInput: { workspaceId: 'ws_tasks_test', taskId: 'task_sample_001' },
  invalidInput: { workspaceId: '', taskId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 3. Contract Suite: task.create
defineContractSuite({
  capability: taskCreateCapability,
  validInput: {
    workspaceId: 'ws_tasks_test',
    title: 'Follow up with lead on quote',
    priority: 'high',
    category: 'follow_up',
  },
  invalidInput: { workspaceId: 'ws_tasks_test', title: '' }, // empty title
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 4. Contract Suite: task.update (with TOCTOU)
defineContractSuite({
  capability: taskUpdateCapability,
  validInput: {
    workspaceId: 'ws_tasks_test',
    taskId: 'task_sample_001',
    title: 'Updated follow up title',
  },
  invalidInput: { workspaceId: 'ws_tasks_test', taskId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});

// 5. Contract Suite: task.complete
defineContractSuite({
  capability: taskCompleteCapability,
  validInput: {
    workspaceId: 'ws_tasks_test',
    taskId: 'task_sample_001',
  },
  invalidInput: { workspaceId: '', taskId: '' },
  authorizedPrincipal,
  unauthorizedPrincipal,
  foreignWorkspacePrincipal,
});
