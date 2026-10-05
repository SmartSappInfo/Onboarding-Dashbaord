/**
 * @fileOverview Unit & Safety Tests for Sales Shadow Mode Simulation Harness & Blast Radius Reports (Phase 10 M2)
 *
 * Implements Rules 4, 12, 17, 19, 20, 26, 40, 41, 42, 60, 67, and 69.
 * Validates:
 * - Zero live database mutations on production data stores (dryRun: true)
 * - Interception of mutating operations (L1, L2, L3, L4)
 * - Flagging of non-delegable actions and two-phase approval requirements
 * - Emergency dead-man switch evaluation
 * - Blast Radius Report synthesis with WHAT, WHY, and EXPECTED STATE CHANGE explainability
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SalesShadowRunner } from '../../agents/sales/evaluation/sales-shadow-mode';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';

vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn().mockResolvedValue(undefined),
}));

describe('Sales Shadow Mode Simulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs a read-only prospecting simulation with zero mutations and outputs Blast Radius Report (Rule 42)', async () => {
    const runner = new SalesShadowRunner();
    const result = await runner.simulate({
      personaId: 'prospecting_agent',
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      goalPrompt: 'Find top 5 technology leads in Accra',
      simulatedSteps: [
        {
          capabilityId: 'lead.search',
          input: { queryText: 'Technology', limit: 5 },
          riskLevel: 'L0_READ',
        },
      ],
    });

    expect(result.dryRun).toBe(true);
    expect(result.liveMutationsExecuted).toBe(0);
    expect(result.blastRadiusReport).toBeDefined();
    expect(result.blastRadiusReport.highestRiskLevel).toBe('L0_READ');
    expect(result.blastRadiusReport.interceptedMutationsCount).toBe(0);
    expect(result.blastRadiusReport.requiresHumanApproval).toBe(false);
    expect(result.blastRadiusReport.hasNonDelegableActions).toBe(false);
    expect(result.blastRadiusReport.explainabilityBreakdown.length).toBe(1);
    expect(result.blastRadiusReport.explainabilityBreakdown[0].what).toBeTruthy();
    expect(result.blastRadiusReport.explainabilityBreakdown[0].why).toBeTruthy();
  });

  it('intercepts mutating capabilities in shadow mode and prevents live writes (Rule 42)', async () => {
    const runner = new SalesShadowRunner();
    const result = await runner.simulate({
      personaId: 'enrichment_agent',
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      goalPrompt: 'Enrich prospect lead_sample_01',
      simulatedSteps: [
        {
          capabilityId: 'lead.enrich',
          input: { prospectId: 'lead_sample_01', domain: 'example.com' },
          riskLevel: 'L1_INTERNAL_DRAFT',
        },
      ],
    });

    expect(result.dryRun).toBe(true);
    expect(result.liveMutationsExecuted).toBe(0);
    expect(result.blastRadiusReport.interceptedMutationsCount).toBe(1);
    expect(result.blastRadiusReport.highestRiskLevel).toBe('L1_INTERNAL_DRAFT');
    expect(result.interceptedSteps.length).toBe(1);
    expect(result.interceptedSteps[0].capabilityId).toBe('lead.enrich');
    expect(result.interceptedSteps[0].intercepted).toBe(true);
  });

  it('flags non-delegable operations as requiring human intervention (Rule 17 & 21)', async () => {
    const runner = new SalesShadowRunner();
    const result = await runner.simulate({
      personaId: 'lead_sdr',
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      goalPrompt: 'Dispatch outbound campaign',
      simulatedSteps: [
        {
          capabilityId: 'sdr.unsolicited_bulk_send',
          input: { recipients: ['ceo@target.com'] },
          riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
        },
      ],
    });

    expect(result.blastRadiusReport.hasNonDelegableActions).toBe(true);
    expect(result.blastRadiusReport.requiresHumanApproval).toBe(true);
    expect(result.blastRadiusReport.highestRiskLevel).toBe('L3_EXTERNAL_COMMUNICATION_FINANCE');
  });

  it('fails closed when emergency dead-man switch is engaged (Rule 60)', async () => {
    vi.mocked(checkGovernanceDeadManSwitch).mockRejectedValueOnce(
      new Error('EMERGENCY_GOVERNANCE_PAUSED')
    );

    const runner = new SalesShadowRunner();
    await expect(
      runner.simulate({
        personaId: 'lead_sdr',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        goalPrompt: 'Prepare SDR outreach',
        simulatedSteps: [
          {
            capabilityId: 'sdr.generate_outreach_draft',
            input: { prospectId: 'lead_123' },
            riskLevel: 'L1_INTERNAL_DRAFT',
          },
        ],
      })
    ).rejects.toThrow('EMERGENCY_GOVERNANCE_PAUSED');
  });

  it('supports cooperative cancellation via AbortSignal (Rule 26)', async () => {
    const controller = new AbortController();
    controller.abort();

    const runner = new SalesShadowRunner();
    await expect(
      runner.simulate({
        personaId: 'prospecting_agent',
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        goalPrompt: 'Search leads',
        signal: controller.signal,
        simulatedSteps: [
          {
            capabilityId: 'lead.search',
            input: { queryText: 'Schools' },
            riskLevel: 'L0_READ',
          },
        ],
      })
    ).rejects.toThrow('SIMULATION_ABORTED');
  });
});
