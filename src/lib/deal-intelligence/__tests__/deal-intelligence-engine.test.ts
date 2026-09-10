import { describe, it, expect } from 'vitest';
import {
  autoBalanceDealHealthWeights,
  evaluateStakeholderMultiThreading,
  calculateDealHealthScore,
  extractPostMeetingIntelligence,
  buildUnifiedActivityTimeline,
} from '../deal-intelligence-engine';
import type { StakeholderPerson, UnifiedTimelineEvent } from '../types';

describe('deal-intelligence-engine', () => {
  describe('autoBalanceDealHealthWeights', () => {
    it('normalizes arbitrary weights so their sum equals exactly 1.00', () => {
      const weights = autoBalanceDealHealthWeights({
        engagementRecency: 0.4,
        stakeholderBreadth: 0.4,
        stageVelocity: 0.4,
        conversationSentiment: 0.4,
      });

      const total =
        weights.engagementRecency +
        weights.stakeholderBreadth +
        weights.stageVelocity +
        weights.conversationSentiment;

      expect(Math.round(total * 100) / 100).toBe(1.0);
    });

    it('handles all-zero or empty weights with safe defaults of 0.25 each', () => {
      const weights = autoBalanceDealHealthWeights({
        engagementRecency: 0,
        stakeholderBreadth: 0,
        stageVelocity: 0,
        conversationSentiment: 0,
      });

      expect(weights.engagementRecency).toBe(0.25);
      expect(weights.stakeholderBreadth).toBe(0.25);
      expect(weights.stageVelocity).toBe(0.25);
      expect(weights.conversationSentiment).toBe(0.25);
    });

    it('safely handles negative weights by clamping to non-negative values and balancing to 1.00', () => {
      const weights = autoBalanceDealHealthWeights({
        engagementRecency: -0.5,
        stakeholderBreadth: 0.6,
        stageVelocity: 0.4,
        conversationSentiment: -0.1,
      });

      const total =
        weights.engagementRecency +
        weights.stakeholderBreadth +
        weights.stageVelocity +
        weights.conversationSentiment;

      expect(weights.engagementRecency).toBe(0);
      expect(weights.conversationSentiment).toBe(0);
      expect(Math.round(total * 100) / 100).toBe(1.0);
    });
  });

  describe('evaluateStakeholderMultiThreading', () => {
    it('flags single-threaded risk when deal value >= threshold and only 1 contact exists', () => {
      const stakeholders: StakeholderPerson[] = [
        {
          contactId: 'c1',
          name: 'Jane Doe',
          title: 'Project Lead',
          role: 'evaluator',
          sentiment: 'neutral',
          engagement: 'active',
          isPrimaryContact: true,
        },
      ];

      const result = evaluateStakeholderMultiThreading(stakeholders, 25000, 10000);
      expect(result.isSingleThreaded).toBe(true);
      expect(result.missingCrucialRoles).toContain('economic_buyer');
      expect(result.missingCrucialRoles).toContain('champion');
      expect(result.multiThreadingScore).toBeLessThan(50);
    });

    it('does not flag single-threaded risk for smaller deals below threshold', () => {
      const stakeholders: StakeholderPerson[] = [
        {
          contactId: 'c1',
          name: 'Jane Doe',
          title: 'Owner',
          role: 'economic_buyer',
          sentiment: 'champion',
          engagement: 'active',
          isPrimaryContact: true,
        },
      ];

      const result = evaluateStakeholderMultiThreading(stakeholders, 4500, 10000);
      expect(result.isSingleThreaded).toBe(false);
      expect(result.missingCrucialRoles).not.toContain('economic_buyer');
    });

    it('awards higher scores when both Economic Buyer and Champion are engaged', () => {
      const stakeholders: StakeholderPerson[] = [
        {
          contactId: 'c1',
          name: 'Kofi Mensah',
          title: 'CFO',
          role: 'economic_buyer',
          sentiment: 'supporter',
          engagement: 'active',
          isPrimaryContact: true,
        },
        {
          contactId: 'c2',
          name: 'Ama Serwaa',
          title: 'VP Sales',
          role: 'champion',
          sentiment: 'champion',
          engagement: 'active',
          isPrimaryContact: false,
        },
      ];

      const result = evaluateStakeholderMultiThreading(stakeholders, 50000, 10000);
      expect(result.isSingleThreaded).toBe(false);
      expect(result.multiThreadingScore).toBeGreaterThanOrEqual(80);
      expect(result.missingCrucialRoles).not.toContain('economic_buyer');
      expect(result.missingCrucialRoles).not.toContain('champion');
    });

    it('penalizes score when an unmitigated blocker is identified', () => {
      const withBlocker: StakeholderPerson[] = [
        {
          contactId: 'c1',
          name: 'Tom Blocker',
          title: 'IT Director',
          role: 'blocker',
          sentiment: 'blocker',
          engagement: 'active',
          isPrimaryContact: true,
        },
      ];

      const result = evaluateStakeholderMultiThreading(withBlocker, 15000, 10000);
      expect(result.multiThreadingScore).toBeLessThan(35);
    });
  });

  describe('calculateDealHealthScore', () => {
    const fixedNowMs = 1725450000000; // Deterministic test timestamp

    it('evaluates a healthy deal with high cadence, multiple stakeholders, and strong velocity', () => {
      const scorecard = calculateDealHealthScore({
        deal: {
          id: 'deal_1',
          name: 'Enterprise Cloud Migration',
          value: 75000,
          stageId: 'proposal',
          stageName: 'Proposal',
          ownerId: 'usr_1',
          ownerName: 'Rep Alex',
          createdAt: new Date(fixedNowMs - 10 * 86400000).toISOString(),
          updatedAt: new Date(fixedNowMs - 1 * 86400000).toISOString(),
          daysInStage: 3,
          slipCount: 0,
        },
        stakeholders: [
          {
            contactId: 'c1',
            name: 'Kofi Mensah',
            title: 'CFO',
            role: 'economic_buyer',
            sentiment: 'supporter',
            engagement: 'active',
            isPrimaryContact: true,
          },
          {
            contactId: 'c2',
            name: 'Ama Serwaa',
            title: 'Head of Infra',
            role: 'champion',
            sentiment: 'champion',
            engagement: 'active',
            isPrimaryContact: false,
          },
        ],
        interactions: [
          { timestamp: new Date(fixedNowMs - 1 * 86400000).toISOString(), actorType: 'human' },
          { timestamp: new Date(fixedNowMs - 3 * 86400000).toISOString(), actorType: 'buyer' },
          { timestamp: new Date(fixedNowMs - 6 * 86400000).toISOString(), actorType: 'human' },
          { timestamp: new Date(fixedNowMs - 9 * 86400000).toISOString(), actorType: 'buyer' },
        ],
        calls: [
          {
            overallScore: 4.5,
            sentiment: 'positive',
            unresolvedObjections: [],
          },
        ],
        referenceTimeMs: fixedNowMs,
      });

      expect(scorecard.overallHealthScore).toBeGreaterThanOrEqual(80);
      expect(scorecard.healthTier).toBe('healthy');
      expect(scorecard.factors.engagementRecency.daysSinceLastTouch).toBe(1);
      expect(scorecard.factors.stakeholderBreadth.isSingleThreaded).toBe(false);
    });

    it('evaluates an at-risk deal with silence, single-threading, and stage stagnation', () => {
      const scorecard = calculateDealHealthScore({
        deal: {
          id: 'deal_2',
          name: 'Stalled Deal',
          value: 30000,
          stageId: 'negotiation',
          stageName: 'Negotiation',
          ownerId: 'usr_2',
          ownerName: 'Rep Chris',
          createdAt: new Date(fixedNowMs - 40 * 86400000).toISOString(),
          updatedAt: new Date(fixedNowMs - 18 * 86400000).toISOString(),
          daysInStage: 22,
          slipCount: 2,
        },
        stakeholders: [
          {
            contactId: 'c1',
            name: 'Sole Contact',
            title: 'Manager',
            role: 'evaluator',
            sentiment: 'skeptic',
            engagement: 'passive',
            isPrimaryContact: true,
          },
        ],
        interactions: [
          { timestamp: new Date(fixedNowMs - 18 * 86400000).toISOString(), actorType: 'human' },
        ],
        calls: [
          {
            overallScore: 2.0,
            sentiment: 'negative',
            unresolvedObjections: ['Pricing objection', 'Contract liability cap'],
          },
        ],
        referenceTimeMs: fixedNowMs,
      });

      expect(scorecard.overallHealthScore).toBeLessThan(50);
      expect(scorecard.healthTier).toBe('at_risk');
      expect(scorecard.explainableDrivers.length).toBeGreaterThanOrEqual(3);
      expect(scorecard.explainableDrivers.some((d) => d.includes('Single-threaded'))).toBe(true);
      expect(scorecard.explainableDrivers.some((d) => d.includes('slipped'))).toBe(true);
      expect(scorecard.aiRecommendedAction.urgency).toBe('immediate');
    });
  });

  describe('extractPostMeetingIntelligence', () => {
    it('detects buying signals, objections, commitments, and drafts CRM sync', () => {
      const notes = `
Great meeting with the team.
The buyer confirmed that budget has been approved by the board for Q4.
They mentioned competitor Datadog is also being evaluated.
However, there is a pricing concern regarding user seat licenses.
Commitment: Send technical security whitepaper by Friday.
Commitment: Schedule pricing review with finance director.
      `;

      const pmi = extractPostMeetingIntelligence({
        meetingId: 'meet_101',
        meetingTitle: 'Annual Renewal & Expansion',
        repId: 'usr_1',
        repName: 'Kwame Mensah',
        notesText: notes,
        sentimentRating: 'positive',
        workspaceId: 'ws_demo',
        organizationId: 'org_demo',
        dealId: 'deal_101',
      });

      expect(pmi.sentimentRating).toBe('positive');
      expect(pmi.detectedBuyingSignals.length).toBeGreaterThanOrEqual(1);
      expect(pmi.detectedBuyingSignals.some((s) => s.signalType === 'intent_spike')).toBe(true);
      expect(pmi.detectedBuyingSignals.some((s) => s.signalType === 'competitor_mention')).toBe(true);
      expect(pmi.detectedObjections).toContain('Pricing & budget concern');
      expect(pmi.commitmentsMade.length).toBe(2);
      expect(pmi.crmSyncDraft.tasksToCreate.length).toBe(2);
      expect(pmi.crmSyncDraft.dealHealthDelta).toBeGreaterThan(0);
      expect(pmi.crmSyncDraft.followUpEmailDraft.subject).toContain('Annual Renewal & Expansion');
    });

    it('calculates deterministic commitment and task due dates when referenceTimeMs is provided', () => {
      const fixedTimeMs = new Date('2026-09-01T12:00:00Z').getTime();
      const pmi = extractPostMeetingIntelligence({
        meetingId: 'meet_fixed',
        meetingTitle: 'Enterprise Review',
        repId: 'usr_1',
        repName: 'Kwame',
        notesText: 'Commitment: Send contract draft\nAction: Prepare migration roadmap',
        sentimentRating: 'positive',
        workspaceId: 'ws_demo',
        organizationId: 'org_demo',
        referenceTimeMs: fixedTimeMs,
      });

      // fixedTimeMs + 2 days = 2026-09-03
      expect(pmi.commitmentsMade[0].dueDate).toBe('2026-09-03');
      expect(pmi.commitmentsMade[1].dueDate).toBe('2026-09-03');
      expect(pmi.crmSyncDraft.tasksToCreate[0].dueDate).toBe('2026-09-03');
    });
  });

  describe('buildUnifiedActivityTimeline', () => {
    it('sorts multi-party timeline events in descending chronological order', () => {
      const events: UnifiedTimelineEvent[] = [
        {
          id: 'e1',
          timestamp: '2026-09-01T10:00:00Z',
          actorType: 'human',
          actorName: 'Alex',
          title: 'Sent initial proposal',
          description: 'Emailed quote to CFO',
        },
        {
          id: 'e2',
          timestamp: '2026-09-03T15:30:00Z',
          actorType: 'buyer',
          actorName: 'CFO',
          title: 'Opened proposal link',
          description: 'Spent 4m 20s reviewing pricing table',
        },
        {
          id: 'e3',
          timestamp: '2026-09-02T12:00:00Z',
          actorType: 'ai',
          actorName: 'SmartSapp AI',
          title: 'High Intent Detected',
          description: 'Spike in engagement logged',
        },
      ];

      const sorted = buildUnifiedActivityTimeline(events);
      expect(sorted[0].id).toBe('e2');
      expect(sorted[1].id).toBe('e3');
      expect(sorted[2].id).toBe('e1');
    });
  });
});
