import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processActionNode } from '../automations/actions';
import type { ExecutionContext } from '../automations/execution-types';

/**
 * Behavior coverage for the END_AUTOMATION step: it marks the run completed and
 * fires the AUTOMATION_COMPLETED protocol. Exercised through processActionNode so
 * the dispatch wiring (uppercasing, routing) is covered too.
 */

const runUpdate = vi.fn().mockResolvedValue(undefined);
const mockTriggerProtocols = vi.fn().mockResolvedValue(undefined);
const mockLogAutomationEvent = vi.fn();

vi.mock('../automation-log', () => ({
  logAutomationEvent: (...args: unknown[]) => mockLogAutomationEvent(...args),
}));

vi.mock('../automation-processor', () => ({
  triggerAutomationProtocols: (...args: unknown[]) => mockTriggerProtocols(...args),
}));

vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({ doc: vi.fn(() => ({ update: runUpdate })) })),
  },
}));

const ctx: ExecutionContext = {
  automationId: 'auto-1',
  runId: 'run-1',
  workspaceId: 'ws-1',
  entityId: 'ent-1',
  entityType: 'institution',
  organizationId: 'org-1',
  payload: {},
};

describe('END_AUTOMATION step', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks the run completed and fires AUTOMATION_COMPLETED', async () => {
    const result = await processActionNode({ id: 'node-end', data: { actionType: 'END_AUTOMATION', config: {} } }, ctx);

    expect(result).toEqual({ __halt: true });
    expect(runUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    expect(mockTriggerProtocols).toHaveBeenCalledWith(
      'AUTOMATION_COMPLETED',
      expect.objectContaining({ automationId: 'auto-1', runId: 'run-1', entityId: 'ent-1' }),
    );
  });

  it('accepts a lower-cased actionType (dispatch normalizes casing)', async () => {
    const result = await processActionNode({ id: 'node-end', data: { actionType: 'end_automation', config: {} } }, ctx);
    expect(result).toEqual({ __halt: true });
    expect(runUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });
});
