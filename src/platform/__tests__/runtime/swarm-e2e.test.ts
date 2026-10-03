/**
 * @fileOverview End-to-End Test Suite for Swarm Workflows (Phase 6 Milestone 5)
 *
 * Implements comprehensive end-to-end integration tests verifying all 4 canonical
 * swarm topologies (hierarchical, pipeline, mesh_consensus, dynamic_dag).
 */

import { describe, it, expect } from 'vitest';
import { SwarmCoordinator } from '@/platform/runtime/swarm/swarm-coordinator';
import { HandoffProtocol } from '@/platform/runtime/swarm/handoff-protocol';
import { DynamicTopologyRouter } from '@/platform/runtime/swarm/dynamic-topology-router';
import type { AgentPersonaId } from '@/platform/identity/agent-persona-types';

describe('Swarm Workflows End-to-End Suite (Phase 6 Milestone 5)', () => {
  it('completes an end-to-end multi-agent pipeline handoff flow', async () => {
    const coordinator = new SwarmCoordinator();
    const outcome = await coordinator.executeMission({
      missionId: 'swarm_e2e_pipeline',
      topology: 'pipeline',
      specialistPersonaIds: ['crm_researcher', 'lead_sdr'],
      objective: 'Discover and outreach to enterprise prospects',
      tenantContext: { organizationId: 'org_prod_1', workspaceId: 'ws_prod_1' },
      budgets: { maxDurationMs: 60000, maxTokens: 40000, maxToolCalls: 20 },
    });

    expect(outcome.status).toBe('completed');
    expect(outcome.childRunIds).toHaveLength(2);
    expect(outcome.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('completes an end-to-end multi-agent mesh consensus flow with divergence detection', async () => {
    const coordinator = new SwarmCoordinator();
    const outcome = await coordinator.executeMission({
      missionId: 'swarm_e2e_consensus',
      topology: 'mesh_consensus',
      specialistPersonaIds: ['crm_researcher', 'deal_coach'],
      objective: 'Comprehensive enterprise renewal strategy',
      tenantContext: { organizationId: 'org_prod_1', workspaceId: 'ws_prod_1' },
      budgets: { maxDurationMs: 60000, maxTokens: 40000, maxToolCalls: 20 },
    });

    expect(outcome.status).toBe('completed');
    expect(outcome.consensus?.divergencePoints).toBeDefined();
    expect(outcome.consensus?.divergencePoints.length).toBeGreaterThan(0);
    expect(outcome.consensus?.recommendedAction).toBeDefined();
  });

  it('completes an end-to-end hierarchical supervisor flow', async () => {
    const coordinator = new SwarmCoordinator();
    const outcome = await coordinator.executeMission({
      missionId: 'swarm_e2e_hierarchical',
      topology: 'hierarchical',
      supervisorPersonaId: 'supervisor',
      specialistPersonaIds: ['crm_researcher', 'lead_sdr', 'deal_coach'],
      objective: 'Full quarterly strategic review',
      tenantContext: { organizationId: 'org_prod_1', workspaceId: 'ws_prod_1' },
      budgets: { maxDurationMs: 60000, maxTokens: 40000, maxToolCalls: 20 },
    });

    expect(outcome.status).toBe('completed');
    expect(outcome.childRunIds).toHaveLength(4); // supervisor + 3 specialists
    expect(outcome.consensus).toBeDefined();
  });

  it('completes dynamic branching and handoff between agents based on verified conditions', async () => {
    const router = new DynamicTopologyRouter();
    const handoff = new HandoffProtocol();

    // 1. Evaluate dynamic branch
    const targetSpecialist = router.evaluateDynamicBranch({
      currentAgentId: 'crm_researcher',
      verificationResult: {
        verified: true,
        observedState: { dealSize: 250000, segment: 'enterprise' },
      },
      branchRules: [
        {
          conditionField: 'dealSize',
          operator: 'gt',
          threshold: 100000,
          targetSpecialistId: 'deal_coach',
        },
      ],
    });

    expect(targetSpecialist).toBe('deal_coach');

    // 2. Perform handoff
    const handoffResult = await handoff.executeHandoff({
      fromPersonaId: 'crm_researcher',
      toPersonaId: targetSpecialist as AgentPersonaId,
      handoffReason: 'Deal size exceeds 100k, transferring to Deal Strategy Coach',
      payload: { dealSize: 250000, segment: 'enterprise' },
      currentDelegationChain: ['supervisor', 'crm_researcher'],
      tenantContext: { organizationId: 'org_prod_1', workspaceId: 'ws_prod_1' },
    });

    expect(handoffResult.success).toBe(true);
    expect(handoffResult.handoff.toAgentId).toBe('deal_coach');
    expect(handoffResult.handoff.delegationChain).toEqual(['supervisor', 'crm_researcher', 'deal_coach']);
  });
});
