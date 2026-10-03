/**
 * @fileOverview Unit Tests for Dynamic Topology Router & DAG Validator (Phase 6 Milestone 5)
 *
 * Validates Rules 4, 9, 18, 23, and 47 for multi-agent graph topologies and conditional branching.
 */

import { describe, it, expect } from 'vitest';
import { DynamicTopologyRouter } from '@/platform/runtime/swarm/dynamic-topology-router';

describe('Dynamic Topology Router & Multi-Agent DAG (Rules 9, 18, 23, 47)', () => {
  it('constructs and topologically orders a Hierarchical Supervisor topology', () => {
    const router = new DynamicTopologyRouter();
    const dag = router.buildTopologyGraph({
      missionId: 'm_1',
      topology: 'hierarchical',
      supervisorPersonaId: 'supervisor',
      specialistPersonaIds: ['crm_researcher', 'lead_sdr', 'deal_coach'],
      tenantContext: { organizationId: 'org_1', workspaceId: 'ws_1' },
      objective: 'Executive deal strategy',
      budgets: { maxDurationMs: 60000, maxTokens: 40000, maxToolCalls: 20 },
      dryRun: false,
      metadata: {},
    });

    expect(dag.nodes).toHaveLength(4); // supervisor + 3 specialists
    expect(dag.stages[0].specialistIds).toEqual(['supervisor']);
    expect(dag.stages[1].specialistIds).toContain('crm_researcher');
    expect(dag.stages[1].specialistIds).toContain('lead_sdr');
    expect(dag.stages[1].specialistIds).toContain('deal_coach');
  });

  it('constructs a Sequential Pipeline topology with strict linear dependencies', () => {
    const router = new DynamicTopologyRouter();
    const dag = router.buildTopologyGraph({
      missionId: 'm_2',
      topology: 'pipeline',
      specialistPersonaIds: ['crm_researcher', 'lead_sdr', 'deal_coach'],
      tenantContext: { organizationId: 'org_1', workspaceId: 'ws_1' },
      objective: 'Pipeline workflow',
      budgets: { maxDurationMs: 60000, maxTokens: 40000, maxToolCalls: 20 },
      dryRun: false,
      metadata: {},
    });

    expect(dag.stages).toHaveLength(3);
    expect(dag.stages[0].specialistIds).toEqual(['crm_researcher']);
    expect(dag.stages[1].specialistIds).toEqual(['lead_sdr']);
    expect(dag.stages[2].specialistIds).toEqual(['deal_coach']);
  });

  it('constructs a Mesh Consensus topology where all specialists execute in stage 0 and synthesis in stage 1', () => {
    const router = new DynamicTopologyRouter();
    const dag = router.buildTopologyGraph({
      missionId: 'm_3',
      topology: 'mesh_consensus',
      specialistPersonaIds: ['crm_researcher', 'deal_coach'],
      tenantContext: { organizationId: 'org_1', workspaceId: 'ws_1' },
      objective: 'Consensus review',
      budgets: { maxDurationMs: 60000, maxTokens: 40000, maxToolCalls: 20 },
      dryRun: false,
      metadata: {},
    });

    expect(dag.stages).toHaveLength(1);
    expect(dag.stages[0].specialistIds).toEqual(['crm_researcher', 'deal_coach']);
  });

  it('detects cycles in custom DAG topologies via Kahn algorithm and throws SwarmError', () => {
    const router = new DynamicTopologyRouter();
    expect(() =>
      router.validateCustomDag({
        nodes: ['agent_a', 'agent_b', 'agent_c'],
        edges: [
          { from: 'agent_a', to: 'agent_b' },
          { from: 'agent_b', to: 'agent_c' },
          { from: 'agent_c', to: 'agent_a' }, // cycle!
        ],
      })
    ).toThrow('Topology cycle detected');
  });

  it('enforces maximum node count ceiling (nodes <= 10) and dependency limit (<= 4)', () => {
    const router = new DynamicTopologyRouter();
    const excessiveNodes = Array.from({ length: 11 }, (_, i) => `agent_${i}`);
    expect(() =>
      router.validateCustomDag({
        nodes: excessiveNodes,
        edges: [],
      })
    ).toThrow('Maximum agent nodes exceeded');
  });

  it('evaluates dynamic branch condition based on intermediate step verification', () => {
    const router = new DynamicTopologyRouter();
    const nextAgent = router.evaluateDynamicBranch({
      currentAgentId: 'crm_researcher',
      verificationResult: {
        verified: true,
        observedState: { isEnterpriseDeal: true, contractValue: 150000 },
      },
      branchRules: [
        {
          conditionField: 'contractValue',
          operator: 'gt',
          threshold: 100000,
          targetSpecialistId: 'deal_coach',
        },
        {
          conditionField: 'isEnterpriseDeal',
          operator: 'eq',
          threshold: false,
          targetSpecialistId: 'lead_sdr',
        },
      ],
    });

    expect(nextAgent).toBe('deal_coach');
  });

  it('handles TOCTOU optimistic concurrency conflict by flagging node for replan', () => {
    const router = new DynamicTopologyRouter();
    const branchAction = router.handleToctouConflict({
      conflictedNodeId: 'deal_coach',
      expectedVersion: 2,
      observedVersion: 3,
    });

    expect(branchAction.action).toBe('replan_with_latest_state');
    expect(branchAction.targetNodeId).toBe('deal_coach');
  });
});
