/**
 * @fileOverview Unit & Integration Tests for StepVerifier (Rules 18, 47)
 */

import { describe, it, expect } from 'vitest';
import { StepVerifier } from '@/platform/runtime/execution/step-verifier';
import { type PlanStep, type AgentStep } from '@/platform/runtime/agent-run-types';

describe('StepVerifier (Rules 18, 47 & Step 9 Lifecycle)', () => {
  const mockPlanStep = (overrides?: Partial<PlanStep>): PlanStep => ({
    stepId: 'step_1',
    stepIndex: 0,
    title: 'Update Contact Status',
    type: 'tool_call',
    capabilityId: 'crm.update_contact',
    dependsOnStepIds: [],
    expectedStateChange: 'contact status becomes active',
    isNonDelegable: false,
    timeoutMs: 30000,
    ...overrides,
  });

  const mockAgentStep = (overrides?: Partial<AgentStep>): AgentStep => ({
    stepId: 'step_1',
    runId: 'run_123',
    organizationId: 'org_acme',
    workspaceId: 'ws_crm',
    stepIndex: 0,
    type: 'tool_call',
    title: 'Update Contact Status',
    capabilityId: 'crm.update_contact',
    status: 'completed',
    idempotencyKey: 'idemp_step_1',
    correlationId: 'corr_step_1',
    input: { contactId: 'con_123', targetStatus: 'active' },
    tokensUsed: 100,
    outputValidated: false,
    compensationStatus: 'not_required',
    ...overrides,
  });

  it('verifies step when output state matches expected post-condition', async () => {
    const planStep = mockPlanStep({ expectedStateChange: 'status is active' });
    const agentStep = mockAgentStep();
    const executionOutput = { contactId: 'con_123', status: 'active', updatedAt: '2026-10-03T12:00:00Z' };

    const result = await StepVerifier.verifyStep({
      step: agentStep,
      planStep,
      executionOutput,
    });

    expect(result.verified).toBe(true);
    expect(result.assertionDetails).toContain('status is active');
    expect(result.observedState).toEqual(executionOutput);
  });

  it('fails verification when output contradicts expected state (Rule 47)', async () => {
    const planStep = mockPlanStep({ expectedStateChange: 'status is active' });
    const agentStep = mockAgentStep();
    const executionOutput = { contactId: 'con_123', status: 'pending', error: 'Approval pending' };

    const result = await StepVerifier.verifyStep({
      step: agentStep,
      planStep,
      executionOutput,
    });

    expect(result.verified).toBe(false);
    expect(result.rejectionReason).toContain('Post-condition assertion failed');
    expect(result.suggestedRemediation).toBeDefined();
  });

  it('detects TOCTOU optimistic concurrency conflicts (Rule 18)', async () => {
    const planStep = mockPlanStep({
      expectedStateChange: 'expectedVersion: 3',
    });
    const agentStep = mockAgentStep({
      input: { contactId: 'con_123', expectedVersion: 3 },
    });
    const executionOutput = { contactId: 'con_123', actualVersion: 4, concurrencyConflict: true };

    const result = await StepVerifier.verifyStep({
      step: agentStep,
      planStep,
      executionOutput,
    });

    expect(result.verified).toBe(false);
    expect(result.rejectionReason).toContain('TOCTOU');
    expect(result.suggestedRemediation).toContain('Re-read state');
  });

  it('succeeds unconditionally when no expectedStateChange is specified', async () => {
    const planStep = mockPlanStep({ expectedStateChange: undefined });
    const agentStep = mockAgentStep();
    const executionOutput = { summary: 'Read 5 contacts' };

    const result = await StepVerifier.verifyStep({
      step: agentStep,
      planStep,
      executionOutput,
    });

    expect(result.verified).toBe(true);
    expect(result.assertionDetails).toContain('No explicit post-conditions');
  });
});
