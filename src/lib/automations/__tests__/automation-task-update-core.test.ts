// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionContext } from '../execution-types';

const mockState = {
  updateTaskCoreCalls: [] as Array<{ taskId: string; updates: Record<string, unknown>; actor: unknown; expectedWorkspaceId?: string }>,
  updateTaskCoreResult: { success: true, error: undefined as string | undefined },
};

vi.mock('@/lib/tasks/task-core', () => ({
  updateTaskCore: vi.fn(async (taskId: string, updates: Record<string, unknown>, actor: unknown, expectedWorkspaceId?: string) => {
    mockState.updateTaskCoreCalls.push({ taskId, updates, actor, expectedWorkspaceId });
    return mockState.updateTaskCoreResult;
  }),
}));

import { handleUpdateTask } from '../actions/task-actions';

describe('Automation Task Update Core Routing (VULN-02 Remediation)', () => {
  beforeEach(() => {
    mockState.updateTaskCoreCalls = [];
    mockState.updateTaskCoreResult = { success: true, error: undefined };
  });

  const mockContext: ExecutionContext = {
    workspaceId: 'ws-automation-1',
    organizationId: 'org-1',
    automationId: 'auto-101',
    runId: 'run-999',
    payload: { taskId: 'trigger-task-123' },
  };

  it('throws an error if taskId cannot be resolved from config or trigger payload', async () => {
    await expect(
      handleUpdateTask({}, { ...mockContext, payload: {} })
    ).rejects.toThrow(/Update task action missing taskId/i);
    expect(mockState.updateTaskCoreCalls).toHaveLength(0);
  });

  it('routes task updates through updateTaskCore with a system actor', async () => {
    await handleUpdateTask(
      {
        taskId: 'target-task-456',
        status: 'in_progress',
        priority: 'high',
        assignedTo: 'usr-agent-3',
      },
      mockContext
    );

    expect(mockState.updateTaskCoreCalls).toHaveLength(1);
    const call = mockState.updateTaskCoreCalls[0];
    expect(call.taskId).toBe('target-task-456');
    expect(call.updates.status).toBe('in_progress');
    expect(call.updates.priority).toBe('high');
    expect(call.updates.assignedTo).toBe('usr-agent-3');
    expect(call.actor).toEqual({ kind: 'system', source: 'automation' });
    expect(call.expectedWorkspaceId).toBe('ws-automation-1');
  });

  it('resolves taskId from trigger payload when useTriggerTaskId is true', async () => {
    await handleUpdateTask(
      {
        useTriggerTaskId: true,
        status: 'done',
      },
      mockContext
    );

    expect(mockState.updateTaskCoreCalls).toHaveLength(1);
    const call = mockState.updateTaskCoreCalls[0];
    expect(call.taskId).toBe('trigger-task-123');
    expect(call.updates.status).toBe('done');
    expect(call.actor).toEqual({ kind: 'system', source: 'automation' });
    expect(call.expectedWorkspaceId).toBe('ws-automation-1');
  });

  it('throws an error when updateTaskCore fails', async () => {
    mockState.updateTaskCoreResult = { success: false, error: 'Task not found in this workspace.' };

    await expect(
      handleUpdateTask(
        {
          taskId: 'missing-task-789',
          status: 'done',
        },
        mockContext
      )
    ).rejects.toThrow(/Task not found in this workspace/i);
  });
});
