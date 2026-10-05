// @vitest-environment node
/**
 * @fileOverview Saga compensation authority (Phase 11 M2 review R2; Rules 16, 17, 27).
 *
 * Since M0 · T3 compensation runs through the gateway. The engine used to invent a principal (the
 * capability id as its only scope, role 'admin', an empty workspace) and mix context into the input,
 * so every compensating capability that declares a permission was refused. Compensation now runs
 * as the run's own delegated agent: the authorizing user + persona permissions, no wildcard, no
 * admin, and the input is exactly the compensation arguments.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { SagaCompensationEngine } from '@/platform/runtime/governance/saga-compensation';
import { createMemoryAgentRunStore } from '@/platform/runtime/agent-run-store';
import { createCapabilityRegistryStore, type CapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';
import type { AgentPrincipal, AnyCapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { globalAgentPersonaRegistry } from '@/platform/identity/agent-registry';

let seenInputs: unknown[];
let seenPrincipals: AgentPrincipal[];

function undoCapability(id: string, permission: string): AnyCapabilityDefinition {
  return {
    id, version: '1.0.0', name: id, description: `Undo for ${id}`, domain: 'meetings_conversations', operation: 'delete',
    permissions: [permission], workspaceScoped: true, tenantScoped: true,
    risk: { level: 'L1_INTERNAL_DRAFT', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
    execution: { synchronous: true, maxDurationMs: 5000, supportsDryRun: true, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 10_000 },
    policies: { requiresIdempotencyKey: true, requiresExpectedVersion: false, auditRequired: true },
    inputSchema: z.object({ draftId: z.string() }),
    outputSchema: z.object({ undone: z.boolean() }),
    handler: async (input, context) => {
      seenInputs.push(input);
      seenPrincipals.push(context.principal);
      return { success: true, data: { undone: true }, executionId: 'e', emittedEvents: [], durationMs: 1 };
    },
  };
}

const allowed = undoCapability('meeting.test_undo_draft', 'rbac:operations.meetings.edit');
const outsidePersona = undoCapability('meeting.test_undo_settings', 'rbac:operations.tasks.delete');

let runStore: ReturnType<typeof createMemoryAgentRunStore>;
let registry: CapabilityRegistryStore;
let engine: SagaCompensationEngine;

async function runWithStep(compensatingCapabilityId: string) {
  const run = await runStore.createRun({
    organizationId: 'org-1', workspaceId: 'ws-a', agentPersonaId: 'meeting_analyst',
    principalId: 'agent-run-1', authorizingUserId: 'user-1', goal: { prompt: 'Draft a follow-up' },
  });
  const step = await runStore.createStep('org-1', run.runId, {
    stepId: 'step_0', runId: run.runId, organizationId: 'org-1', workspaceId: 'ws-a', stepIndex: 0, type: 'tool_call',
    title: 'Create draft', capabilityId: 'meeting.test_create_draft', compensatingCapabilityId,
    idempotencyKey: 'idem_0', correlationId: 'corr_0', input: { meetingId: 'm-1' },
  });
  await runStore.updateStep({ organizationId: 'org-1', runId: run.runId, stepId: step.stepId, status: 'completed', output: { draftId: 'd-1' }, compensationStatus: 'pending' });
  return run;
}

beforeEach(() => {
  setGovernanceDeadManStateForTests(false);
  seenInputs = [];
  seenPrincipals = [];
  runStore = createMemoryAgentRunStore();
  registry = createCapabilityRegistryStore();
  registry.register(allowed);
  registry.register(outsidePersona);
  engine = new SagaCompensationEngine({ runStore, capabilityRegistry: registry });
});

describe('saga compensation runs as the run\'s delegated agent', () => {
  it('compensates with a permissioned capability the persona holds', async () => {
    const run = await runWithStep(allowed.id);
    const result = await engine.rollbackRun({ organizationId: 'org-1', workspaceId: 'ws-a', runId: run.runId, reason: 'later step failed' });
    expect(result.success).toBe(true);
    expect(result.completedCompensations).toBe(1);
  });

  it('uses the authorizing user and persona permissions: no wildcard, no admin, no capability-id scope', async () => {
    const run = await runWithStep(allowed.id);
    await engine.rollbackRun({ organizationId: 'org-1', workspaceId: 'ws-a', runId: run.runId, reason: 'x' });
    const p = seenPrincipals[0];
    expect(p.actorType).toBe('agent');
    expect(p.userId).toBe('user-1');
    expect(p.agentId).toBe('agent-run-1');
    expect(p.workspaceId).toBe('ws-a');
    expect(p.runId).toBe(run.runId);
    expect(p.effectiveRole).not.toBe('admin');
    expect(p.grantedScopes).toEqual(globalAgentPersonaRegistry.getPersona('meeting_analyst')?.allowedPermissions);
    expect(p.grantedScopes).not.toContain(allowed.id);
    expect(p.grantedScopes.some((s) => s.includes('*'))).toBe(false);
  });

  it('sends exactly the compensation arguments as input (no principal, context or timestamp)', async () => {
    const run = await runWithStep(allowed.id);
    await engine.rollbackRun({ organizationId: 'org-1', workspaceId: 'ws-a', runId: run.runId, reason: 'x' });
    expect(seenInputs[0]).toEqual({ draftId: 'd-1' });
  });

  it('refuses a compensating capability outside the persona and flags operator intervention', async () => {
    const run = await runWithStep(outsidePersona.id);
    const result = await engine.rollbackRun({ organizationId: 'org-1', workspaceId: 'ws-a', runId: run.runId, reason: 'x' });
    expect(result.success).toBe(false);
    expect(result.requiresOperatorIntervention).toBe(true);
    expect(seenInputs).toHaveLength(0);
  });

  it('fails closed when the run (and so its authority) cannot be found', async () => {
    const run = await runWithStep(allowed.id);
    const result = await engine.rollbackRun({ organizationId: 'org-1', workspaceId: 'ws-a', runId: run.runId, reason: 'x' });
    expect(result.success).toBe(true);
    // A rollback request naming another workspace than the run's is refused, never re-scoped.
    const other = await runWithStep(allowed.id);
    seenInputs = [];
    const foreign = await engine.rollbackRun({ organizationId: 'org-1', workspaceId: 'ws-b', runId: other.runId, reason: 'x' });
    expect(foreign.success).toBe(false);
    expect(seenInputs).toHaveLength(0);
  });
});
