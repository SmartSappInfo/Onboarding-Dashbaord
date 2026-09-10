/**
 * @fileoverview Idempotent FER (Fetch-Enrich-Restore) Migration & Seeding Protocol for Phase 10.
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 10 / PRD Section 123:
 * - Seeds default executive scenarios (Baseline, Bull Case, Conservative Stress Test)
 * - Seeds workspace revenue OS governance defaults
 * - Seeds high-impact AI strategic recommendations
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Idempotent execution using Firestore batch.set(..., { merge: true }).
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 *
 * @testability Idempotent database operations.
 */

import { adminDb } from '@/lib/firebase-admin';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import type {
  RevenueScenario,
  RevenueOsGovernance,
  AiStrategicRecommendation,
} from './types';

export async function seedRevenueOsWorkspace(
  workspaceId: string,
  organizationId: string
): Promise<{ success: boolean; seededScenarios: number; seededRecommendations: number; error?: string }> {
  try {
    const now = new Date().toISOString();
    const batch = adminDb.batch();

    // 1. Seed Revenue OS Governance Policy
    const govRef = adminDb.collection('revenueOsGovernance').doc(workspaceId);
    const govData: RevenueOsGovernance = {
      workspaceId,
      organizationId,
      maxWinRateModifierPercent: 20,
      maxDealSizeModifierPercent: 30,
      targetQuotaCoverageRatio: 3.5,
      rampModel: 'standard_3month',
      executiveAiModel: 'googleai/gemini-1.5-pro',
      updatedAt: now,
      updatedBy: 'system_migration',
    };
    batch.set(govRef, govData, { merge: true });

    // 2. Seed Baseline Executive Scenarios
    const scenarios: RevenueScenario[] = [
      {
        id: `scenario_${workspaceId}_baseline`,
        workspaceId,
        organizationId,
        name: 'Q4 2026 Executive Baseline',
        description: 'Standard operational run-rate reflecting current team headcount, historical win rate, and sales cycle.',
        isBaseline: true,
        parameters: {
          winRateModifierPercent: 0,
          dealSizeModifierPercent: 0,
          slippageModifierPercent: 0,
          cycleTimeModifierPercent: 0,
          headcountDelta: 0,
          sdrToAeRatio: 1.5,
        },
        simulatedQuarterlyRevenue: 1850000,
        deltaVsTargetDollars: -150000,
        deltaVsTargetPercent: -8,
        confidenceLowerBound: 1628000,
        confidenceUpperBound: 2072000,
        sensitivityFactors: {
          winRateElasticity: 1.35,
          dealSizeElasticity: 1.0,
          headcountElasticity: 0.65,
        },
        createdBy: 'Executive Board',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `scenario_${workspaceId}_bull`,
        workspaceId,
        organizationId,
        name: 'High-Velocity Enterprise Expansion (Bull Case)',
        description: 'Simulates +4% win rate uplift via Phase 5 coaching drills, +10% deal size via multi-threading, and 2 AE hires.',
        isBaseline: false,
        parameters: {
          winRateModifierPercent: 4,
          dealSizeModifierPercent: 10,
          slippageModifierPercent: -5,
          cycleTimeModifierPercent: -8,
          headcountDelta: 2,
          sdrToAeRatio: 1.5,
        },
        simulatedQuarterlyRevenue: 2280000,
        deltaVsTargetDollars: 280000,
        deltaVsTargetPercent: 14,
        confidenceLowerBound: 2006400,
        confidenceUpperBound: 2553600,
        sensitivityFactors: {
          winRateElasticity: 1.35,
          dealSizeElasticity: 1.0,
          headcountElasticity: 0.65,
        },
        createdBy: 'VP of Sales',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `scenario_${workspaceId}_conservative`,
        workspaceId,
        organizationId,
        name: 'Macro Headwind & Slippage Stress Test',
        description: 'Models a 15% increase in pipeline slippage and 3% win rate contraction due to tightening budget cycles.',
        isBaseline: false,
        parameters: {
          winRateModifierPercent: -3,
          dealSizeModifierPercent: -5,
          slippageModifierPercent: 15,
          cycleTimeModifierPercent: 12,
          headcountDelta: 0,
          sdrToAeRatio: 1.5,
        },
        simulatedQuarterlyRevenue: 1540000,
        deltaVsTargetDollars: -460000,
        deltaVsTargetPercent: -23,
        confidenceLowerBound: 1355200,
        confidenceUpperBound: 1724800,
        sensitivityFactors: {
          winRateElasticity: 1.35,
          dealSizeElasticity: 1.0,
          headcountElasticity: 0.65,
        },
        createdBy: 'CFO / Finance',
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const scenario of scenarios) {
      const scenRef = adminDb.collection('revenueScenarios').doc(scenario.id);
      batch.set(scenRef, scenario, { merge: true });
    }

    // 3. Seed AI Strategic Recommendations
    const strategicRecs: AiStrategicRecommendation[] = [
      {
        id: `strat_rec_${workspaceId}_capacity`,
        workspaceId,
        organizationId,
        category: 'capacity',
        title: 'Reallocate 2 SDRs to High-Velocity Mid-Market',
        description: 'Enterprise pipeline is currently single-threaded while Mid-Market conversion velocity is 2.4x higher.',
        rationale: 'Shifting 2 inbound SDRs increases Mid-Market SQO creation by ~18 deals, generating an estimated $145,000 in incremental quarterly attainment.',
        projectedRevenueImpactDollars: 145000,
        confidenceScore: 89,
        priority: 'high',
        status: 'active',
        createdAt: now,
      },
      {
        id: `strat_rec_${workspaceId}_escalation`,
        workspaceId,
        organizationId,
        category: 'escalation',
        title: 'Mandate Executive Sponsorship on 3 Stalled Enterprise Deals',
        description: 'Three key opportunities totaling $320,000 have had zero interaction in >16 days with champion turnover risks.',
        rationale: 'Deploying C-suite peer-to-peer outreach via Phase 8 Sales Plays historical saves 62% of stalled enterprise proposals.',
        projectedRevenueImpactDollars: 198000,
        confidenceScore: 93,
        priority: 'critical',
        status: 'active',
        createdAt: now,
      },
      {
        id: `strat_rec_${workspaceId}_enablement`,
        workspaceId,
        organizationId,
        category: 'enablement',
        title: 'Initiate Objection Handling Drills for Ramping Cohort',
        description: 'Ramping reps exhibit a 22% lower win rate on the "Budget Scrutiny" objection in Phase 5 call reviews.',
        rationale: 'Completing the 3-turn interactive practice drill elevates objection recovery rate from 34% to 58%, protecting $85,000 in pipeline.',
        projectedRevenueImpactDollars: 85000,
        confidenceScore: 84,
        priority: 'medium',
        status: 'active',
        createdAt: now,
      },
    ];

    for (const rec of strategicRecs) {
      const recRef = adminDb.collection('aiStrategicRecommendations').doc(rec.id);
      batch.set(recRef, rec, { merge: true });
    }

    await batch.commit();

    return {
      success: true,
      seededScenarios: scenarios.length,
      seededRecommendations: strategicRecs.length,
    };
  } catch (error) {
    console.error('seedRevenueOsWorkspace error:', error);
    return {
      success: false,
      seededScenarios: 0,
      seededRecommendations: 0,
      error: toClientErrorMessage('revenue-os.migration-protocol', error, undefined, 'Failed to seed Revenue OS'),
    };
  }
}
