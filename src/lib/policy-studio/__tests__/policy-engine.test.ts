/**
 * @fileoverview Automated Unit Test Suite for Policy Studio Pure Computational Engine (Phase 4).
 */

import { describe, it, expect } from 'vitest';
import {
  validatePolicyIntegrity,
  evaluateEventUnderPolicy,
  simulatePolicyImpact,
  generatePolicyChangeDiff,
} from '../policy-engine';
import type { PerformancePolicy, PolicyScoringRule } from '../types';
import type { SalesPerformanceDaily } from '@/lib/sales-performance/types';

describe('Policy Studio Pure Computational Engine (Phase 4)', () => {
  const sampleScoringRules: PolicyScoringRule[] = [
    {
      id: 'r_call_completed',
      eventType: 'phone_call_completed',
      entityType: 'Contact',
      category: 'communication',
      description: 'Awarded when an outbound call is finished and logged',
      enabled: true,
      basePoints: 10,
      targetDimension: 'effort',
      conditions: [
        { field: 'durationSeconds', operator: 'greater_than_or_equal', value: 60 },
      ],
      multipliers: [
        {
          conditionField: 'dealValue',
          conditionOperator: 'greater_than',
          conditionValue: 20000,
          multiplier: 1.5,
          label: 'Enterprise Deal (> $20k)',
        },
      ],
      updatedAt: '2026-09-04T00:00:00.000Z',
    },
    {
      id: 'r_deal_won',
      eventType: 'deal_won',
      entityType: 'Deal',
      category: 'deals',
      description: 'Awarded when an opportunity is successfully closed won',
      enabled: true,
      basePoints: 100,
      targetDimension: 'outcome',
      conditions: [],
      multipliers: [],
      updatedAt: '2026-09-04T00:00:00.000Z',
    },
  ];

  const validPolicy: PerformancePolicy = {
    id: 'ws1_active_policy',
    workspaceId: 'ws1',
    organizationId: 'org1',
    name: 'Standard Growth Policy v1',
    status: 'active',
    version: 1,
    effectiveFrom: '2026-09-01T00:00:00.000Z',
    dimensions: {
      activityWeight: 0.3,
      effortWeight: 0.25,
      qualityWeight: 0.15,
      effectivenessWeight: 0.15,
      outcomeWeight: 0.15,
    },
    antiGaming: {
      tieredDailyCaps: [
        {
          eventType: 'phone_call_completed',
          tier1Limit: 40,
          tier1Rate: 1.0,
          tier2Limit: 70,
          tier2Rate: 0.5,
          tier3Rate: 0.0,
        },
      ],
      repetitionCooldownSeconds: 180,
      minCallDurationSeconds: 45,
      requireNotesForCompletion: true,
      excludeMachineEffort: true,
    },
    scoringRules: sampleScoringRules,
    leaderboardPolicy: {
      mode: 'organization',
      anonymizePeers: false,
      rankingMetric: 'compositeIndex',
      allowOptOut: false,
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    updatedBy: {
      userId: 'usr_admin',
      userName: 'RevOps Admin',
    },
  };

  describe('validatePolicyIntegrity', () => {
    it('approves a policy when dimension weights sum to exactly 1.0', () => {
      const result = validatePolicyIntegrity(validPolicy);
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('flags an error when dimension weights do not sum to 1.0', () => {
      const invalidPolicy: PerformancePolicy = {
        ...validPolicy,
        dimensions: {
          ...validPolicy.dimensions,
          activityWeight: 0.5, // sum = 1.2
        },
      };
      const result = validatePolicyIntegrity(invalidPolicy);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('must sum to exactly 1.0'))).toBe(true);
    });

    it('flags an error when anti-gaming tier limits are inverted', () => {
      const invalidPolicy: PerformancePolicy = {
        ...validPolicy,
        antiGaming: {
          ...validPolicy.antiGaming,
          tieredDailyCaps: [
            {
              eventType: 'phone_call_completed',
              tier1Limit: 80,
              tier1Rate: 1.0,
              tier2Limit: 50, // tier 2 < tier 1!
              tier2Rate: 0.5,
              tier3Rate: 0.0,
            },
          ],
        },
      };
      const result = validatePolicyIntegrity(invalidPolicy);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('must be less than Tier 2'))).toBe(true);
    });
  });

  describe('evaluateEventUnderPolicy', () => {
    it('excludes machine activity when excludeMachineEffort is enabled', () => {
      const result = evaluateEventUnderPolicy({
        event: {
          eventType: 'phone_call_completed',
          entityId: 'contact_1',
          actorId: 'system_bot',
          isMachine: true,
          occurredAt: '2026-09-04T12:00:00.000Z',
        },
        policy: validPolicy,
      });

      expect(result.pointsAwarded).toBe(0);
      expect(result.wasCapped).toBe(true);
      expect(result.antiGamingFlag).toContain('Machine / automation');
    });

    it('enforces minimum call duration hurdle', () => {
      const result = evaluateEventUnderPolicy({
        event: {
          eventType: 'phone_call_completed',
          entityId: 'contact_1',
          actorId: 'rep_1',
          durationSeconds: 30, // below 45s hurdle
          occurredAt: '2026-09-04T12:00:00.000Z',
        },
        policy: validPolicy,
      });

      expect(result.pointsAwarded).toBe(0);
      expect(result.wasCapped).toBe(true);
      expect(result.antiGamingFlag).toContain('below minimum threshold');
    });

    it('enforces rapid repetition cooldown between calls on same entity', () => {
      const result = evaluateEventUnderPolicy({
        event: {
          eventType: 'phone_call_completed',
          entityId: 'contact_1',
          actorId: 'rep_1',
          durationSeconds: 90,
          occurredAt: '2026-09-04T12:02:00.000Z',
        },
        policy: validPolicy,
        lastEventTimeForSameEntity: '2026-09-04T12:01:00.000Z', // 60s ago, cooldown is 180s
      });

      expect(result.pointsAwarded).toBe(0);
      expect(result.wasCapped).toBe(true);
      expect(result.antiGamingFlag).toContain('cooldown');
    });

    it('awards base points when condition is met and applies multiplier for enterprise deal', () => {
      const result = evaluateEventUnderPolicy({
        event: {
          eventType: 'phone_call_completed',
          entityId: 'contact_1',
          actorId: 'rep_1',
          durationSeconds: 120, // satisfies >= 60
          occurredAt: '2026-09-04T12:00:00.000Z',
          metadata: {
            dealValue: 25000, // satisfies > 20000 -> 1.5x multiplier
          },
        },
        policy: validPolicy,
      });

      expect(result.pointsAwarded).toBe(15); // 10 * 1.5 = 15
      expect(result.multiplierApplied).toBe(1.5);
      expect(result.targetDimension).toBe('effort');
      expect(result.wasCapped).toBe(false);
    });

    it('applies tiered daily cap discount rate when rep exceeds Tier 1 limit', () => {
      const result = evaluateEventUnderPolicy({
        event: {
          eventType: 'phone_call_completed',
          entityId: 'contact_new',
          actorId: 'rep_1',
          durationSeconds: 90,
          occurredAt: '2026-09-04T12:00:00.000Z',
        },
        policy: validPolicy,
        dailyEventCountForActor: 50, // exceeds Tier 1 limit of 40 (50% discount rate)
      });

      expect(result.pointsAwarded).toBe(5); // 10 * 0.5 = 5
      expect(result.wasCapped).toBe(true);
      expect(result.antiGamingFlag).toContain('exceeded Tier 1 limit');
    });
  });

  describe('simulatePolicyImpact', () => {
    it('projects score deltas and rank changes across reps based on dimension shifts', () => {
      const proposedPolicy: PerformancePolicy = {
        ...validPolicy,
        name: 'Outcome-Biased Policy v2',
        version: 2,
        dimensions: {
          activityWeight: 0.15, // reduced from 0.30
          effortWeight: 0.20,   // reduced from 0.25
          qualityWeight: 0.15,
          effectivenessWeight: 0.15,
          outcomeWeight: 0.35,  // increased from 0.15 to 0.35!
        },
      };

      const mockDaily: SalesPerformanceDaily[] = [
        {
          id: 'ws1_rep_high_closer_2026-09-01',
          organizationId: 'org1',
          workspaceId: 'ws1',
          userId: 'rep_closer',
          date: '2026-09-01',
          activityCount: 20,
          points: 150,
          calls: 10,
          meetings: 5,
          tasks: 5,
          deals: 3,
          emails: 5,
          campaigns: 0,
          effortScore: 70,
          qualityScore: 80,
          effectivenessScore: 85,
          outcomeScore: 95, // Outstanding closer
          pipelineCreatedValue: 50000,
          dealsWonCount: 2,
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
        {
          id: 'ws1_rep_high_volume_2026-09-01',
          organizationId: 'org1',
          workspaceId: 'ws1',
          userId: 'rep_volume',
          date: '2026-09-01',
          activityCount: 90, // High volume caller
          points: 300,
          calls: 60,
          meetings: 2,
          tasks: 25,
          deals: 0,
          emails: 10,
          campaigns: 0,
          effortScore: 95,
          qualityScore: 65,
          effectivenessScore: 60,
          outcomeScore: 40, // Low closing outcome
          pipelineCreatedValue: 5000,
          dealsWonCount: 0,
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      ];

      const simulation = simulatePolicyImpact({
        currentPolicy: validPolicy,
        proposedPolicy,
        repsDaily: mockDaily,
        sampleEvents: [],
      });

      expect(simulation.repsCount).toBe(2);
      expect(simulation.distribution.current.median).toBeGreaterThan(0);
      expect(simulation.distribution.projected.median).toBeGreaterThan(0);

      // The closer should gain points from increased outcome weight
      const closer = simulation.reps.find((r) => r.userId === 'rep_closer');
      expect(closer).toBeDefined();
      expect(closer?.scoreDelta).toBeGreaterThan(0);

      // The volume caller should drop from decreased activity/effort weights
      const volumeRep = simulation.reps.find((r) => r.userId === 'rep_volume');
      expect(volumeRep).toBeDefined();
      expect(volumeRep?.scoreDelta).toBeLessThan(0);
    });
  });

  describe('generatePolicyChangeDiff', () => {
    it('produces structured human-readable diff', () => {
      const updatedPolicy: PerformancePolicy = {
        ...validPolicy,
        dimensions: {
          activityWeight: 0.25,
          effortWeight: 0.25,
          qualityWeight: 0.2,
          effectivenessWeight: 0.15,
          outcomeWeight: 0.15,
        },
        leaderboardPolicy: {
          ...validPolicy.leaderboardPolicy,
          anonymizePeers: true,
        },
      };

      const diff = generatePolicyChangeDiff(validPolicy, updatedPolicy);
      expect(diff.dimensionChanges.length).toBeGreaterThan(0);
      expect(diff.dimensionChanges.some((d) => d.dimension === 'Activity')).toBe(true);
      expect(diff.leaderboardChanges.some((l) => l.includes('peer anonymization'))).toBe(true);
    });

    it('detects removed scoring rules in diff', () => {
      const removedRulePolicy: PerformancePolicy = {
        ...validPolicy,
        scoringRules: validPolicy.scoringRules.filter((r) => r.eventType !== 'phone_call_completed'),
      };

      const diff = generatePolicyChangeDiff(validPolicy, removedRulePolicy);
      expect(diff.ruleChanges.some((r) => r.changeType === 'removed' && r.eventType === 'phone_call_completed')).toBe(true);
    });

    it('resolves common event aliases like call_completed to phone_call_completed', () => {
      const evalRes = evaluateEventUnderPolicy({
        event: {
          eventType: 'call_completed',
          entityId: 'c1',
          actorId: 'u1',
          durationSeconds: 120,
          occurredAt: '2026-09-04T12:00:00.000Z',
        },
        policy: validPolicy,
      });

      expect(evalRes.pointsAwarded).toBe(10);
      expect(evalRes.targetDimension).toBe('effort');
    });
  });
});
