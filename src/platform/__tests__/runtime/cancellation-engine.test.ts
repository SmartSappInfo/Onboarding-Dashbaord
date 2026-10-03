/**
 * @fileOverview Unit & Integration Tests for CancellationEngine (Rules 26, 40, 60)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CancellationEngine } from '@/platform/runtime/governance/cancellation-engine';
import { createMemoryAgentRunStore } from '@/platform/runtime/agent-run-store';
import { GovernanceError } from '@/platform/runtime/governance/governance-types';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

describe('CancellationEngine (Rules 26, 40, 60)', () => {
  let runStore: ReturnType<typeof createMemoryAgentRunStore>;
  let cancellationEngine: CancellationEngine;

  beforeEach(() => {
    setGovernanceDeadManStateForTests(false);
    runStore = createMemoryAgentRunStore();
    cancellationEngine = new CancellationEngine({ runStore });
  });

  it('creates cancellation tokens and triggers abort signal on cancel', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'crm_researcher',
      principalId: 'agent_res_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Long running task' },
    });

    const token = cancellationEngine.registerRun(run.runId);
    expect(token.isCancelled).toBe(false);
    expect(token.signal.aborted).toBe(false);

    let abortFired = false;
    token.signal.addEventListener('abort', () => {
      abortFired = true;
    });

    await cancellationEngine.cancelRun({
      organizationId: 'org_acme',
      runId: run.runId,
      reason: {
        requestedBy: 'user_1',
        reason: 'User cancelled via UI',
        timestamp: new Date().toISOString(),
        immediate: true,
        triggerSagaCompensation: true,
      },
    });

    expect(abortFired).toBe(true);
    expect(token.isCancelled).toBe(true);

    const updatedRun = await runStore.getRun('org_acme', run.runId);
    expect(updatedRun?.status).toBe('cancelled');
  });

  it('rejects cancellation on terminal run states (Rule 26)', async () => {
    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'crm_researcher',
      principalId: 'agent_res_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Finished task' },
    });

    // Valid transition: created -> failed (terminal)
    await runStore.updateRunStatus({
      organizationId: 'org_acme',
      runId: run.runId,
      toStatus: 'failed',
      reason: 'Failed early',
    });

    await expect(
      cancellationEngine.cancelRun({
        organizationId: 'org_acme',
        runId: run.runId,
        reason: {
          requestedBy: 'user_1',
          reason: 'Too late',
          timestamp: new Date().toISOString(),
          immediate: true,
          triggerSagaCompensation: false,
        },
      })
    ).rejects.toThrowError(GovernanceError);
  });

  it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
    setGovernanceDeadManStateForTests(true);

    const run = await runStore.createRun({
      organizationId: 'org_acme',
      workspaceId: 'ws_sales',
      agentPersonaId: 'crm_researcher',
      principalId: 'agent_res_1',
      authorizingUserId: 'user_1',
      goal: { prompt: 'Task under dead man' },
    });

    await expect(
      cancellationEngine.cancelRun({
        organizationId: 'org_acme',
        runId: run.runId,
        reason: {
          requestedBy: 'user_1',
          reason: 'Emergency cancel',
          timestamp: new Date().toISOString(),
          immediate: true,
          triggerSagaCompensation: false,
        },
      })
    ).rejects.toThrowError(GovernanceError);
  });

  it('supports unregistering runs and getting tokens', async () => {
    const token = cancellationEngine.registerRun('run_custom');
    expect(cancellationEngine.getToken('run_custom')).toBe(token);

    cancellationEngine.unregisterRun('run_custom');
    expect(cancellationEngine.getToken('run_custom')).toBeUndefined();
  });
});
