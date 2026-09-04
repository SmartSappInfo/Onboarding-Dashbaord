/**
 * @fileoverview Unit tests for Sales Performance & Intelligence 2.0 Performance Engine.
 *
 * ARCHITECTURAL POINTER:
 * Validates deterministic multi-dimension calculations:
 * - Performance Index (0-100) weighting and bounds.
 * - Target Attainment % and daily required pacing velocity.
 * - Explainable "Why?" driver identification and AI recommendations.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePerformanceIndex,
  calculateTargetAttainment,
  generateWhyExplanation,
  DEFAULT_PERFORMANCE_POLICY,
} from '../performance-engine';
import type { PerformanceScorecard, SalesTarget } from '../types';

describe('Sales Performance Engine', () => {
  describe('calculatePerformanceIndex', () => {
    it('calculates balanced composite score based on default weights', () => {
      // weights: activity=0.30, effort=0.25, quality=0.15, effectiveness=0.15, outcome=0.15
      const scorecard = calculatePerformanceIndex(
        {
          activityScore: 80,
          effortScore: 90,
          qualityScore: 70,
          effectivenessScore: 60,
          outcomeScore: 50,
        },
        DEFAULT_PERFORMANCE_POLICY
      );

      // Expected: 80*0.3 + 90*0.25 + 70*0.15 + 60*0.15 + 50*0.15
      // = 24 + 22.5 + 10.5 + 9 + 7.5 = 73.5 -> Math.round = 74
      expect(scorecard.compositeIndex).toBe(74);
      expect(scorecard.activityScore).toBe(80);
      expect(scorecard.effortScore).toBe(90);
    });

    it('clamps composite scores within [0, 100]', () => {
      const high = calculatePerformanceIndex({
        activityScore: 150,
        effortScore: 120,
        qualityScore: 110,
        effectivenessScore: 100,
        outcomeScore: 100,
      });
      expect(high.compositeIndex).toBe(100);

      const low = calculatePerformanceIndex({
        activityScore: -20,
        effortScore: -10,
        qualityScore: 0,
        effectivenessScore: 0,
        outcomeScore: 0,
      });
      expect(low.compositeIndex).toBe(0);
    });
  });

  describe('calculateTargetAttainment', () => {
    it('calculates attainment percentage and daily required pace', () => {
      const now = new Date();
      const end = new Date(now);
      end.setDate(now.getDate() + 10); // 10 days remaining

      const target: Partial<SalesTarget> = {
        targetValue: 20,
        actualValue: 5,
        startDate: now.toISOString(),
        endDate: end.toISOString(),
      };

      const result = calculateTargetAttainment(target as SalesTarget);

      // 5 / 20 = 25%
      expect(result.attainmentPercent).toBe(25);
      // remaining: 15 / 10 days = 1.5/day
      expect(result.requiredDailyPace).toBe(1.5);
      expect(result.daysRemaining).toBe(10);
    });

    it('marks target as achieved when actual >= targetValue', () => {
      const target: Partial<SalesTarget> = {
        targetValue: 20,
        actualValue: 22,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 864000000).toISOString(),
      };

      const result = calculateTargetAttainment(target as SalesTarget);
      expect(result.paceStatus).toBe('achieved');
      expect(result.requiredDailyPace).toBe(0);
      expect(result.attainmentPercent).toBe(110);
    });
  });

  describe('generateWhyExplanation', () => {
    it('identifies top positive drivers and generates recommendations', () => {
      const scorecard: PerformanceScorecard = {
        compositeIndex: 82,
        activityScore: 85,
        effortScore: 90,
        qualityScore: 60,
        effectivenessScore: 75,
        outcomeScore: 80,
        dimensionWeights: {
          activity: 20,
          effort: 30,
          quality: 15,
          effectiveness: 15,
          outcome: 20,
        },
      };

      const explanation = generateWhyExplanation(scorecard);
      expect(explanation.compositeIndex).toBe(82);
      expect(explanation.drivers.length).toBeGreaterThan(0);
      expect(explanation.aiRecommendation).toBeDefined();
    });
  });
});
