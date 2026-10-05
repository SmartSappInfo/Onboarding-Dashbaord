/**
 * @fileOverview Unit & Contract Tests for Revenue Swarm Contracts (Phase 10 Milestone 5 Task 1)
 *
 * Implements Rule 4, 10, 48, 60.
 */

import { describe, it, expect } from 'vitest';
import {
  RevenueSwarmCriteriaSchema,
  RevenueSwarmStageNameSchema,
  RevenueSwarmStageStatusSchema,
  RevenueSwarmStageResultSchema,
  RevenueSwarmMissionInputSchema,
  RevenueSwarmOutcomeSchema,
  REVENUE_SWARM_ERROR_CODES,
  RevenueSwarmError,
  mapRevenueSwarmErrorToHttpStatus,
} from '@/platform/agents/sales/swarm/revenue-swarm-types';

describe('Revenue Swarm Contracts & Zod v4 Schemas (Phase 10 Milestone 5)', () => {
  it('validates RevenueSwarmCriteriaSchema with defaults and clamps', () => {
    const defaultParsed = RevenueSwarmCriteriaSchema.parse({
      query: 'Find 20 qualified leads in edtech and prepare outreach',
    });

    expect(defaultParsed.query).toBe('Find 20 qualified leads in edtech and prepare outreach');
    expect(defaultParsed.targetIndustry).toBe('edtech');
    expect(defaultParsed.targetLeadCount).toBe(20);
    expect(defaultParsed.minQualificationScore).toBe(60);
    expect(defaultParsed.channels).toEqual(['whatsapp', 'email']);
    expect(defaultParsed.sdrPersonaId).toBe('lead_sdr');
    expect(defaultParsed.dryRun).toBe(true);

    // Rejects targetLeadCount exceeding 50 (Rule 9)
    expect(() =>
      RevenueSwarmCriteriaSchema.parse({
        query: 'Mass scraping',
        targetLeadCount: 100,
      })
    ).toThrow();

    // Rejects empty query
    expect(() =>
      RevenueSwarmCriteriaSchema.parse({
        query: '',
      })
    ).toThrow();
  });

  it('validates 6 canonical stage names and stage statuses', () => {
    const validStages = [
      'discovery',
      'enrichment',
      'research',
      'qualification',
      'personalization',
      'staging',
    ] as const;

    for (const stage of validStages) {
      expect(RevenueSwarmStageNameSchema.parse(stage)).toBe(stage);
    }

    expect(RevenueSwarmStageStatusSchema.parse('completed')).toBe('completed');
    expect(RevenueSwarmStageStatusSchema.parse('in_progress')).toBe('in_progress');
    expect(RevenueSwarmStageStatusSchema.parse('failed')).toBe('failed');
    expect(RevenueSwarmStageStatusSchema.parse('skipped')).toBe('skipped');
  });

  it('validates RevenueSwarmStageResultSchema', () => {
    const stageResult = {
      stage: 'discovery',
      status: 'completed',
      countIn: 0,
      countOut: 20,
      durationMs: 420,
      details: 'Discovered 20 educational institutions in Greater Accra',
      errors: [],
    };

    const parsed = RevenueSwarmStageResultSchema.parse(stageResult);
    expect(parsed.stage).toBe('discovery');
    expect(parsed.countOut).toBe(20);
    expect(parsed.errors).toEqual([]);
  });

  it('validates RevenueSwarmMissionInputSchema with multi-tenant bounds', () => {
    const validMission = {
      organizationId: 'org_edu_01',
      workspaceId: 'ws_sales_01',
      criteria: {
        query: 'Find 20 qualified leads in edtech and prepare outreach',
        targetIndustry: 'edtech',
        targetLeadCount: 20,
        channels: ['whatsapp'],
      },
      authorizingUserId: 'user_rep_01',
    };

    const parsed = RevenueSwarmMissionInputSchema.parse(validMission);
    expect(parsed.organizationId).toBe('org_edu_01');
    expect(parsed.workspaceId).toBe('ws_sales_01');
    expect(parsed.criteria.channels).toEqual(['whatsapp']);
  });

  it('validates RevenueSwarmOutcomeSchema structure and Blast Radius Report', () => {
    const validOutcome = {
      swarmRunId: 'swarm_run_edtech_99',
      organizationId: 'org_edu_01',
      workspaceId: 'ws_sales_01',
      status: 'waiting_for_approval',
      stages: [
        {
          stage: 'discovery',
          status: 'completed',
          countIn: 0,
          countOut: 20,
          durationMs: 420,
          details: 'Discovered 20 leads',
          errors: [],
        },
        {
          stage: 'staging',
          status: 'completed',
          countIn: 20,
          countOut: 20,
          durationMs: 250,
          details: 'Staged 20 outreach proposals',
          errors: [],
        },
      ],
      totalDiscovered: 20,
      totalEnriched: 20,
      totalQualified: 18,
      totalDraftsGenerated: 36,
      totalProposalsStaged: 1,
      proposals: [
        {
          proposalId: 'prop_swarm_seq_01',
          payloadHash: 'a'.repeat(64),
          status: 'staged',
          recipientCount: 18,
        },
      ],
      payloadHash: 'b'.repeat(64),
      isDryRun: true,
      blastRadius: {
        simulated: true,
        targetedLeads: 18,
        draftsGenerated: 36,
        proposalsStaged: 1,
        liveMutations: 0,
        summary: '0 live database mutations. Staged for operator review.',
      },
      durationMs: 4500,
      createdAt: new Date().toISOString(),
    };

    const parsed = RevenueSwarmOutcomeSchema.parse(validOutcome);
    expect(parsed.swarmRunId).toBe('swarm_run_edtech_99');
    expect(parsed.status).toBe('waiting_for_approval');
    expect(parsed.blastRadius.liveMutations).toBe(0);
  });

  it('provides structured error taxonomy and HTTP status mapping', () => {
    expect(REVENUE_SWARM_ERROR_CODES).toContain('SWARM_DEAD_MAN_PAUSED');
    expect(REVENUE_SWARM_ERROR_CODES).toContain('INVALID_CRITERIA');

    const error = new RevenueSwarmError(
      'SWARM_DEAD_MAN_PAUSED',
      'Sales operations currently halted by administrator.'
    );
    expect(error.code).toBe('SWARM_DEAD_MAN_PAUSED');
    expect(error.statusCode).toBe(503);
    expect(mapRevenueSwarmErrorToHttpStatus('SWARM_DEAD_MAN_PAUSED')).toBe(503);
    expect(mapRevenueSwarmErrorToHttpStatus('INVALID_CRITERIA')).toBe(400);
  });
});
