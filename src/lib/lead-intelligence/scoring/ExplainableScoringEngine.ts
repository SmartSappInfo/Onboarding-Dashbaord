/**
 * Pure Deterministic Explainable Scoring Engine (Lead Intelligence 2.0 - Phase 8)
 * UI Spec Sections 34-36, PRD Section 4.4, Idea Doc Sections 19 & 44
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. "The score must never be a black box" (UI Spec Section 34).
 * 2. 6 Transparent point dimensions with exact point contributions summing to overall score.
 * 3. Pure deterministic arithmetic with zero division protection and no database side-effects.
 * 4. Harmonic multi-dimensional non-linear priority computation (Fit x Need x Intent x Engagement).
 * 5. Strict Zero-`any` typing.
 */

import type { 
  Prospect, 
  LeadSignal, 
  ScoringDimensionWeightConfig, 
  ExplainableScoreBreakdown, 
  ScoreMovementEvent, 
  ScoringSimulationResult 
} from '../types';
import { TechnographicsCategorizer } from '../scraper/TechnographicsCategorizer';

export class ExplainableScoringEngine {
  /**
   * Returns standard default baseline dimension weights summing to 100%.
   */
  public static getDefaultWeights(): ScoringDimensionWeightConfig {
    return {
      icpFitWeight: 30,
      intentWeight: 25,
      needWeight: 20,
      engagementWeight: 15,
      similarityWeight: 10
    };
  }

  /**
   * Normalizes weights so that their integer percentages sum to exactly 100%.
   * When one weight slider is adjusted, the delta is distributed proportionally across the other sliders.
   */
  public static normalizeWeights(
    weights: ScoringDimensionWeightConfig,
    modifiedKey: keyof ScoringDimensionWeightConfig,
    targetValue: number
  ): ScoringDimensionWeightConfig {
    const clampedTarget = Math.max(5, Math.min(70, Math.round(targetValue)));
    const keys: (keyof ScoringDimensionWeightConfig)[] = [
      'icpFitWeight',
      'intentWeight',
      'needWeight',
      'engagementWeight',
      'similarityWeight'
    ];

    const otherKeys = keys.filter(k => k !== modifiedKey);
    const otherCurrentSum = otherKeys.reduce((sum, k) => sum + weights[k], 0);
    const remainingToDistribute = 100 - clampedTarget;

    const result: ScoringDimensionWeightConfig = { ...weights, [modifiedKey]: clampedTarget };

    if (otherCurrentSum <= 0) {
      const evenShare = Math.floor(remainingToDistribute / otherKeys.length);
      otherKeys.forEach((k, idx) => {
        result[k] = idx === 0 ? remainingToDistribute - (evenShare * (otherKeys.length - 1)) : evenShare;
      });
      return result;
    }

    let distributedSum = 0;
    otherKeys.forEach((k, idx) => {
      if (idx === otherKeys.length - 1) {
        // Last key gets the exact remainder to prevent rounding drift
        result[k] = Math.max(5, remainingToDistribute - distributedSum);
      } else {
        const ratio = weights[k] / otherCurrentSum;
        const allocated = Math.max(5, Math.round(ratio * remainingToDistribute));
        result[k] = allocated;
        distributedSum += allocated;
      }
    });

    return result;
  }

  /**
   * Computes the 6-dimension explainable score breakdown and point contributions for a prospect.
   */
  public static calculateExplainableScore(
    prospect: Prospect,
    signals: LeadSignal[] = [],
    weights: ScoringDimensionWeightConfig = this.getDefaultWeights()
  ): ExplainableScoreBreakdown {
    const now = new Date().toISOString();
    const positiveDrivers: string[] = [];
    const negativeDrivers: string[] = [];

    // 1. ICP FIT (0 - 100)
    let icpRaw = 0;
    if (prospect.name && prospect.domain) {
      icpRaw += 25;
      positiveDrivers.push('Established institution with verifiable digital domain');
    }
    if (prospect.rating && prospect.rating >= 4.0) {
      icpRaw += 25;
      positiveDrivers.push(`High reputation rating (${prospect.rating.toFixed(1)} ★)`);
    } else if (prospect.rating && prospect.rating < 3.0) {
      negativeDrivers.push(`Lower online reputation rating (${prospect.rating.toFixed(1)} ★)`);
    }

    if (prospect.reviewsCount && prospect.reviewsCount >= 5) {
      icpRaw += 20;
    }
    if (prospect.address) {
      icpRaw += 15;
    }
    if (prospect.phone) {
      icpRaw += 15;
    }
    const icpFitScore = Math.min(100, icpRaw);
    const icpFitPoints = Math.round((icpFitScore / 100) * weights.icpFitWeight);

    // 2. NEED SCORE (0 - 100)
    const techStack = TechnographicsCategorizer.categorize(prospect.websiteScan?.technologies || []);
    let needRaw = 0;
    if (techStack.paymentGapDetected) {
      needRaw += 40;
      positiveDrivers.push('High-Value Payment Gap: Fee/admissions portal lacks online checkout');
    }
    if (techStack.missingPortalDetected) {
      needRaw += 25;
      positiveDrivers.push('Missing Digital Portal: Institution lacks student/parent portal');
    }
    if (prospect.websiteScan?.sslValid === false) {
      needRaw += 20;
      positiveDrivers.push('Compliance Vulnerability: Expired or missing HTTPS certificate');
    }
    if (techStack.cms.some(c => c.toLowerCase().includes('wix') || c.toLowerCase().includes('weebly'))) {
      needRaw += 15;
      positiveDrivers.push('Legacy Website Infrastructure: Hosted on basic website builder');
    }
    const needScore = Math.min(100, Math.max(15, needRaw));
    const needPoints = Math.round((needScore / 100) * weights.needWeight);

    // 3. INTENT SCORE (0 - 100)
    let intentRaw = 20; // baseline
    const unreadSignals = signals.filter(s => !s.isDismissed);
    for (const sig of unreadSignals) {
      if (sig.strength === 'critical') intentRaw += 30;
      else if (sig.strength === 'high') intentRaw += 20;
      else if (sig.strength === 'medium') intentRaw += 10;
    }
    if (unreadSignals.length > 0) {
      positiveDrivers.push(`Active Buying Signals: ${unreadSignals.length} recent intent delta(s) observed`);
    } else {
      negativeDrivers.push('No recent buying signals or infrastructure changes detected');
    }
    const intentScore = Math.min(100, intentRaw);
    const intentPoints = Math.round((intentScore / 100) * weights.intentWeight);

    // 4. ENGAGEMENT SCORE (0 - 100)
    let engagementRaw = 10;
    const verifiedContacts = prospect.contacts.filter(c => c.verificationStatus === 'verified');
    if (verifiedContacts.length > 0) {
      engagementRaw += Math.min(60, verifiedContacts.length * 30);
      positiveDrivers.push(`Key Decision Maker Identified: ${verifiedContacts[0].name} (${verifiedContacts[0].role || 'Executive'})`);
    } else {
      negativeDrivers.push('No verified decision maker contacts found yet');
    }

    if (prospect.contacts.some(c => (c.deliverabilityScore ?? 0) >= 80)) {
      engagementRaw += 30;
    }
    const engagementScore = Math.min(100, engagementRaw);
    const engagementPoints = Math.round((engagementScore / 100) * weights.engagementWeight);

    // 5. CUSTOMER SIMILARITY (0 - 100)
    let similarityRaw = 30;
    if (prospect.industry && prospect.industry.toLowerCase().includes('school')) {
      similarityRaw += 40;
      positiveDrivers.push('Core ICP Match: Private Educational Institution profile');
    }
    if (prospect.websiteScan?.hasFacebook || prospect.websiteScan?.hasInstagram) {
      similarityRaw += 30;
    }
    const similarityScore = Math.min(100, similarityRaw);
    const similarityPoints = Math.round((similarityScore / 100) * weights.similarityWeight);

    // 6. RECENCY POINTS (Bonus 0 - 6)
    let recencyPoints = 2;
    if (prospect.updatedAt) {
      const diffDays = Math.floor((Date.now() - new Date(prospect.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) recencyPoints = 6;
      else if (diffDays <= 14) recencyPoints = 4;
      else if (diffDays <= 30) recencyPoints = 2;
      else recencyPoints = 0;
    }

    // OVERALL SCORE SUM (0 - 100)
    const overallScore = Math.min(100, Math.max(0, 
      icpFitPoints + needPoints + intentPoints + engagementPoints + similarityPoints + recencyPoints
    ));

    // NON-LINEAR HARMONIC MULTIPLIER PRIORITY (UI Spec Section 34 / Idea Doc §19)
    // Fit x Need x Intent x Engagement
    const harmonicPriority = Math.round(
      100 * Math.pow(
        Math.max(0.1, icpFitScore / 100) *
        Math.max(0.1, needScore / 100) *
        Math.max(0.1, intentScore / 100) *
        Math.max(0.1, engagementScore / 100),
        0.25
      )
    );

    // PRIORITY TIER
    let priorityTier: 'critical' | 'high' | 'medium' | 'low' = 'low';
    if (overallScore >= 80 || (intentScore >= 80 && icpFitScore >= 75)) {
      priorityTier = 'critical';
    } else if (overallScore >= 65) {
      priorityTier = 'high';
    } else if (overallScore >= 45) {
      priorityTier = 'medium';
    }

    return {
      overallScore,
      priorityTier,
      icpFitPoints,
      needPoints,
      intentPoints,
      engagementPoints,
      similarityPoints,
      recencyPoints,
      topPositiveDrivers: positiveDrivers.slice(0, 3),
      topNegativeDrivers: negativeDrivers.slice(0, 2),
      harmonicPriority,
      calculatedAt: now
    };
  }

  /**
   * Synthesizes historical score inflection events for the score timeline chart.
   */
  public static calculateScoreTimeline(
    prospect: Prospect,
    signals: LeadSignal[] = [],
    scoreHistory: ScoreMovementEvent[] = []
  ): ScoreMovementEvent[] {
    if (scoreHistory.length > 0) {
      return [...scoreHistory].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    const events: ScoreMovementEvent[] = [];
    const baseCreatedAt = prospect.createdAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Event 1: Initial Discovery
    events.push({
      id: `ev_disc_${prospect.id}`,
      prospectId: prospect.id,
      workspaceId: prospect.workspaceId,
      timestamp: baseCreatedAt,
      oldScore: 0,
      newScore: 50,
      change: 50,
      category: 'firmographic',
      reason: `Initial profile discovery & firmographics mapped from ${prospect.source || 'Places API'}`
    });

    // Event 2: Technographic Enrichment
    let runningScore = 50;
    if (prospect.websiteScan?.scannedAt) {
      const techPoints = prospect.websiteScan.technologies.length > 0 ? 15 : 5;
      const prevScore = runningScore;
      runningScore += techPoints;
      events.push({
        id: `ev_tech_${prospect.id}`,
        prospectId: prospect.id,
        workspaceId: prospect.workspaceId,
        timestamp: prospect.websiteScan.scannedAt,
        oldScore: prevScore,
        newScore: runningScore,
        change: techPoints,
        category: 'technographic',
        reason: `DOM Technographic Audit identified ${prospect.websiteScan.technologies.length} infrastructure signature(s)`
      });
    }

    // Event 3: Signals Inflection Points
    for (const sig of signals) {
      const prevScore = runningScore;
      runningScore = Math.min(100, Math.max(0, runningScore + sig.scoreImpact));
      events.push({
        id: `ev_sig_${sig.id}`,
        prospectId: prospect.id,
        workspaceId: prospect.workspaceId,
        timestamp: sig.detectedAt,
        oldScore: prevScore,
        newScore: runningScore,
        change: sig.scoreImpact,
        category: sig.category,
        reason: sig.headline,
        sourceSignalId: sig.id
      });
    }

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Simulates weight adjustments live against historical prospects without mutating records.
   */
  public static simulateWeightChanges(
    prospects: Prospect[],
    currentWeights: ScoringDimensionWeightConfig = this.getDefaultWeights(),
    candidateWeights: ScoringDimensionWeightConfig
  ): ScoringSimulationResult[] {
    return prospects.map((p) => {
      const baselineBreakdown = this.calculateExplainableScore(p, [], currentWeights);
      const simulatedBreakdown = this.calculateExplainableScore(p, [], candidateWeights);

      return {
        prospectId: p.id,
        prospectName: p.name,
        domain: p.domain,
        baselineScore: baselineBreakdown.overallScore,
        simulatedScore: simulatedBreakdown.overallScore,
        deltaScore: simulatedBreakdown.overallScore - baselineBreakdown.overallScore,
        baselineTier: baselineBreakdown.priorityTier,
        simulatedTier: simulatedBreakdown.priorityTier,
        breakdown: simulatedBreakdown
      };
    });
  }
}
