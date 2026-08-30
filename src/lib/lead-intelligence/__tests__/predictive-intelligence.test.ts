import { describe, it, expect } from 'vitest';
import { PredictiveIntelligenceEngine } from '../predictive/PredictiveIntelligenceEngine';
import type { Prospect, IdentityCollisionRecord, LeadSignal } from '../types';

describe('PredictiveIntelligenceEngine (Phase 13 Unit Tests)', () => {
  const sampleProspects: Prospect[] = [
    {
      id: 'p_accra_high',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      name: 'St. Peter International School',
      domain: 'stpeter.edu.gh',
      phone: '0244123456',
      address: 'East Legon, Accra, Ghana',
      industry: 'Education',
      rating: 4.9,
      source: 'google_places',
      websiteScan: {
        url: 'https://stpeter.edu.gh',
        technologies: ['WordPress', 'PHP', 'Apache', 'MySQL'], // 4 tech items + WP without Paystack
        hasFacebook: true,
        hasInstagram: true,
        hasLinkedIn: true,
        hasTwitter: false,
        sslValid: true,
        scannedAt: '2026-08-28T10:00:00Z'
      },
      contacts: [
        {
          name: 'Rev. Dr. Samuel Mensah',
          email: 'smensah@stpeter.edu.gh',
          phone: '+233244123456',
          role: 'Headmaster & Proprietor',
          confidence: 98,
          verificationStatus: 'verified',
          deliverabilityScore: 99
        }
      ],
      scoring: {
        overallScore: 92,
        needScore: 19,
        digitalMaturity: 15,
        buyingIntent: 24,
        budgetProbability: 16,
        decisionMakerFound: 16,
        engagement: 14
      },
      activeSignalsCount: 2,
      syncStatus: 'unregistered',
      createdAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-29T12:00:00Z'
    },
    {
      id: 'p_kumasi_mid',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      name: 'Kumasi Tech Academy',
      domain: 'kumasitech.com',
      phone: '+233201987654',
      address: 'Bantama, Kumasi, Ghana',
      industry: 'Education',
      rating: 4.1,
      source: 'csv_import',
      websiteScan: {
        url: 'https://kumasitech.com',
        technologies: ['Wix', 'Hubtel'],
        hasFacebook: true,
        hasInstagram: false,
        hasLinkedIn: false,
        hasTwitter: false,
        sslValid: true,
        scannedAt: '2026-08-28T10:00:00Z'
      },
      contacts: [
        {
          name: 'Contact Admin',
          email: 'info@kumasitech.com',
          confidence: 70,
          verificationStatus: 'risky',
          deliverabilityScore: 40
        }
      ],
      scoring: {
        overallScore: 58,
        needScore: 10,
        digitalMaturity: 10,
        buyingIntent: 8,
        budgetProbability: 10,
        decisionMakerFound: 0,
        engagement: 10
      },
      activeSignalsCount: 0,
      syncStatus: 'synced',
      syncedEntityId: 'ent_kumasi_tech',
      crmStatus: 'match_candidate',
      createdAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-29T12:00:00Z'
    }
  ];

  const sampleSignals: LeadSignal[] = [
    {
      id: 'sig_1',
      workspaceId: 'ws_1',
      prospectId: 'p_accra_high',
      prospectName: 'St. Peter International School',
      prospectDomain: 'stpeter.edu.gh',
      type: 'subdomain_portal_detected',
      category: 'technographic',
      title: 'Tuition Portal Subdomain Added',
      headline: 'Tuition Portal Subdomain Added',
      description: 'New subdomain portal.stpeter.edu.gh detected.',
      strength: 'high',
      confidence: 95,
      scoreImpact: 15,
      potentialImplication: 'Digital transformation in progress',
      recommendedAction: 'Engage IT leadership',
      detectedAt: '2026-08-29T14:00:00Z',
      source: 'subdomain_prober',
      isRead: false,
      isDismissed: false
    }
  ];

  const sampleCollisions: IdentityCollisionRecord[] = [
    {
      id: 'col_1',
      workspaceId: 'ws_1',
      prospectId: 'p_accra_high',
      prospect: sampleProspects[0],
      entityId: 'ent_stpeter',
      existingEntityName: 'St. Peter Intl Sch',
      existingEntityDomain: 'stpeter.edu.gh',
      existingEntityContactsCount: 1,
      matchConfidence: 98,
      matchReasons: ['Exact domain match on stpeter.edu.gh'],
      matchType: 'exact_domain',
      status: 'pending_review',
      detectedAt: '2026-08-29T15:00:00Z'
    }
  ];

  it('should calculate 3-stage predictive conversion likelihood with dynamic ACV', () => {
    const highForecast = PredictiveIntelligenceEngine.calculatePredictiveLikelihood(sampleProspects[0]);

    expect(highForecast.meetingProbability).toBeGreaterThanOrEqual(75);
    expect(highForecast.opportunityProbability).toBeGreaterThanOrEqual(60);
    expect(highForecast.closeProbability).toBeGreaterThanOrEqual(35);
    expect(highForecast.expectedACV).toBeGreaterThanOrEqual(20000); // 12k + 4k (4 tech) + 4k (score 92) + 3k (dm 16) = 23k
    expect(highForecast.confidenceLevel).toBe('high');
    expect(highForecast.topDrivers.length).toBeGreaterThan(0);
    expect(highForecast.currency).toBe('GHS');
  });

  it('should generate lower conversion likelihood for low-score unverified prospects', () => {
    const midForecast = PredictiveIntelligenceEngine.calculatePredictiveLikelihood(sampleProspects[1]);

    expect(midForecast.meetingProbability).toBeLessThan(60);
    expect(midForecast.closeProbability).toBeLessThan(30);
    expect(midForecast.expectedACV).toBeLessThanOrEqual(15000);
  });

  it('should generate multi-source Intelligence Inbox items across 8 categories', () => {
    const items = PredictiveIntelligenceEngine.generateIntelligenceInboxItems(
      sampleProspects,
      sampleCollisions,
      sampleSignals
    );

    expect(items.length).toBeGreaterThan(0);

    const highIntentItem = items.find(i => i.category === 'high_intent');
    expect(highIntentItem).toBeDefined();
    expect(highIntentItem?.title).toBe('Tuition Portal Subdomain Added');

    const collisionItem = items.find(i => i.category === 'duplicates');
    expect(collisionItem).toBeDefined();
    expect(collisionItem?.priority).toBe('urgent');

    const scoreItem = items.find(i => i.category === 'score_changes');
    expect(scoreItem).toBeDefined();
    expect(scoreItem?.title).toContain('High Conversion Score');

    const crmItem = items.find(i => i.category === 'crm_matches');
    expect(crmItem).toBeDefined();

    const verifItem = items.find(i => i.category === 'verification_issues');
    expect(verifItem).toBeDefined();
  });

  it('should compute inbox summary statistics and unread counts', () => {
    const items = PredictiveIntelligenceEngine.generateIntelligenceInboxItems(
      sampleProspects,
      sampleCollisions,
      sampleSignals
    );

    const stats = PredictiveIntelligenceEngine.computeInboxStats(items);

    expect(stats.totalUnread).toBeGreaterThan(0);
    expect(stats.highIntentCount).toBe(1);
    expect(stats.collisionCount).toBe(1);
    expect(stats.scoreChangeCount).toBe(1);
    expect(stats.crmMatchCount).toBe(1);
  });

  it('should calculate Smart SDR 2.0 Priority Rank incorporating predictive forecast', () => {
    const rankHigh = PredictiveIntelligenceEngine.calculateSmartPriorityRank(sampleProspects[0]);
    const rankMid = PredictiveIntelligenceEngine.calculateSmartPriorityRank(sampleProspects[1]);

    expect(rankHigh).toBeGreaterThan(rankMid);
    expect(rankHigh).toBeGreaterThan(65);
  });
});
