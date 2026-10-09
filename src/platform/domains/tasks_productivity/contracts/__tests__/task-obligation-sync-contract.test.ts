import { describe, it, expect, vi } from 'vitest';
import { 
  taskObligationSyncCapability, 
  TaskObligationSyncInputSchema,
  TaskObligationSyncOutputSchema,
  type TaskObligationSyncInput,
} from '../task-obligation-sync.contract';
import type { CapabilityExecutionContext } from '../../../../capabilities/contracts/capability-definition';

describe('task.obligation.sync Capability Contract', () => {
  it('validates schema correctly with valid parameters', () => {
    const valid = TaskObligationSyncInputSchema.safeParse({
      workspaceId: 'ws-1',
      taskId: 'task-100',
      expectedUpdatedAt: '2026-10-09T00:00:00.000Z',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects invalid inputs without workspaceId or taskId', () => {
    const invalid = TaskObligationSyncInputSchema.safeParse({
      workspaceId: '',
      taskId: '',
    });
    expect(valid(invalid).success).toBe(false);

    function valid(res: { success: boolean }) { return res; }
  });

  it('enforces L2_STATE_MUTATION risk level and workspace scoping', () => {
    expect(taskObligationSyncCapability.id).toBe('task.obligation.sync');
    expect(taskObligationSyncCapability.risk.level).toBe('L2_STATE_MUTATION');
    expect(taskObligationSyncCapability.workspaceScoped).toBe(true);
    expect(taskObligationSyncCapability.tenantScoped).toBe(true);
    expect(taskObligationSyncCapability.permissions).toContain('operations:tasks:edit');
  });

  it('defines valid output schema', () => {
    const output = TaskObligationSyncOutputSchema.safeParse({
      taskId: 'task-100',
      status: 'synced',
      syncedAt: '2026-10-09T00:00:00.000Z',
      contractId: 'contract-12',
      obligationId: 'ob-34',
    });
    expect(output.success).toBe(true);
  });
});
