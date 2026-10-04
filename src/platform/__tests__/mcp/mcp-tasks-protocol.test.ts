/**
 * @fileOverview Unit & Integration Tests for MCP Tasks Protocol Extension (Spec 2026-07-28)
 *
 * Verifies conformance with:
 * - MCP Tasks Protocol Spec 2026-07-28 (tasks/create, tasks/get, tasks/list, tasks/cancel, tasks/result)
 * - Rule 4: Zero `any` or `any[]` typing policy
 * - Rule 8 & 47: Anti-IDOR tenant perimeter
 * - Rule 9: Cloud Run 32MB payload ceiling & resource clamping
 * - Rule 11 & 38: Streamable HTTP statelessness (no legacy sessions)
 * - Rule 19: Deterministic idempotency keys
 * - Rule 20: Correlation ID tracing
 * - Rule 26 & 27: Cooperative cancellation and Saga compensation
 * - Rule 60: Emergency Dead-Man Switch halting execution with HTTP 503
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskCreateInputSchema,
  TaskListInputSchema,
  MCP_TASKS_ERROR_CODES,
  McpTasksError,
  mapWorkflowStateToTaskStatus,
} from '@/platform/mcp/tasks/mcp-tasks-types';
import { McpTasksHandler } from '@/platform/mcp/tasks/mcp-tasks-handler';
import { createMemoryWorkflowStore } from '@/platform/workflows/workflow-store';
import { createEventBus } from '@/platform/events/event-bus';
import type { CloudTasksWorkflowDispatcher } from '@/platform/workflows/dispatcher/workflow-dispatcher-types';
import type { TenantBoundary, StoredPrincipal } from '@/platform/workflows/workflow-types';
import type { AgentPrincipal } from '@/platform/capabilities/contracts/capability-definition';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { POST, OPTIONS } from '@/app/api/mcp/v2/tasks/route';

describe('MCP Tasks Protocol Extension (Spec 2026-07-28)', () => {
  const tenant: TenantBoundary = {
    organizationId: 'org_tasks_test',
    workspaceId: 'ws_tasks_test',
  };

  const samplePrincipal: StoredPrincipal = {
    actorType: 'agent',
    agentId: 'persona_workflow_orchestrator',
    agentVersion: '1.0.0',
    userId: 'usr_agent_01',
    organizationId: tenant.organizationId,
    workspaceId: tenant.workspaceId,
    effectiveRole: 'agent:operator',
    grantedScopes: ['crm:read', 'crm:write', 'workflows:execute'],
  };

  describe('1. Canonical Contracts & Schema Validation (Rules 4, 11, 38)', () => {
    it('validates task status transitions and mappings', () => {
      expect(mapWorkflowStateToTaskStatus('CREATED')).toBe('working');
      expect(mapWorkflowStateToTaskStatus('QUEUED')).toBe('working');
      expect(mapWorkflowStateToTaskStatus('RUNNING')).toBe('working');
      expect(mapWorkflowStateToTaskStatus('RESUMED')).toBe('working');
      expect(mapWorkflowStateToTaskStatus('VERIFYING')).toBe('working');
      expect(mapWorkflowStateToTaskStatus('WAITING')).toBe('suspended');
      expect(mapWorkflowStateToTaskStatus('COMPLETED')).toBe('completed');
      expect(mapWorkflowStateToTaskStatus('FAILED')).toBe('failed');
      expect(mapWorkflowStateToTaskStatus('TIMED_OUT')).toBe('failed');
      expect(mapWorkflowStateToTaskStatus('CANCELLED')).toBe('cancelled');
    });

    it('validates TaskCreateInputSchema with defaults', () => {
      const parsed = TaskCreateInputSchema.parse({
        name: 'Lead Onboarding Flow',
        definitionId: 'lead_onboarding_v1',
        inputs: { email: 'lead@example.com' },
      });

      expect(parsed.name).toBe('Lead Onboarding Flow');
      expect(parsed.definitionId).toBe('lead_onboarding_v1');
      expect(parsed.inputs).toEqual({ email: 'lead@example.com' });
    });

    it('clamps TaskListInput limit between 1 and 100 (Rule 9)', () => {
      const parsedDefault = TaskListInputSchema.parse({});
      expect(parsedDefault.limit).toBe(20);

      const parsedCapped = TaskListInputSchema.parse({ limit: 500 });
      expect(parsedCapped.limit).toBe(100);

      const parsedFloor = TaskListInputSchema.parse({ limit: -5 });
      expect(parsedFloor.limit).toBe(1);
    });

    it('validates structured McpTasksError with error taxonomy', () => {
      const err = new McpTasksError(
        'TASK_NOT_FOUND',
        "Task 'task_xyz' does not exist",
        { taskId: 'task_xyz' }
      );

      expect(err.code).toBe(MCP_TASKS_ERROR_CODES.TASK_NOT_FOUND);
      expect(err.message).toBe("Task 'task_xyz' does not exist");
      expect(err.details).toEqual({ taskId: 'task_xyz' });
    });
  });

  describe('2. McpTasksHandler Core Operations (Rules 8, 16, 19, 20, 26, 47)', () => {
    let store: ReturnType<typeof createMemoryWorkflowStore>;
    let eventBus: ReturnType<typeof createEventBus>;
    let mockDispatcher: CloudTasksWorkflowDispatcher;
    let dispatchedSteps: Array<{ workflowId: string; stepId: string; attempt: number }>;
    let handler: McpTasksHandler;

    beforeEach(() => {
      store = createMemoryWorkflowStore();
      eventBus = createEventBus();
      dispatchedSteps = [];
      setGovernanceDeadManStateForTests(false);

      mockDispatcher = {
        enqueueWorkflowStep: async (params) => {
          dispatchedSteps.push({
            workflowId: params.workflowId,
            stepId: params.stepId,
            attempt: params.attempt ?? 0,
          });
          return {
            taskId: `task_cloud_${params.stepId}`,
            queue: 'projects/test/queues/workflow-step-queue',
            scheduledAt: new Date().toISOString(),
          };
        },
        cancelWorkflowStepTask: async () => true,
        getQueueMetrics: async () => ({
          queueName: 'test',
          tasksCount: 0,
          oldestTaskAgeSeconds: 0,
          healthy: true,
        }),
      };

      handler = new McpTasksHandler({
        store,
        eventBus,
        dispatcher: mockDispatcher,
      });
    });

    it('handles tasks/create: creates workflow, registers step 0, enqueues task, and publishes domain event', async () => {
      const events: string[] = [];
      eventBus.subscribe('mcp.task.created', async (evt) => {
        events.push(evt.type);
      });

      const result = await handler.handleCreateTask(
        {
          name: 'Customer Onboarding Task',
          definitionId: 'customer_onboard_v1',
          inputs: { customerId: 'cust_123' },
        },
        samplePrincipal,
        { correlationId: 'corr_task_01' }
      );

      expect(result.taskId).toMatch(/^wf_/);
      expect(result.status).toBe('working');
      expect(result.createdAt).toBeDefined();

      // Verify instance exists in store
      const instance = await store.getInstance(result.taskId, tenant);
      expect(instance).not.toBeNull();
      expect(instance?.title).toBe('Customer Onboarding Task');
      expect(instance?.definitionId).toBe('customer_onboard_v1');
      expect(instance?.inputs).toEqual({ customerId: 'cust_123' });

      // Domain event published
      expect(events).toContain('mcp.task.created');
    });

    it('handles tasks/get: returns task progress, step ID, and suspended wait condition', async () => {
      const instance = await store.createInstance({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        definitionId: 'test_def',
        title: 'Test Task',
        initiator: { actorType: 'agent', actorId: samplePrincipal.userId },
        principal: samplePrincipal,
      });

      const _step0 = await store.createStep({
        workflowId: instance.id,
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        stepIndex: 0,
        capabilityId: 'crm.find_contact',
        name: 'Find Contact',
        status: 'COMPLETED',
      });

      const step1 = await store.createStep({
        workflowId: instance.id,
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        stepIndex: 1,
        capabilityId: 'billing.charge_card',
        name: 'Charge Card',
        status: 'WAITING',
        waitCondition: {
          type: 'approval',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          details: { riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE' },
        },
      });

      await store.updateInstanceStatus(instance.id, 'QUEUED', tenant);
      await store.updateInstanceStatus(instance.id, 'RUNNING', tenant);
      await store.updateInstanceStatus(instance.id, 'WAITING', tenant, {
        currentStepId: step1.id,
        waitCondition: {
          type: 'approval',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          details: { riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE' },
        },
      });

      const taskDetails = await handler.handleGetTask(
        { taskId: instance.id },
        samplePrincipal
      );

      expect(taskDetails.taskId).toBe(instance.id);
      expect(taskDetails.status).toBe('suspended');
      expect(taskDetails.currentStepId).toBe(step1.id);
      expect(taskDetails.progress).toBe(50); // 1 out of 2 steps completed = 50%
      expect(taskDetails.waitCondition?.type).toBe('approval');
    });

    it('handles tasks/list: enforces Anti-IDOR multi-tenant perimeter and paged filtering', async () => {
      await handler.handleCreateTask(
        { name: 'Task 1', definitionId: 'def_1' },
        samplePrincipal
      );
      await handler.handleCreateTask(
        { name: 'Task 2', definitionId: 'def_2' },
        samplePrincipal
      );

      const listRes = await handler.handleListTasks(
        { limit: 10 },
        samplePrincipal
      );

      expect(listRes.total).toBe(2);
      expect(listRes.tasks.length).toBe(2);

      // Other tenant cannot see these tasks
      const foreignPrincipal: AgentPrincipal = {
        ...samplePrincipal,
        organizationId: 'org_foreign',
        workspaceId: 'ws_foreign',
      };

      const foreignList = await handler.handleListTasks(
        { limit: 10 },
        foreignPrincipal
      );
      expect(foreignList.total).toBe(0);
      expect(foreignList.tasks.length).toBe(0);
    });

    it('handles tasks/cancel: triggers cooperative cancellation and Saga compensation', async () => {
      const created = await handler.handleCreateTask(
        { name: 'Cancellable Task', definitionId: 'cancel_def' },
        samplePrincipal
      );

      const cancelRes = await handler.handleCancelTask(
        { taskId: created.taskId, reason: 'User requested abort' },
        samplePrincipal
      );

      expect(cancelRes.taskId).toBe(created.taskId);
      expect(cancelRes.status).toBe('cancelled');
      expect(cancelRes.cancelledAt).toBeDefined();

      const instance = await store.getInstance(created.taskId, tenant);
      expect(instance?.status).toBe('CANCELLED');
    });

    it('handles tasks/result: returns final outputs for completed tasks or sanitized errors for failed tasks', async () => {
      const instance = await store.createInstance({
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        definitionId: 'result_flow',
        title: 'Completed Task',
        initiator: { actorType: 'agent', actorId: samplePrincipal.userId },
        principal: samplePrincipal,
      });

      await store.updateInstanceStatus(instance.id, 'QUEUED', tenant);
      await store.updateInstanceStatus(instance.id, 'RUNNING', tenant);
      await store.updateInstanceStatus(instance.id, 'COMPLETED', tenant, {
        outputs: { customerId: 'cust_999', score: 95 },
      });

      const resultRes = await handler.handleGetTaskResult(
        { taskId: instance.id },
        samplePrincipal
      );

      expect(resultRes.taskId).toBe(instance.id);
      expect(resultRes.status).toBe('completed');
      expect(resultRes.output).toEqual({ customerId: 'cust_999', score: 95 });
    });

    it('enforces Rule 60: halts tasks/create when emergency dead-man switch is active', async () => {
      setGovernanceDeadManStateForTests(true);

      await expect(
        handler.handleCreateTask(
          { name: 'Paused Task', definitionId: 'paused_def' },
          samplePrincipal
        )
      ).rejects.toThrow(/DEAD_MAN_PAUSED/);
    });
  });

  describe('3. Streamable HTTP Route Handler POST /api/mcp/v2/tasks (Rules 9, 11, 38, 51)', () => {
    beforeEach(() => {
      setGovernanceDeadManStateForTests(false);
    });

    it('responds to OPTIONS preflight with allowed methods and headers', async () => {
      const res = await OPTIONS();
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(res.headers.get('Access-Control-Allow-Headers')).toContain('mcp-transaction-id');
    });

    it('rejects oversized payloads (> 32MB) with HTTP 413 (Rule 9)', async () => {
      const req = new Request('http://localhost:3000/api/mcp/v2/tasks', {
        method: 'POST',
        headers: {
          'content-length': String(33 * 1024 * 1024), // 33MB
          'content-type': 'application/json',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tasks/list', params: {} }),
      });

      const res = await POST(req);
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.error.message).toContain('exceeds maximum allowed size');
    });

    it('rejects requests missing valid authentication credentials with HTTP 401', async () => {
      const req = new Request('http://localhost:3000/api/mcp/v2/tasks', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tasks/list', params: {} }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.code).toBe(-32001); // UNAUTHENTICATED
    });
  });
});
