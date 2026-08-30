import { describe, it, expect } from 'vitest';
import { ExplainableScoringEngine } from '../scoring/ExplainableScoringEngine';
import type { Prospect, LeadSignal, ScoringDimensionWeightConfig } from '../types';

describe('ExplainableScoringEngine (Phase 8 Unit Tests)', () => {
  const sampleProspect: Prospect = {
    id: 'pros_test_123',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    name: 'St. Andrews International Academy',
    domain: 'standrews.edu.gh',
    address: 'Airport Residential Area, Accra, Ghana',
    phone: '+233 24 123 4567',
    rating: 4.8,
    reviewsCount: 28,
    industry: 'Private K-12 School',
    websiteScan: {
      url: 'https://standrews.edu.gh',
      technologies: ['WordPress', 'PHP', 'Google Analytics'],
      hasFacebook: true,
      hasInstagram: true,
      hasLinkedIn: true,
      hasTwitter: false,
      sslValid: true,
      scannedAt: '2026-08-28T10:00:00Z'
    },
    contacts: [
      {
        name: 'Dr. Michael Bruce',
        email: 'mbruce@standrews.edu.gh',
        role: 'Headmaster',
        confidence: 95,
        verificationStatus: 'verified',
        deliverabilityScore: 98
      }
    ],
    scoring: {
      overallScore: 82,
      needScore: 16,
      digitalMaturity: 12,
      buyingIntent: 22,
      budgetProbability: 14,
      decisionMakerFound: 14,
      engagement: 14
    },
    syncStatus: 'unregistered',
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: new Date().toISOString()
  };

  it('should return default weights summing to exactly 100%', () => {
    const weights = ExplainableScoringEngine.getDefaultWeights();
    expect(weights.icpFitWeight).toBe(30);
    expect(weights.intentWeight).toBe(25);
    expect(weights.needWeight).toBe(20);
    expect(weights.engagementWeight).toBe(15);
    expect(weights.similarityWeight).toBe(10);

    const sum = weights.icpFitWeight + weights.intentWeight + weights.needWeight + weights.engagementWeight + weights.similarityWeight;
    expect(sum).toBe(100);
  });

  it('should proportionally normalize weights when a slider is adjusted to maintain 100% total', () => {
    const defaultWeights = ExplainableScoringEngine.getDefaultWeights();
    // Increase Intent from 25 to 45
    const adjusted = ExplainableScoringEngine.normalizeWeights(defaultWeights, 'intentWeight', 45);

    expect(adjusted.intentWeight).toBe(45);
    const sum = adjusted.icpFitWeight + adjusted.intentWeight + adjusted.needWeight + adjusted.engagementWeight + adjusted.similarityWeight;
    expect(sum).toBe(100);
  });

  it('should calculate 6-dimension explainable score breakdown with exact point contributions', () => {
    const breakdown = ExplainableScoringEngine.calculateExplainableScore(sampleProspect);

    expect(breakdown.overallScore).toBeGreaterThanOrEqual(60);
    expect(breakdown.priorityTier).toBe('high');
    expect(breakdown.icpFitPoints).toBeGreaterThan(0);
    expect(breakdown.needPoints).toBeGreaterThan(0);
    expect(breakdown.intentPoints).toBeGreaterThan(0);
    expect(breakdown.engagementPoints).toBeGreaterThan(0);
    expect(breakdown.similarityPoints).toBeGreaterThan(0);
    expect(breakdown.recencyPoints).toBeGreaterThanOrEqual(0);

    // Sum of points matches overallScore
    const totalPoints = breakdown.icpFitPoints + breakdown.needPoints + breakdown.intentPoints + 
      breakdown.engagementPoints + breakdown.similarityPoints + breakdown.recencyPoints;
    expect(breakdown.overallScore).toBe(Math.min(100, totalPoints));

    expect(breakdown.topPositiveDrivers.length).toBeGreaterThan(0);
    expect(breakdown.harmonicPriority).toBeGreaterThan(0);
  });

  it('should dynamically incorporate live intent signals into the Intent score vector', () => {
    const criticalSignal: LeadSignal = {
      id: 'sig_1',
      workspaceId: 'ws_test',
      prospectId: sampleProspect.id,
      prospectName: sampleProspect.name,
      prospectDomain: sampleProspect.domain,
      type: 'payment_gateway_removed',
      category: 'intent',
      title: 'Payment Gateway Removed',
      headline: 'Paystack gateway was removed from fees checkout',
      description: 'Critical payment gap detected',
      strength: 'critical',
      confidence: 95,
      scoreImpact: 25,
      potentialImplication: 'High manual overhead',
      recommendedAction: 'Pitch SmartSapp Automated Fee Collection',
      detectedAt: new Date().toISOString(),
      source: 'scraper',
      isRead: false
    };

    const withoutSignal = ExplainableScoringEngine.calculateExplainableScore(sampleProspect, []);
    const withSignal = ExplainableScoringEngine.calculateExplainableScore(sampleProspect, [criticalSignal]);

    expect(withSignal.intentPoints).toBeGreaterThan(withoutSignal.intentPoints);
    expect(withSignal.overallScore).toBeGreaterThanOrEqual(withoutSignal.overallScore);
  });

  it('should synthesize historical score inflection events with score transitions', () => {
    const signals: LeadSignal[] = [
      {
        id: 'sig_1',
        workspaceId: 'ws_test',
        prospectId: sampleProspect.id,
        prospectName: sampleProspect.name,
        prospectDomain: sampleProspect.domain,
        type: 'subdomain_portal_detected',
        category: 'technographic',
        title: 'Moodle Portal Detected',
        headline: 'moodle.standrews.edu.gh went live',
        description: 'New portal deployed',
        strength: 'high',
        confidence: 96,
        scoreImpact: 15,
        potentialImplication: 'Digital learning active',
        recommendedAction: 'Introduce SmartSapp SIS Sync',
        detectedAt: '2026-08-29T12:00:00Z',
        source: 'subdomain_prober'
      }
    ];

    const timeline = ExplainableScoringEngine.calculateScoreTimeline(sampleProspect, signals);
    expect(timeline.length).toBeGreaterThanOrEqual(3); // Discovery, Tech scan, Signal
    expect(timeline[0].category).toBe('firmographic');
    expect(timeline[0].newScore).toBe(50);
    expect(timeline[timeline.length - 1].change).toBe(15);
  });

  it('should execute What-If simulation matrix across prospects without mutating records', () => {
    const candidateWeights: ScoringDimensionWeightConfig = {
      icpFitWeight: 10,
      intentWeight: 50,
      needWeight: 20,
      engagementWeight: 10,
      similarityWeight: 10
    };

    const results = ExplainableScoringEngine.simulateWeightChanges(
      [sampleProspect],
      ExplainableScoringEngine.getDefaultWeights(),
      candidateWeights
    );

    expect(results.length).toBe(1);
    expect(results[0].prospectId).toBe(sampleProspect.id);
    expect(typeof results[0].baselineScore).toBe('number');
    expect(typeof results[0].simulatedScore).toBe('number');
    expect(typeof results[0].deltaScore).toBe('number');
    expect(results[0].deltaScore).toBe(results[0].simulatedScore - results[0].baselineScore);
  });

  it('should safely calculate scores for incomplete / sparse prospect records without NaN or crashing', () => {
    const sparseProspect: Prospect = {
      id: 'pros_sparse',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      name: '',
      domain: '',
      contacts: [],
      scoring: {
        overallScore: 0,
        needScore: 0,
        digitalMaturity: 0,
        buyingIntent: 0,
        budgetProbability: 0,
        decisionMakerFound: 0,
        engagement: 0
      },
      syncStatus: 'unregistered',
      createdAt: '',
      updatedAt: ''
    };

    const breakdown = ExplainableScoringEngine.calculateExplainableScore(sparseProspect);
    expect(isNaN(breakdown.overallScore)).toBe(false);
    expect(isNaN(breakdown.harmonicPriority)).toBe(false);
    expect(breakdown.overallScore).toBeGreaterThanOrEqual(0);
    expect(breakdown.priorityTier).toBe('low');
  });
});
