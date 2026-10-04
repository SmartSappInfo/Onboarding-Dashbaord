/**
 * @fileoverview Test Suite: Canonical CRM Intelligence Contracts & Validation (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Zero any/any[]), Rule 10 (Zod v4 schema validation),
 * Rule 12 (Risk ceilings), Rule 41 (Explainability grid), and Rule 48 (Sanitized Error Taxonomy).
 */

import { describe, it, expect } from 'vitest';
import {
  AccountAiOverviewSchema,
  AccountKnowledgeSchema,
  AccountRecommendationsSchema,
  AccountRecommendationItemSchema,
  DealIntelligenceSchema,
  MeetingBriefSchema,
  GetAccountIntelligenceInputSchema,
  GetDealIntelligenceInputSchema,
  GetMeetingBriefInputSchema,
  CRM_INTELLIGENCE_ERROR_CODES,
  CrmIntelligenceError,
} from '@/platform/agents/crm/intelligence/crm-intelligence-types';

describe('Canonical CRM Intelligence Contracts (Phase 9 Milestone 3)', () => {
  describe('AccountAiOverviewSchema', () => {
    it('validates a complete, healthy account AI overview', () => {
      const validOverview = {
        entityId: 'ent_greenfield_01',
        workspaceId: 'ws_demo_01',
        healthStatus: 'HEALTHY' as const,
        healthScore: 88,
        executiveSummary: 'Greenfield School demonstrates consistent engagement across onboarding and billing milestones.',
        activeMomentum: 'ACCELERATING' as const,
        keyRisks: [
          {
            id: 'risk_01',
            tag: 'STALLED_RENEWAL',
            severity: 'LOW' as const,
            description: 'Renewal contract proposal due in 45 days.',
          },
        ],
        stakeholders: [
          {
            contactId: 'con_sarah_01',
            name: 'Sarah Jenkins',
            role: 'Head of Admissions',
            email: 'sarah.j@greenfield.edu',
            engagementLevel: 'HIGH' as const,
            isPrimary: true,
          },
        ],
        recentSignals: [
          {
            id: 'sig_01',
            type: 'MEETING' as const,
            title: 'Q3 Strategy & Admissions Review',
            timestamp: new Date().toISOString(),
            sentiment: 'positive' as const,
          },
        ],
        generatedAt: new Date().toISOString(),
      };

      const result = AccountAiOverviewSchema.safeParse(validOverview);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.healthScore).toBe(88);
        expect(result.data.healthStatus).toBe('HEALTHY');
        expect(result.data.stakeholders[0].isPrimary).toBe(true);
      }
    });

    it('rejects invalid health score boundaries', () => {
      const invalidOverview = {
        entityId: 'ent_01',
        workspaceId: 'ws_01',
        healthStatus: 'HEALTHY',
        healthScore: 105, // Exceeds max 100
        executiveSummary: 'Invalid score test',
        activeMomentum: 'STEADY',
        generatedAt: new Date().toISOString(),
      };

      const result = AccountAiOverviewSchema.safeParse(invalidOverview);
      expect(result.success).toBe(false);
    });

    it('rejects unrecognized health status enum', () => {
      const invalidOverview = {
        entityId: 'ent_01',
        workspaceId: 'ws_01',
        healthStatus: 'SUPER_GOOD', // Invalid enum
        healthScore: 90,
        executiveSummary: 'Invalid status test',
        activeMomentum: 'STEADY',
        generatedAt: new Date().toISOString(),
      };

      const result = AccountAiOverviewSchema.safeParse(invalidOverview);
      expect(result.success).toBe(false);
    });
  });

  describe('AccountKnowledgeSchema', () => {
    it('validates grounded facts, meeting takeaways, and citations', () => {
      const validKnowledge = {
        entityId: 'ent_greenfield_01',
        workspaceId: 'ws_demo_01',
        groundedFacts: [
          {
            id: 'fact_01',
            statement: 'Greenfield operates 3 separate campuses with 1,200 enrolled students.',
            category: 'INSTITUTION_PROFILE',
            confidence: 0.95,
            citationId: 'cit_note_01',
            sourceTitle: 'Initial Discovery Note',
            sourceType: 'note',
          },
        ],
        meetingTakeaways: [
          {
            meetingId: 'meet_01',
            meetingTitle: 'Admissions Integration Kickoff',
            date: '2026-09-15',
            takeaways: ['Admissions team needs automated SMS confirmation flows.'],
            decisions: ['Approved SIS API connector provisioning.'],
          },
        ],
        citations: [
          {
            id: 'cit_note_01',
            sourceType: 'note' as const,
            sourceId: 'note_8812',
            title: 'Campus Walkthrough Notes',
            snippet: 'The main campus will transition to digital enrollment this semester.',
            timestamp: new Date().toISOString(),
            isolatedSnippet: '<untrusted_reference_data id="cit_note_01">The main campus will transition to digital enrollment this semester.</untrusted_reference_data>',
          },
        ],
        generatedAt: new Date().toISOString(),
      };

      const result = AccountKnowledgeSchema.safeParse(validKnowledge);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.groundedFacts).toHaveLength(1);
        expect(result.data.citations[0].isolatedSnippet).toContain('<untrusted_reference_data id="cit_note_01">');
      }
    });
  });

  describe('AccountRecommendationsSchema (Rule 41 Explainability Grid)', () => {
    it('validates recommendations with complete WHAT, WHY, IMPACT dimensions', () => {
      const validRecommendation = {
        id: 'rec_01',
        title: 'Schedule Contract Review Follow-up',
        description: 'Send follow-up invite to Sarah Jenkins regarding enterprise renewal terms.',
        priority: 'HIGH' as const,
        category: 'RENEWAL',
        actionType: 'SCHEDULE_MEETING' as const,
        explainability: {
          what: 'Schedule 30-minute review call with Head of Admissions.',
          why: 'Renewal proposal has been pending for 18 days without executive response.',
          impact: 'Mitigates stall risk on $45,000 ARR contract before Q4 budget lock.',
        },
        payloadDelta: {
          meetingType: 'renewal_review',
          suggestedDurationMinutes: 30,
        },
        targetCapabilityId: 'meetings.schedule',
      };

      const itemResult = AccountRecommendationItemSchema.safeParse(validRecommendation);
      expect(itemResult.success).toBe(true);

      const listResult = AccountRecommendationsSchema.safeParse({
        entityId: 'ent_01',
        workspaceId: 'ws_01',
        items: [validRecommendation],
        generatedAt: new Date().toISOString(),
      });
      expect(listResult.success).toBe(true);
    });

    it('rejects recommendation item missing explainability fields', () => {
      const invalidRecommendation = {
        id: 'rec_02',
        title: 'Draft Email',
        description: 'Draft outreach',
        priority: 'MEDIUM',
        category: 'COMMUNICATION',
        actionType: 'DRAFT_EMAIL',
        explainability: {
          what: 'Draft follow-up email',
          // missing why and impact
        },
      };

      const result = AccountRecommendationItemSchema.safeParse(invalidRecommendation);
      expect(result.success).toBe(false);
    });
  });

  describe('DealIntelligenceSchema', () => {
    it('validates deal stage velocity, win probability, and competitor playbooks', () => {
      const validDealIntel = {
        dealId: 'deal_882',
        dealTitle: 'Greenfield 3-Campus Enterprise Bundle',
        dealValue: 75000,
        currency: 'USD',
        stageVelocity: {
          daysInStage: 8,
          averageDaysInStage: 14,
          velocityStatus: 'FAST' as const,
        },
        winProbability: 78,
        healthScore: 82,
        healthCategory: 'STRONG' as const,
        stallRisk: {
          isStalled: false,
          daysSinceActivity: 3,
        },
        buyingSignals: [
          {
            signal: 'Chief Financial Officer attended pricing review and requested invoicing schedule.',
            detectedAt: new Date().toISOString(),
            confidence: 0.9,
          },
        ],
        riskFactors: [
          {
            risk: 'Competitor offering subsidized hardware onboarding.',
            severity: 'MEDIUM' as const,
            mitigationPrompt: 'Highlight SmartSapp zero-hardware cloud architecture and 24/7 priority support.',
          },
        ],
        competitorAnalysis: [
          {
            competitorName: 'LegacyEduSoft',
            objection: 'Existing license paid through next semester.',
            counterStrategy: 'Offer contract buyout credit matching remaining semester value.',
          },
        ],
        recommendedPlaybook: {
          strategyName: 'Executive Sponsorship & Multi-Campus Discount Lock',
          tacticalSteps: [
            'Send procurement questionnaire to CFO',
            'Lock 15% multi-campus onboarding discount through Friday',
          ],
          expectedOutcome: 'Accelerates signature before fiscal year cutoff.',
        },
        generatedAt: new Date().toISOString(),
      };

      const result = DealIntelligenceSchema.safeParse(validDealIntel);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.winProbability).toBe(78);
        expect(result.data.stageVelocity.velocityStatus).toBe('FAST');
      }
    });
  });

  describe('MeetingBriefSchema', () => {
    it('validates complete pre-meeting briefing dossier', () => {
      const validBrief = {
        meetingId: 'meet_990',
        title: 'Executive Contract Sign-off',
        startTime: new Date().toISOString(),
        attendees: [
          {
            name: 'Dr. Arthur Pendelton',
            email: 'arthur.p@greenfield.edu',
            role: 'Superintendent',
            pastInteractionsCount: 4,
            lastSentiment: 'positive',
          },
        ],
        relationshipSummary: 'Strong executive relationship following successful pilot program in Campus 1.',
        openCommitments: [
          {
            id: 'com_01',
            title: 'Provide FERPA compliance certification letter',
            dueDate: new Date().toISOString(),
            isOverdue: false,
          },
        ],
        likelyObjectives: ['Clarify annual data retention terms', 'Finalize rollout schedule'],
        potentialObjections: ['IT department bandwidth during Q4 state testing'],
        suggestedQuestions: [
          'What is your target launch date for campus staff training?',
          'Who on the IT team will lead the SIS credential provisioning?',
        ],
        recommendedStrategy: 'Lead with FERPA certification compliance document, then present simplified 2-week rollout timeline.',
        generatedAt: new Date().toISOString(),
      };

      const result = MeetingBriefSchema.safeParse(validBrief);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.attendees[0].name).toBe('Dr. Arthur Pendelton');
        expect(result.data.openCommitments[0].isOverdue).toBe(false);
      }
    });
  });

  describe('Input Schemas (Anti-IDOR & Multi-Tenant)', () => {
    it('validates GetAccountIntelligenceInputSchema', () => {
      const input = {
        workspaceId: 'ws_demo',
        entityId: 'ent_123',
      };
      const result = GetAccountIntelligenceInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('validates GetDealIntelligenceInputSchema and GetMeetingBriefInputSchema', () => {
      const dealInput = {
        workspaceId: 'ws_demo',
        entityId: 'ent_123',
        dealId: 'deal_456',
      };
      expect(GetDealIntelligenceInputSchema.safeParse(dealInput).success).toBe(true);

      const meetingInput = {
        workspaceId: 'ws_demo',
        entityId: 'ent_123',
        meetingId: 'meet_789',
      };
      expect(GetMeetingBriefInputSchema.safeParse(meetingInput).success).toBe(true);
    });

    it('rejects empty workspaceId in inputs', () => {
      const input = {
        workspaceId: '',
        entityId: 'ent_123',
      };
      const result = GetAccountIntelligenceInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Error Taxonomy & CrmIntelligenceError', () => {
    it('provides all canonical error codes and constructs typed error', () => {
      expect(CRM_INTELLIGENCE_ERROR_CODES.AUTHENTICATION_REQUIRED).toBe('AUTHENTICATION_REQUIRED');
      expect(CRM_INTELLIGENCE_ERROR_CODES.IDOR_VIOLATION).toBe('IDOR_VIOLATION');
      expect(CRM_INTELLIGENCE_ERROR_CODES.CRM_DEAD_MAN_PAUSED).toBe('CRM_DEAD_MAN_PAUSED');
      expect(CRM_INTELLIGENCE_ERROR_CODES.ENTITY_NOT_FOUND).toBe('ENTITY_NOT_FOUND');
      expect(CRM_INTELLIGENCE_ERROR_CODES.SYNTHESIS_FAILED).toBe('SYNTHESIS_FAILED');

      const error = new CrmIntelligenceError(
        'Access denied',
        CRM_INTELLIGENCE_ERROR_CODES.IDOR_VIOLATION,
        403,
        { entityId: 'ent_999' }
      );

      expect(error.name).toBe('CrmIntelligenceError');
      expect(error.code).toBe('IDOR_VIOLATION');
      expect(error.statusCode).toBe(403);
      expect(error.details?.entityId).toBe('ent_999');
    });
  });
});
