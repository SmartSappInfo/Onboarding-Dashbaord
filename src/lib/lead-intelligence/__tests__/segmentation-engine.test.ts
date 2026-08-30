import { describe, it, expect } from 'vitest';
import { SegmentPredicateEvaluator } from '../segmentation/SegmentPredicateEvaluator';
import { ProspectingCampaignEngine } from '../campaigns/ProspectingCampaignEngine';
import type { Prospect, SegmentRule, SegmentRuleGroup, ProspectingCampaign } from '../types';

describe('SegmentPredicateEvaluator & Campaign Engine (Phase 10 Unit Tests)', () => {
  const sampleProspects: Prospect[] = [
    {
      id: 'p_1',
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      name: 'St. Andrews International Academy',
      domain: 'standrews.edu.gh',
      address: 'Airport Residential Area, Accra, Ghana',
      industry: 'Private K-12 School',
      rating: 4.8,
      reviewsCount: 30,
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
        overallScore: 88,
        needScore: 18,
        digitalMaturity: 14,
        buyingIntent: 22,
        budgetProbability: 14,
        decisionMakerFound: 15,
        engagement: 14
      },
      activeSignalsCount: 2,
      syncStatus: 'unregistered',
      createdAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-29T12:00:00Z'
    },
    {
      id: 'p_2',
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      name: 'Kumasi Ridge Academy',
      domain: 'kumasiridge.com',
      address: 'Ahodwo, Kumasi, Ghana',
      industry: 'Private Secondary School',
      rating: 4.2,
      reviewsCount: 15,
      websiteScan: {
        url: 'https://kumasiridge.com',
        technologies: ['Wix', 'Paystack'],
        hasFacebook: true,
        hasInstagram: false,
        hasLinkedIn: false,
        hasTwitter: false,
        sslValid: true,
        scannedAt: '2026-08-28T10:00:00Z'
      },
      contacts: [],
      scoring: {
        overallScore: 55,
        needScore: 10,
        digitalMaturity: 8,
        buyingIntent: 8,
        budgetProbability: 10,
        decisionMakerFound: 0,
        engagement: 10
      },
      activeSignalsCount: 0,
      syncStatus: 'synced',
      syncedEntityId: 'ent_kumasiridge',
      createdAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-29T12:00:00Z'
    }
  ];

  it('should evaluate numeric greater_than rules correctly', () => {
    const rule: SegmentRule = {
      id: 'r_score',
      field: 'overallScore',
      operator: 'greater_than',
      value: 70
    };

    expect(SegmentPredicateEvaluator.evaluateRule(sampleProspects[0], rule)).toBe(true);
    expect(SegmentPredicateEvaluator.evaluateRule(sampleProspects[1], rule)).toBe(false);
  });

  it('should evaluate technologies array contains and not_contains operators', () => {
    const ruleContainsPaystack: SegmentRule = {
      id: 'r_tech_1',
      field: 'technologies',
      operator: 'contains',
      value: 'Paystack'
    };

    const ruleNotContainsPaystack: SegmentRule = {
      id: 'r_tech_2',
      field: 'technologies',
      operator: 'not_contains',
      value: 'Paystack'
    };

    expect(SegmentPredicateEvaluator.evaluateRule(sampleProspects[0], ruleContainsPaystack)).toBe(false);
    expect(SegmentPredicateEvaluator.evaluateRule(sampleProspects[1], ruleContainsPaystack)).toBe(true);

    expect(SegmentPredicateEvaluator.evaluateRule(sampleProspects[0], ruleNotContainsPaystack)).toBe(true);
    expect(SegmentPredicateEvaluator.evaluateRule(sampleProspects[1], ruleNotContainsPaystack)).toBe(false);
  });

  it('should evaluate boolean is_true operator for verified decision makers', () => {
    const ruleVerified: SegmentRule = {
      id: 'r_ver',
      field: 'hasVerifiedContact',
      operator: 'is_true',
      value: true
    };

    expect(SegmentPredicateEvaluator.evaluateRule(sampleProspects[0], ruleVerified)).toBe(true);
    expect(SegmentPredicateEvaluator.evaluateRule(sampleProspects[1], ruleVerified)).toBe(false);
  });

  it('should evaluate complex AND rule groups', () => {
    const group: SegmentRuleGroup = {
      id: 'grp_and',
      combinator: 'AND',
      rules: [
        {
          id: 'r_1',
          field: 'overallScore',
          operator: 'greater_than',
          value: 75
        },
        {
          id: 'r_2',
          field: 'crmStatus',
          operator: 'not_equals',
          value: 'synced'
        },
        {
          id: 'r_3',
          field: 'hasVerifiedContact',
          operator: 'is_true',
          value: true
        }
      ]
    };

    const matches = SegmentPredicateEvaluator.filterProspectsBySegment(sampleProspects, group);
    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe('p_1');
  });

  it('should evaluate complex OR rule groups', () => {
    const group: SegmentRuleGroup = {
      id: 'grp_or',
      combinator: 'OR',
      rules: [
        {
          id: 'r_1',
          field: 'overallScore',
          operator: 'less_than',
          value: 60
        },
        {
          id: 'r_2',
          field: 'technologies',
          operator: 'contains',
          value: 'WordPress'
        }
      ]
    };

    const matches = SegmentPredicateEvaluator.filterProspectsBySegment(sampleProspects, group);
    expect(matches.length).toBe(2); // p_1 matches WordPress, p_2 matches score < 60
  });

  it('should generate default RevOps segment templates for workspace', () => {
    const templates = SegmentPredicateEvaluator.getDefaultSegmentTemplates('ws_123', 'org_123');
    expect(templates.length).toBeGreaterThanOrEqual(3);
    expect(templates[0].isTemplate).toBe(true);
    expect(templates[0].ruleGroup.rules.length).toBeGreaterThan(0);
  });

  it('should calculate campaign funnel statistics accurately', () => {
    const campaign: ProspectingCampaign = {
      id: 'camp_test',
      workspaceId: 'ws_test',
      organizationId: 'org_test',
      name: 'Q4 Test Campaign',
      status: 'draft',
      targetCriteria: { sourceType: 'all_discovered' },
      enrichmentOptions: {
        runWebScan: true,
        extractDecisionMakers: true,
        verifyEmails: true,
        generateAIDossier: true
      },
      qualificationThreshold: 75,
      assignment: { type: 'round_robin', repIds: ['rep_1', 'rep_2'] },
      activation: {
        createDeals: true,
        enrollInCadence: true,
        channel: 'email'
      },
      stats: {
        totalProspects: 0,
        enrichedCount: 0,
        verifiedCount: 0,
        qualifiedCount: 0,
        dealsCreated: 0,
        outreachSent: 0
      },
      createdAt: '2026-08-30T10:00:00Z',
      updatedAt: '2026-08-30T10:00:00Z'
    };

    const stats = ProspectingCampaignEngine.calculateCampaignFunnelStats(sampleProspects, campaign);
    expect(stats.totalProspects).toBe(2);
    expect(stats.enrichedCount).toBe(2);
    expect(stats.verifiedCount).toBe(1);
    expect(stats.qualifiedCount).toBe(1); // Only p_1 >= 75
    expect(stats.dealsCreated).toBe(0); // p_1 is unregistered
  });

  it('should prepare execution payloads with round-robin rep distribution for qualified prospects', () => {
    const campaign: ProspectingCampaign = {
      id: 'camp_test',
      workspaceId: 'ws_test',
      organizationId: 'org_test',
      name: 'Q4 Test Campaign',
      status: 'draft',
      targetCriteria: { sourceType: 'all_discovered' },
      enrichmentOptions: {
        runWebScan: true,
        extractDecisionMakers: true,
        verifyEmails: true,
        generateAIDossier: true
      },
      qualificationThreshold: 50, // Both qualify
      assignment: { type: 'round_robin', repIds: ['rep_kwame', 'rep_akosua'] },
      activation: {
        createDeals: true,
        enrollInCadence: true,
        channel: 'email'
      },
      stats: {
        totalProspects: 0,
        enrichedCount: 0,
        verifiedCount: 0,
        qualifiedCount: 0,
        dealsCreated: 0,
        outreachSent: 0
      },
      createdAt: '2026-08-30T10:00:00Z',
      updatedAt: '2026-08-30T10:00:00Z'
    };

    const payloads = ProspectingCampaignEngine.prepareExecutionPayloads(sampleProspects, campaign);
    expect(payloads.length).toBe(2);
    expect(payloads[0].assignedRepId).toBe('rep_kwame');
    expect(payloads[1].assignedRepId).toBe('rep_akosua');
  });
});
