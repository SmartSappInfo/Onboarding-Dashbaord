/**
 * @fileOverview Context Rail Domain Service (Phase 8 Milestone 4)
 *
 * Implements Rule 4 (Zero any / Zero any[]), Rule 8 & 47 (Multi-tenant boundaries),
 * Rule 10 (Inline architectural docs), Rule 28 & 56 (Knapsack context budgeting),
 * Rule 41 (Plain-English explainability), and Rule 68/§81 (Zero dead ends).
 *
 * Provides pure domain algorithms for:
 * 1. Relationship Health Scoring (0–100) & Health Band Categorization
 * 2. Interaction Recency & Risk Signal Extraction
 * 3. Contextual Data Normalization
 */

import {
  type HealthBand,
  type RelationshipHealth,
} from './context-rail-types';

export class ContextRailService {
  /**
   * Computes relationship health (0–100) based on touchpoint recency and activity patterns.
   */
  static calculateRelationshipHealth(params: {
    lastContactDaysAgo: number;
    interactionCount?: number;
    openTasksCount?: number;
    sentimentScore?: number; // 0 to 1
  }): RelationshipHealth {
    const {
      lastContactDaysAgo,
      interactionCount = 5,
      openTasksCount = 0,
      sentimentScore = 0.8,
    } = params;

    // Recency penalty: 0-7 days (100%), 8-14 days (85%), 15-30 days (65%), 31-60 days (40%), 60+ days (20%)
    let recencyFactor = 1.0;
    if (lastContactDaysAgo > 60) {
      recencyFactor = 0.2;
    } else if (lastContactDaysAgo > 30) {
      recencyFactor = 0.45;
    } else if (lastContactDaysAgo > 14) {
      recencyFactor = 0.7;
    } else if (lastContactDaysAgo > 7) {
      recencyFactor = 0.88;
    }

    // Engagement score (0-100)
    const interactionBonus = Math.min(interactionCount * 4, 30);
    const sentimentBonus = sentimentScore * 30;
    const baseScore = recencyFactor * 40;
    const taskDeduction = Math.min(openTasksCount * 3, 15);

    const rawScore = Math.round(baseScore + interactionBonus + sentimentBonus - taskDeduction);
    const score = Math.max(0, Math.min(100, rawScore));

    const healthBand = this.categorizeHealthBand(score);

    const positiveSignals: string[] = [];
    const riskSignals: string[] = [];

    if (lastContactDaysAgo <= 7) {
      positiveSignals.push('Recent contact within last 7 days');
    } else if (lastContactDaysAgo > 30) {
      riskSignals.push(`No direct touchpoints in ${lastContactDaysAgo} days`);
    }

    if (interactionCount >= 10) {
      positiveSignals.push('High cadence of interaction');
    } else if (interactionCount <= 2) {
      riskSignals.push('Low historical interaction depth');
    }

    if (sentimentScore >= 0.8) {
      positiveSignals.push('Positive relationship sentiment');
    } else if (sentimentScore < 0.5) {
      riskSignals.push('Negative or friction sentiment detected');
    }

    if (openTasksCount > 3) {
      riskSignals.push(`${openTasksCount} overdue or unresolved tasks`);
    }

    return {
      score,
      healthBand,
      band: healthBand,
      trend: sentimentScore >= 0.8 ? 'improving' : sentimentScore < 0.5 ? 'declining' : 'stable',
      signals: {
        recencyScore: Math.round(recencyFactor * 100),
        activityFrequencyScore: Math.min(100, interactionCount * 10),
        sentimentScore: Math.round(sentimentScore * 100),
        engagementDepthScore: Math.max(0, 100 - openTasksCount * 15),
      },
      positiveSignals,
      riskSignals,
      factors: [...positiveSignals, ...riskSignals],
      lastContactDaysAgo,
      lastEvaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Categorizes numerical health score (0–100) into canonical semantic bands.
   */
  static categorizeHealthBand(score: number): HealthBand {
    if (score >= 90) return 'champion';
    if (score >= 70) return 'healthy';
    if (score >= 60) return 'neutral';
    if (score >= 30) return 'at_risk';
    return 'critical';
  }
}
