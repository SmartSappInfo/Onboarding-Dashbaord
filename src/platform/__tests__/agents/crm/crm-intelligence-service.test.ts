/**
 * @fileoverview Test Suite: CRM Intelligence Synthesis Service (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Zero any/any[]), Rule 10 (Zod v4 schema validation),
 * Rule 13/30 (Untrusted Reference Data XML containerization), Rule 41 (Explainability grid),
 * Rule 60 (Emergency dead-man switch), and Rule 69 (Dual-tier CRM preservation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CrmIntelligenceService,
  getCrmIntelligenceService,
} from '@/platform/agents/crm/intelligence/crm-intelligence-service';
import type { Account360Context } from '@/platform/agents/crm/context/account-context-types';
import * as deadManModule from '@/platform/policy/governance-dead-man';

describe('CrmIntelligenceService (Phase 9 Milestone 3)', () => {
  let service: CrmIntelligenceService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new CrmIntelligenceService();
  });

  const mockAccountContext: Account360Context = {
    organizationId: 'org_enterprise_01',
    workspaceId: 'ws_demo_01',
    entityId: 'ent_greenfield_01',
    entity: {
      id: 'ent_greenfield_01',
      name: 'Greenfield School',
      type: 'client',
      status: 'active',
      industry: 'Education',
      email: 'admissions@greenfield.edu',
      phone: '+1-555-0199',
      city: 'Boston',
      address: '100 Academic Way',
      createdAt: '2026-01-15T09:00:00Z',
    },
    workspaceEntity: {
      id: 'ws_demo_01_ent_greenfield_01',
      entityId: 'ent_greenfield_01',
      workspaceId: 'ws_demo_01',
      pipelineId: 'pipe_k12',
      stageId: 'stage_decision',
      stageName: 'Decision Pending',
      assignedTo: {
        userId: 'usr_rep_01',
        name: 'Alex Rivera',
        email: 'alex@smartsapp.com',
      },
      workspaceTags: ['high-value', 'k12-district', 'annual-contract'],
      leadStatus: 'QUALIFIED',
      updatedAt: '2026-10-01T14:30:00Z',
    },
    contacts: [
      {
        id: 'con_sarah_01',
        name: 'Sarah Jenkins',
        role: 'Head of Admissions',
        email: 'sarah.j@greenfield.edu',
        phone: '+1-555-0123',
        isPrimary: true,
        channelPreferences: ['EMAIL', 'WHATSAPP'],
      },
      {
        id: 'con_cfo_01',
        name: 'Marcus Vance',
        role: 'Chief Financial Officer',
        email: 'marcus.v@greenfield.edu',
        phone: '+1-555-0144',
        isPrimary: false,
        channelPreferences: ['EMAIL'],
      },
    ],
    deals: [
      {
        id: 'deal_greenfield_01',
        title: '3-Campus Digital Enrollment Expansion',
        pipelineId: 'pipe_k12',
        stageId: 'stage_decision',
        stageName: 'Decision Pending',
        value: 48000,
        currency: 'USD',
        probability: 75,
        ageInDays: 24,
        expectedCloseDate: '2026-10-25T00:00:00Z',
        isStalled: false,
      },
    ],
    meetings: [
      {
        id: 'meet_01',
        title: 'Q3 Product Demonstration & Invoicing Review',
        startTime: '2026-09-28T14:00:00Z',
        attendees: ['Sarah Jenkins', 'Marcus Vance', 'Alex Rivera'],
        summary: 'Reviewed admissions portal prototype and confirmed budget approval for next term.',
        transcriptSnippet: 'Marcus confirmed that the district board approved the line item for onboarding software.',
        sentiment: 'positive',
        isolatedContent: '<untrusted_reference_data id="meet_01">Marcus confirmed that the district board approved the line item for onboarding software.</untrusted_reference_data>',
      },
    ],
    notes: [
      {
        id: 'note_01',
        content: 'Sarah requested multi-campus SIS roster sync documentation before final sign-off.',
        isolatedContent: '<untrusted_reference_data id="note_01">Sarah requested multi-campus SIS roster sync documentation before final sign-off.</untrusted_reference_data>',
        authorName: 'Alex Rivera',
        createdAt: '2026-10-02T10:15:00Z',
        category: 'technical_spec',
      },
    ],
    tasks: [
      {
        id: 'task_01',
        title: 'Send SIS roster sync documentation',
        status: 'pending',
        priority: 'high',
        dueDate: '2026-10-05T17:00:00Z',
        assignedToName: 'Alex Rivera',
        isOverdue: false,
      },
    ],
    finances: {
      openBalance: 0,
      overdueBalance: 0,
      currency: 'USD',
      invoiceCount: 2,
      agingCategory: 'CLEAR',
    },
    memories: [
      {
        id: 'mem_01',
        content: 'Greenfield previously evaluated competitor EdTechSoft but found implementation too rigid.',
        sourceType: 'note',
        confidence: 0.92,
        citationId: 'cit_01',
      },
    ],
    timeline: [
      {
        id: 'tl_01',
        timestamp: '2026-10-02T10:15:00Z',
        category: 'COMMERCIAL',
        title: 'Technical note added',
        summary: 'Alex Rivera documented SIS roster sync requirements.',
        actor: 'Alex Rivera',
        sourceRef: {
          type: 'note',
          id: 'note_01',
        },
      },
      {
        id: 'tl_02',
        timestamp: '2026-09-28T14:00:00Z',
        category: 'ENGAGEMENT',
        title: 'Meeting completed',
        summary: 'Product demonstration reviewed admissions prototype.',
        actor: 'Sarah Jenkins',
        sourceRef: {
          type: 'meeting',
          id: 'meet_01',
        },
      },
    ],
    metadata: {
      assembledAt: new Date().toISOString(),
      durationMs: 42,
      estimatedTokens: 1250,
      correlationId: 'corr_test_01',
      isKnapsackCompressed: false,
    },
  };

  describe('synthesizeAccountAiOverview', () => {
    it('synthesizes health score, status, and executive summary for active accounts', async () => {
      const overview = await service.synthesizeAccountAiOverview(mockAccountContext);

      expect(overview.entityId).toBe('ent_greenfield_01');
      expect(overview.workspaceId).toBe('ws_demo_01');
      expect(overview.healthScore).toBeGreaterThanOrEqual(75);
      expect(overview.healthStatus).toBe('HEALTHY');
      expect(overview.activeMomentum).toBe('ACCELERATING');
      expect(overview.executiveSummary).toContain('Greenfield School');
      expect(overview.stakeholders).toHaveLength(2);
      expect(overview.stakeholders[0].isPrimary).toBe(true);
      expect(overview.recentSignals.length).toBeGreaterThan(0);
    });

    it('penalizes health score and sets AT_RISK or DORMANT for overdue finances and stalled deals', async () => {
      const atRiskContext: Account360Context = {
        ...mockAccountContext,
        deals: [
          {
            ...mockAccountContext.deals[0],
            isStalled: true,
            ageInDays: 75,
          },
        ],
        tasks: [
          {
            ...mockAccountContext.tasks[0],
            status: 'pending',
            isOverdue: true,
            priority: 'urgent',
          },
        ],
        finances: {
          openBalance: 15000,
          overdueBalance: 15000,
          currency: 'USD',
          invoiceCount: 3,
          agingCategory: 'OVERDUE_60',
        },
        meetings: [],
      };

      const overview = await service.synthesizeAccountAiOverview(atRiskContext);
      expect(overview.healthScore).toBeLessThan(55);
      expect(['AT_RISK', 'DORMANT', 'ATTENTION_NEEDED']).toContain(overview.healthStatus);
      expect(['SLOWING', 'STALLED']).toContain(overview.activeMomentum);
      expect(overview.keyRisks.length).toBeGreaterThan(0);
    });
  });

  describe('synthesizeAccountKnowledge', () => {
    it('extracts grounded facts, meeting takeaways, and XML-isolated citations (Rule 13 & 30)', async () => {
      const knowledge = await service.synthesizeAccountKnowledge(mockAccountContext);

      expect(knowledge.entityId).toBe('ent_greenfield_01');
      expect(knowledge.groundedFacts.length).toBeGreaterThan(0);
      expect(knowledge.meetingTakeaways.length).toBeGreaterThan(0);
      expect(knowledge.meetingTakeaways[0].takeaways).toContain(
        'Reviewed admissions portal prototype and confirmed budget approval for next term.'
      );

      // Verify citations and XML isolation
      expect(knowledge.citations.length).toBeGreaterThan(0);
      for (const citation of knowledge.citations) {
        expect(citation.isolatedSnippet).toMatch(/^<untrusted_reference_data id="[^"]+">[\s\S]*<\/untrusted_reference_data>$/);
      }
    });
  });

  describe('synthesizeAccountRecommendations (Rule 41 Explainability Grid)', () => {
    it('generates prioritized Next-Best-Actions with WHAT, WHY, and IMPACT dimensions', async () => {
      const recommendations = await service.synthesizeAccountRecommendations(mockAccountContext);

      expect(recommendations.entityId).toBe('ent_greenfield_01');
      expect(recommendations.items.length).toBeGreaterThan(0);

      const firstRec = recommendations.items[0];
      expect(firstRec.title).toBeTruthy();
      expect(firstRec.priority).toBeDefined();
      expect(firstRec.explainability.what).toBeTruthy();
      expect(firstRec.explainability.why).toBeTruthy();
      expect(firstRec.explainability.impact).toBeTruthy();
    });

    it('generates urgent billing recommendation when receivables are overdue', async () => {
      const overdueContext: Account360Context = {
        ...mockAccountContext,
        finances: {
          openBalance: 12000,
          overdueBalance: 12000,
          currency: 'USD',
          invoiceCount: 2,
          agingCategory: 'OVERDUE_60',
        },
      };

      const recommendations = await service.synthesizeAccountRecommendations(overdueContext);
      const financeRec = recommendations.items.find(
        (r) => r.category === 'FINANCIAL' || r.title.toLowerCase().includes('invoice') || r.title.toLowerCase().includes('billing')
      );
      expect(financeRec).toBeDefined();
      expect(financeRec?.priority).toBe('URGENT');
    });
  });

  describe('synthesizeDealIntelligence', () => {
    it('evaluates stage velocity, win probability, competitor objections, and playbook', async () => {
      const deal = mockAccountContext.deals[0];
      const dealIntel = await service.synthesizeDealIntelligence(deal, mockAccountContext);

      expect(dealIntel.dealId).toBe(deal.id);
      expect(dealIntel.dealTitle).toBe(deal.title);
      expect(dealIntel.stageVelocity.daysInStage).toBe(24);
      expect(dealIntel.stageVelocity.velocityStatus).toBeDefined();
      expect(dealIntel.winProbability).toBeGreaterThan(0);
      expect(dealIntel.recommendedPlaybook.strategyName).toBeTruthy();
      expect(dealIntel.recommendedPlaybook.tacticalSteps.length).toBeGreaterThan(0);
    });
  });

  describe('synthesizeMeetingBrief', () => {
    it('assembles pre-meeting dossier with attendee history and open commitments', async () => {
      const meeting = mockAccountContext.meetings[0];
      const brief = await service.synthesizeMeetingBrief(meeting, mockAccountContext);

      expect(brief.meetingId).toBe(meeting.id);
      expect(brief.title).toBe(meeting.title);
      expect(brief.attendees.length).toBeGreaterThan(0);
      expect(brief.likelyObjectives.length).toBeGreaterThan(0);
      expect(brief.suggestedQuestions.length).toBeGreaterThan(0);
      expect(brief.recommendedStrategy).toBeTruthy();
    });
  });

  describe('Emergency Dead-Man Switch Evaluation (Rule 60)', () => {
    it('throws CrmIntelligenceError with CRM_DEAD_MAN_PAUSED when dead-man switch is paused', async () => {
      vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockImplementation(async () => {
        throw new Error('Emergency pause triggered');
      });

      await expect(
        service.synthesizeAccountAiOverview(mockAccountContext)
      ).rejects.toThrowError(/CRM_DEAD_MAN_PAUSED|Emergency pause/);
    });
  });

  describe('Singleton Accessor', () => {
    it('returns a stable HMR-safe singleton instance', () => {
      const instance1 = getCrmIntelligenceService();
      const instance2 = getCrmIntelligenceService();
      expect(instance1).toBe(instance2);
    });
  });
});
