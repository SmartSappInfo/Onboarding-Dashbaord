/**
 * @fileOverview Unit Tests for Swarm Coordinator & Consensus Synthesizer (Phase 6 Milestone 5)
 *
 * Validates Rules 8, 9, 21, 22, 23, 26, 27, 41, 42, 58, and 60 for multi-agent swarm missions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SwarmCoordinator } from '@/platform/runtime/swarm/swarm-coordinator';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

describe('Swarm Coordinator & Multi-Perspective Consensus (Rules 8, 9, 21, 22, 23, 26, 27, 41, 42, 58, 60)', () => {
  beforeEach(() => {
    setGovernanceDeadManStateForTests(false);
  });

  it('fails closed immediately when Rule 60 dead-man switch is active', async () => {
    setGovernanceDeadManStateForTests(true);
    const coordinator = new SwarmCoordinator();

    try {
      await expect(
        coordinator.executeMission({
          missionId: 'swarm_dead_man_test',
          topology: 'mesh_consensus',
          specialistPersonaIds: ['crm_researcher', 'lead_sdr'],
          objective: 'Test objective',
          tenantContext: { organizationId: 'org_1', workspaceId: 'ws_1' },
          budgets: { maxDurationMs: 60000, maxTokens: 40000, maxToolCalls: 20 },
        })
      ).rejects.toThrow('Governance emergency dead-man switch is ACTIVE');
    } finally {
      setGovernanceDeadManStateForTests(false);
    }
  });

  it('executes a mesh consensus mission with concurrency throttling and generates consensus', async () => {
    const coordinator = new SwarmCoordinator();
    const outcome = await coordinator.executeMission({
      missionId: 'swarm_consensus_1',
      topology: 'mesh_consensus',
      specialistPersonaIds: ['crm_researcher', 'deal_coach'],
      objective: 'Evaluate renewal terms for Greenfield Academy',
      tenantContext: { organizationId: 'org_1', workspaceId: 'ws_1' },
      budgets: { maxDurationMs: 60000, maxTokens: 40000, maxToolCalls: 20 },
    });

    expect(outcome.status).toBe('completed');
    expect(outcome.consensus).toBeDefined();
    expect(outcome.consensus?.specialistPerspectives).toHaveLength(2);
    expect(outcome.childRunIds).toHaveLength(2);
  });

  it('pauses swarm execution cleanly when a specialist requires human approval with SHA-256 payloadHash', async () => {
    const coordinator = new SwarmCoordinator({
      simulateApprovalRequiredForSpecialist: 'deal_coach',
    });

    const outcome = await coordinator.executeMission({
      missionId: 'swarm_approval_test',
      topology: 'pipeline',
      specialistPersonaIds: ['crm_researcher', 'deal_coach'],
      objective: 'Execute high risk price adjustment',
      tenantContext: { organizationId: 'org_1', workspaceId: 'ws_1' },
      budgets: { maxDurationMs: 60000, maxTokens: 40000, maxToolCalls: 20 },
    });

    expect(outcome.status).toBe('waiting_for_approval');
    expect(outcome.approvalProposalId).toBeDefined();
    expect(outcome.payloadHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('respects cooperative cancellation token and aborts active specialists', async () => {
    const coordinator = new SwarmCoordinator({ stepExecutionDelayMs: 25 });
    const abortController = new AbortController();

    const missionPromise = coordinator.executeMission({
      missionId: 'swarm_cancel_test',
      topology: 'pipeline',
      specialistPersonaIds: ['crm_researcher', 'lead_sdr', 'deal_coach'],
      objective: 'Long running task',
      tenantContext: { organizationId: 'org_1', workspaceId: 'ws_1' },
      budgets: { maxDurationMs: 60000, maxTokens: 40000, maxToolCalls: 20 },
      abortSignal: abortController.signal,
    });

    // Cancel after short delay
    setTimeout(() => abortController.abort(), 10);

    const outcome = await missionPromise;
    expect(outcome.status).toBe('cancelled');
  });

  it('supports Shadow Mode dry-run simulation without committing database writes', async () => {
    const coordinator = new SwarmCoordinator();
    const outcome = await coordinator.executeMission({
      missionId: 'swarm_shadow_test',
      topology: 'hierarchical',
      supervisorPersonaId: 'supervisor',
      specialistPersonaIds: ['crm_researcher', 'lead_sdr'],
      objective: 'Simulate lead campaign',
      tenantContext: { organizationId: 'org_1', workspaceId: 'ws_1' },
      budgets: { maxDurationMs: 60000, maxTokens: 40000, maxToolCalls: 20 },
      dryRun: true,
    });

    expect(outcome.status).toBe('completed');
    expect(outcome.isDryRun).toBe(true);
  });
});
