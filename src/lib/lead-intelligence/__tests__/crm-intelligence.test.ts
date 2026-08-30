import { describe, it, expect } from 'vitest';
import { CRMIntelligenceService } from '../crm/CRMIntelligenceService';
import type { Prospect, LeadSignal, ScoreMovementEvent, CRMEnrichmentMergePayload } from '../types';
import type { Entity, WorkspaceEntity } from '@/lib/types';

describe('CRMIntelligenceService (Phase 9 Unit Tests)', () => {
  const sampleProspect: Prospect = {
    id: 'pros_crm_123',
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
      },
      {
        name: 'Grace Mensah',
        email: 'gmensah@standrews.edu.gh',
        role: 'Bursar',
        confidence: 90,
        verificationStatus: 'verified',
        deliverabilityScore: 95
      }
    ],
    scoring: {
      overallScore: 88,
      needScore: 16,
      digitalMaturity: 12,
      buyingIntent: 22,
      budgetProbability: 14,
      decisionMakerFound: 14,
      engagement: 14
    },
    researchDossier: {
      prospectId: 'pros_crm_123',
      prospectName: 'St. Andrews International Academy',
      domain: 'standrews.edu.gh',
      executiveSummary: 'Leading private international school in Accra',
      icpFitScore: 92,
      intentScore: 85,
      priorityScore: 90,
      digitalMaturityScore: 78,
      commercialPackaging: {
        recommendedTier: 'SmartSapp Enterprise',
        estimatedAnnualValue: 4800,
        urgency: 'critical',
        targetProductModules: ['SIS', 'Fee Collection'],
        pricingRationale: 'High student scale'
      },
      painPoints: [],
      outreachPlaybook: [],
      evidenceGrounding: [],
      researchedAt: '2026-08-29T10:00:00Z',
      modelEngine: 'gemini-1.5-pro'
    },
    syncStatus: 'unregistered',
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-29T12:00:00Z'
  };

  const sampleWorkspaceEntities: WorkspaceEntity[] = [
    {
      id: 'ws_test_ent_1',
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      entityId: 'ent_1',
      entityType: 'institution',
      status: 'active',
      displayName: 'St. Andrews School Accra',
      displayNameLower: 'st. andrews school accra',
      primaryPhone: '+233 24 123 4567',
      primaryEmail: 'info@standrews.edu.gh',
      primaryContactName: 'Kwame Mensah',
      entityContacts: [
        {
          id: 'c_existing_1',
          name: 'Kwame Mensah',
          email: 'info@standrews.edu.gh',
          phone: '+233 24 123 4567',
          typeKey: 'admin',
          typeLabel: 'Administrator',
          isPrimary: true,
          isSignatory: false,
          order: 0
        }
      ],
      workspaceTags: ['active-lead'],
      addedAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-08-20T10:00:00Z'
    },
    {
      id: 'ws_test_ent_2',
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      entityId: 'ent_2',
      entityType: 'institution',
      status: 'active',
      displayName: 'North Ridge Lyceum',
      displayNameLower: 'north ridge lyceum',
      primaryPhone: '+233 30 222 3344',
      primaryEmail: 'admin@northridge.edu.gh',
      entityContacts: [],
      workspaceTags: ['prospect'],
      addedAt: '2026-06-01T10:00:00Z',
      updatedAt: '2026-08-15T10:00:00Z'
    }
  ];

  it('should detect CRM match by domain and email domain with high confidence (>=95%)', () => {
    const matches = CRMIntelligenceService.detectCRMMatches(sampleProspect, sampleWorkspaceEntities);

    expect(matches.length).toBeGreaterThan(0);
    const topMatch = matches[0];
    expect(topMatch.entityId).toBe('ent_1');
    expect(topMatch.matchScore).toBeGreaterThanOrEqual(95);
    expect(topMatch.matchedBy).toBe('domain');
  });

  it('should detect CRM match by telephone number digits', () => {
    const prospectWithoutDomain: Prospect = {
      ...sampleProspect,
      domain: '',
      name: 'Generic Academy'
    };

    const matches = CRMIntelligenceService.detectCRMMatches(prospectWithoutDomain, sampleWorkspaceEntities);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].entityId).toBe('ent_1');
    expect(matches[0].matchedBy).toBe('phone');
    expect(matches[0].matchScore).toBe(95);
  });

  it('should detect CRM match by fuzzy name similarity token overlap', () => {
    const prospectFuzzy: Prospect = {
      ...sampleProspect,
      domain: 'different-domain.com',
      phone: '+233 55 999 8888',
      name: 'St. Andrews International'
    };

    const matches = CRMIntelligenceService.detectCRMMatches(prospectFuzzy, sampleWorkspaceEntities);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].entityId).toBe('ent_1');
    expect(matches[0].matchedBy).toBe('name');
    expect(matches[0].matchScore).toBeGreaterThanOrEqual(75);
  });

  it('should ignore non-matching entities', () => {
    const completelyDifferent: Prospect = {
      ...sampleProspect,
      name: 'Tema Ridge International School',
      domain: 'temaridge.edu.gh',
      phone: '+233 20 888 7777'
    };

    const matches = CRMIntelligenceService.detectCRMMatches(completelyDifferent, sampleWorkspaceEntities);
    expect(matches.length).toBe(0);
  });

  it('should non-destructively synthesize enriched entity payload preserving existing contacts and tags', () => {
    const existingEntity: Entity = {
      id: 'ent_1',
      organizationId: 'org_test',
      entityType: 'institution',
      name: 'St. Andrews School Accra',
      slug: 'standrews',
      entityContacts: sampleWorkspaceEntities[0].entityContacts,
      globalTags: [],
      status: 'active',
      createdAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-08-20T10:00:00Z'
    };

    const payload: CRMEnrichmentMergePayload = {
      prospectId: sampleProspect.id,
      targetEntityId: 'ent_1',
      mergeContacts: true,
      mergeTechnographics: true,
      updateScore: true,
      tagsToAdd: ['high-intent']
    };

    const { updatedEntity, updatedWorkspaceEntity, newContactsAddedCount } = 
      CRMIntelligenceService.synthesizeEnrichedEntityPayload(sampleProspect, existingEntity, sampleWorkspaceEntities[0], payload);

    expect(newContactsAddedCount).toBe(2); // Dr. Michael Bruce + Grace Mensah appended
    expect(updatedEntity.entityContacts?.length).toBe(3); // 1 existing + 2 new
    expect(updatedEntity.entityContacts?.[0].name).toBe('Kwame Mensah'); // Original preserved
    expect(updatedWorkspaceEntity.workspaceTags).toContain('active-lead'); // Original tag preserved
    expect(updatedWorkspaceEntity.workspaceTags).toContain('enriched-lead'); // New tag added
    expect(updatedWorkspaceEntity.workspaceTags).toContain('high-intent');
  });

  it('should build unified activity timeline aggregating intelligence, signals, score shifts, and CRM actions in descending order', () => {
    const signals: LeadSignal[] = [
      {
        id: 'sig_1',
        workspaceId: 'ws_test',
        prospectId: sampleProspect.id,
        prospectName: sampleProspect.name,
        prospectDomain: sampleProspect.domain,
        type: 'payment_gateway_removed',
        category: 'intent',
        title: 'Payment Gateway Removed',
        headline: 'Paystack was removed',
        description: 'Payment gap',
        strength: 'critical',
        confidence: 95,
        scoreImpact: 25,
        potentialImplication: 'Urgent',
        recommendedAction: 'Contact',
        detectedAt: '2026-08-29T11:00:00Z',
        source: 'scraper'
      }
    ];

    const scoreHistory: ScoreMovementEvent[] = [
      {
        id: 'sh_1',
        prospectId: sampleProspect.id,
        workspaceId: 'ws_test',
        timestamp: '2026-08-29T11:05:00Z',
        oldScore: 63,
        newScore: 88,
        change: 25,
        category: 'intent',
        reason: 'Payment gateway removed delta'
      }
    ];

    const crmActivities = [
      {
        id: 'crm_act_1',
        type: 'sales_email_sent',
        content: 'Outreach email sent to Dr. Michael Bruce regarding SmartSapp Fee Management',
        createdAt: '2026-08-29T14:00:00Z',
        userName: 'Kwame Mensah'
      }
    ];

    const timeline = CRMIntelligenceService.buildUnifiedActivityTimeline(
      sampleProspect,
      signals,
      scoreHistory,
      crmActivities
    );

    expect(timeline.length).toBeGreaterThanOrEqual(5); // Discovery, Tech scan, AI Brief, Signal, Score shift, CRM Email
    // Verify sorted descending by timestamp
    for (let i = 0; i < timeline.length - 1; i++) {
      const t1 = new Date(timeline[i].timestamp).getTime();
      const t2 = new Date(timeline[i + 1].timestamp).getTime();
      expect(t1).toBeGreaterThanOrEqual(t2);
    }

    expect(timeline[0].type).toBe('sales_email_sent');
    expect(timeline[0].source).toBe('crm');
  });
});
