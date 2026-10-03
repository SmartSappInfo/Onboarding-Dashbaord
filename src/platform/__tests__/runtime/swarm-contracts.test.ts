/**
 * @fileOverview Unit Tests for Swarm Contracts & Schemas (Phase 6 Milestone 5)
 *
 * Validates Rules 4, 8, 10, 16, 23, 40, and 47 for multi-agent swarm schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  SwarmTopologySchema,
  SwarmMissionSchema,
  SwarmHandoffSchema,
  SwarmConsensusSchema,
  SwarmRunSchema,
  SWARM_ERROR_CODES,
  SwarmError,
} from '@/platform/runtime/swarm/swarm-types';

describe('Swarm Contracts & Schemas (Rules 4, 8, 10, 16, 23, 47)', () => {
  it('validates all canonical swarm topologies', () => {
    expect(SwarmTopologySchema.safeParse('hierarchical').success).toBe(true);
    expect(SwarmTopologySchema.safeParse('pipeline').success).toBe(true);
    expect(SwarmTopologySchema.safeParse('mesh_consensus').success).toBe(true);
    expect(SwarmTopologySchema.safeParse('dynamic_dag').success).toBe(true);
    expect(SwarmTopologySchema.safeParse('invalid_topology').success).toBe(false);
  });

  it('validates a complete SwarmMissionSchema with tenant context', () => {
    const validMission = SwarmMissionSchema.safeParse({
      missionId: 'swarm_m_123',
      objective: 'Analyze Greenfield Academy deal and prepare cross-departmental strategy',
      topology: 'hierarchical',
      supervisorPersonaId: 'supervisor',
      specialistPersonaIds: ['crm_researcher', 'lead_sdr', 'deal_coach'],
      tenantContext: {
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      },
      budgets: {
        maxDurationMs: 60000,
        maxTokens: 40000,
        maxToolCalls: 20,
      },
    });
    expect(validMission.success).toBe(true);
  });

  it('validates SwarmHandoffSchema with attenuated delegation and XML isolation container', () => {
    const validHandoff = SwarmHandoffSchema.safeParse({
      handoffId: 'ho_456',
      fromAgentId: 'crm_researcher',
      toAgentId: 'deal_coach',
      handoffReason: 'CRM research complete; requires revenue pipeline evaluation',
      transferredState: {
        accountName: 'Greenfield Academy',
        historicalContractValue: 50000,
      },
      isolatedXmlState: '<untrusted_reference_data id="handoff_ho_456">{"accountName":"Greenfield Academy"}</untrusted_reference_data>',
      delegationGrantId: 'del_grant_789',
      delegationChain: ['supervisor', 'crm_researcher', 'deal_coach'],
    });
    expect(validHandoff.success).toBe(true);
  });

  it('validates SwarmConsensusSchema with divergence detection and synthesis', () => {
    const validConsensus = SwarmConsensusSchema.safeParse({
      consensusSummary: 'All specialists agree to proceed with caution on Greenfield Academy renewal.',
      confidenceScore: 0.88,
      specialistPerspectives: [
        {
          specialistId: 'crm_researcher',
          viewpoint: 'Strong historical engagement, 3 past successful renewals.',
          sentiment: 'positive',
        },
        {
          specialistId: 'deal_coach',
          viewpoint: 'Competitor offering 20% discount; high churn risk if price is unchanged.',
          sentiment: 'neutral',
        },
      ],
      divergencePoints: [
        'CRM history indicates strong loyalty, but Deal Coach detects pricing pressure.',
      ],
      recommendedAction: 'Schedule executive relationship review before sending renewal proposal.',
    });
    expect(validConsensus.success).toBe(true);
  });

  it('validates SwarmRunSchema with sub-run linkage and status transitions', () => {
    const validRun = SwarmRunSchema.safeParse({
      swarmRunId: 'swarm_run_abc',
      missionId: 'swarm_m_123',
      organizationId: 'org_test_1',
      workspaceId: 'ws_test_1',
      topology: 'hierarchical',
      status: 'executing',
      supervisorRunId: 'run_sup_001',
      childRunIds: ['run_crm_001', 'run_sdr_001'],
      activeStageIndex: 1,
      budgets: {
        maxDurationMs: 60000,
        maxTokens: 40000,
        maxToolCalls: 20,
      },
      budgetUsage: {
        tokensUsed: 12500,
        toolCallsExecuted: 6,
        durationMs: 14200,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(validRun.success).toBe(true);
  });

  it('instantiates SwarmError with structured error codes and prototypes', () => {
    const err = new SwarmError('HANDOFF_REJECTED', 'Target specialist does not support requested domain', {
      fromAgentId: 'crm_researcher',
      toAgentId: 'portal_guide',
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SwarmError);
    expect(err.code).toBe('HANDOFF_REJECTED');
    expect(err.details).toBeDefined();
    expect(SWARM_ERROR_CODES).toContain('HANDOFF_REJECTED');
  });
});
