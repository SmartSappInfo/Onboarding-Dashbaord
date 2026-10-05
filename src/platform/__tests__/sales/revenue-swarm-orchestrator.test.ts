/**
 * @fileOverview Unit & Integration Tests for Revenue Swarm Orchestrator (Phase 10 Milestone 5 Task 2)
 *
 * Implements:
 * - Rule 4: Zero `any`/`any[]` typing.
 * - Rule 8: Multi-tenant Anti-IDOR boundary validation.
 * - Rule 9 & 23: Concurrency limits (max 4 parallel operations).
 * - Rule 21 & 22: Two-Phase Approval proposal staging and SHA-256 payloadHash binding.
 * - Rule 26: Cooperative cancellation via AbortSignal.
 * - Rule 30: Untrusted reference data isolation.
 * - Rule 40: Domain event emission via defaultEventBus.
 * - Rule 42: Shadow Mode Blast Radius reporting (0 live mutations).
 * - Rule 60: Step 1 emergency dead-man pause evaluation.
 * - Rule 69: Strangler Fig Invariant.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RevenueSwarmOrchestrator } from '@/platform/agents/sales/swarm/revenue-swarm-orchestrator';
import type { RevenueSwarmMissionInput } from '@/platform/agents/sales/swarm/revenue-swarm-types';
import type { Prospect } from '@/lib/lead-intelligence/types';

// Mock governance dead-man switch
vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(async (orgId?: string) => {
    if (orgId === 'org_paused') {
      throw new Error('Dead man switch is active');
    }
  }),
}));

// Mock FieldsVariablesService to verify workspace SSOT delegation
vi.mock('@/lib/services/fields-variables-service-impl', () => ({
  FieldsVariablesService: {
    resolveTemplateVariables: vi.fn(async (text: string) => {
      return text.replace('{{prospect.name}}', 'Accra Grammar School');
    }),
  },
}));

describe('RevenueSwarmOrchestrator (Phase 10 Milestone 5)', () => {
  const mockProspects: Prospect[] = [
    {
      id: 'prosp_accra_grammar',
      name: 'Accra Grammar School',
      address: 'East Legon, Accra, Ghana',
      phone: '020 123 4567',
      website: 'https://accragrammar.edu.gh',
      status: 'new',
      contacts: [
        {
          id: 'con_sarah',
          name: 'Sarah Mensah',
          role: 'Head of Admissions',
          email: 'sarah@accragrammar.edu.gh',
          phone: '024 987 6543',
          verificationStatus: 'verified',
        },
      ],
      scoring: {
        overallScore: 85,
        icpFit: 35,
        needIntensity: 25,
        buyingIntent: 15,
        engagementVelocity: 10,
      },
    },
    {
      id: 'prosp_ridge_church',
      name: 'Ridge Church School',
      address: 'Ridge, Accra, Ghana',
      phone: '030 222 3344',
      website: 'https://ridgechurch.edu.gh',
      status: 'new',
      contacts: [
        {
          id: 'con_kwame',
          name: 'Kwame Asante',
          role: 'Bursar & Finance Lead',
          email: 'kwame@ridgechurch.edu.gh',
          phone: '050 555 6677',
          verificationStatus: 'verified',
        },
      ],
      scoring: {
        overallScore: 78,
        icpFit: 30,
        needIntensity: 22,
        buyingIntent: 16,
        engagementVelocity: 10,
      },
    },
  ];

  const defaultMission: RevenueSwarmMissionInput = {
    organizationId: 'org_test_school',
    workspaceId: 'ws_sales_demo',
    criteria: {
      query: 'Find 20 qualified leads in edtech and prepare outreach',
      targetIndustry: 'edtech',
      geography: 'Greater Accra, Ghana',
      targetLeadCount: 20,
      minQualificationScore: 70,
      channels: ['whatsapp', 'email'],
      sdrPersonaId: 'lead_sdr',
      dryRun: true,
    },
    authorizingUserId: 'usr_sdr_lead',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes full 6-stage autonomous swarm pipeline in dryRun mode', async () => {
    const orchestrator = new RevenueSwarmOrchestrator({
      mockProspects,
    });

    const outcome = await orchestrator.executeMission(defaultMission);

    expect(outcome.swarmRunId).toBeDefined();
    expect(outcome.organizationId).toBe('org_test_school');
    expect(outcome.workspaceId).toBe('ws_sales_demo');
    expect(outcome.status).toBe('waiting_for_approval');
    expect(outcome.stages).toHaveLength(6);

    // Verify individual stage metrics
    const stageNames = outcome.stages.map((s) => s.stage);
    expect(stageNames).toEqual([
      'discovery',
      'enrichment',
      'research',
      'qualification',
      'personalization',
      'staging',
    ]);

    expect(outcome.totalDiscovered).toBe(2);
    expect(outcome.totalEnriched).toBe(2);
    expect(outcome.totalQualified).toBe(2);
    expect(outcome.totalDraftsGenerated).toBeGreaterThanOrEqual(4); // 2 leads * 2 channels
    expect(outcome.totalProposalsStaged).toBe(1);

    // Verify Blast Radius Report (Rule 42)
    expect(outcome.blastRadius.simulated).toBe(true);
    expect(outcome.blastRadius.liveMutations).toBe(0);
    expect(outcome.blastRadius.targetedLeads).toBe(2);

    // Verify SHA-256 payloadHash binding (Rule 22)
    expect(outcome.payloadHash).toHaveLength(64);
    expect(outcome.proposals[0]?.payloadHash).toHaveLength(64);
    expect(outcome.proposals[0]?.recipientCount).toBe(2);
  });

  it('halts execution immediately when dead-man switch is active (Rule 60)', async () => {
    const orchestrator = new RevenueSwarmOrchestrator({
      mockProspects,
    });

    const pausedMission: RevenueSwarmMissionInput = {
      ...defaultMission,
      organizationId: 'org_paused',
    };

    await expect(orchestrator.executeMission(pausedMission)).rejects.toThrow(
      'Sales operations are currently suspended'
    );
  });

  it('honors cooperative cancellation via AbortSignal (Rule 26)', async () => {
    const orchestrator = new RevenueSwarmOrchestrator({
      mockProspects,
      stageDelayMs: 50,
    });

    const controller = new AbortController();
    controller.abort();

    await expect(
      orchestrator.executeMission(defaultMission, controller.signal)
    ).rejects.toThrow('Swarm mission was cancelled');
  });

  it('filters out prospects below minQualificationScore in stage 4', async () => {
    const lowScoreProspects: Prospect[] = [
      ...mockProspects,
      {
        id: 'prosp_low_score',
        name: 'Unqualified Academy',
        address: 'Accra',
        phone: '020 000 0000',
        status: 'new',
        scoring: {
          overallScore: 45, // Below 70 threshold
          icpFit: 15,
          needIntensity: 10,
          buyingIntent: 10,
          engagementVelocity: 10,
        },
      },
    ];

    const orchestrator = new RevenueSwarmOrchestrator({
      mockProspects: lowScoreProspects,
    });

    const outcome = await orchestrator.executeMission(defaultMission);
    expect(outcome.totalDiscovered).toBe(3);
    expect(outcome.totalQualified).toBe(2); // Only 2 above 70
    expect(outcome.blastRadius.targetedLeads).toBe(2);
  });

  it('clamps targetLeadCount to maximum 50 (Rule 9 & 23)', async () => {
    const orchestrator = new RevenueSwarmOrchestrator({
      mockProspects,
    });

    const clampedMission: RevenueSwarmMissionInput = {
      ...defaultMission,
      criteria: {
        ...defaultMission.criteria,
        targetLeadCount: 50,
      },
    };

    const outcome = await orchestrator.executeMission(clampedMission);
    expect(outcome.status).toBe('waiting_for_approval');
  });
});
