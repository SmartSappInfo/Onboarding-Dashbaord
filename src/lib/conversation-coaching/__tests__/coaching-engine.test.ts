/**
 * @fileoverview Automated Unit Test Suite for Conversation Intelligence & Coaching Pure Engine (Phase 5).
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeConversationDynamics,
  extractSignalsAndObjections,
  validateScorecardTemplateIntegrity,
  evaluateScorecardUnderRubric,
  scoreRoleplayTurn,
  recommendNextDrill,
} from '../coaching-engine';
import type {
  TranscriptLine,
  ScorecardTemplate,
  PracticeLabScenario,
  RepSkillScores,
} from '../types';

describe('Conversation Intelligence & Coaching Pure Engine (Phase 5)', () => {
  const sampleTranscript: TranscriptLine[] = [
    {
      id: 'l1',
      speaker: 'rep',
      speakerName: 'Kwame (Sales Rep)',
      startMs: 0,
      endMs: 15000,
      timestampLabel: '00:15',
      text: "Good morning Sarah, thank you for joining! Our agenda for today is to understand your workflow and see if SmartSapp can help.",
    },
    {
      id: 'l2',
      speaker: 'buyer',
      speakerName: 'Sarah (Buyer)',
      startMs: 16000,
      endMs: 45000,
      timestampLabel: '00:45',
      text: "Thanks Kwame. Honestly, our team is struggling with manual data entry and inefficient lead tracking. It is a burning problem for us.",
    },
    {
      id: 'l3',
      speaker: 'rep',
      speakerName: 'Kwame (Sales Rep)',
      startMs: 46000,
      endMs: 65000,
      timestampLabel: '01:05',
      text: "Can you walk me through how many hours your reps lose each week, and who makes the final decision on tooling?",
    },
    {
      id: 'l4',
      speaker: 'buyer',
      speakerName: 'Sarah (Buyer)',
      startMs: 66000,
      endMs: 100000,
      timestampLabel: '01:40',
      text: "We lose roughly 15 hours per rep. I make the decision along with our COO. But we are also looking at Salesforce and your price point is steep.",
    },
    {
      id: 'l5',
      speaker: 'rep',
      speakerName: 'Kwame (Sales Rep)',
      startMs: 101000,
      endMs: 130000,
      timestampLabel: '02:10',
      text: "I completely understand that concern. When you consider the 15 hours saved, our platform generates a 4x ROI in the first quarter. Our budget is approved if the ROI is proven?",
    },
    {
      id: 'l6',
      speaker: 'buyer',
      speakerName: 'Sarah (Buyer)',
      startMs: 131000,
      endMs: 150000,
      timestampLabel: '02:30',
      text: "Yes, budget is approved if we see that ROI, and we need this before Q4.",
    },
    {
      id: 'l7',
      speaker: 'rep',
      speakerName: 'Kwame (Sales Rep)',
      startMs: 151000,
      endMs: 170000,
      timestampLabel: '02:50',
      text: "Terrific! As a next step, I will send the proposal and calendar invite for a technical review next Tuesday. How does 2 PM sound?",
    },
  ];

  const sampleTemplate: ScorecardTemplate = {
    id: 'tpl_discovery',
    workspaceId: 'ws_demo',
    organizationId: 'org_demo',
    name: 'Discovery Mastery Scorecard',
    category: 'discovery',
    description: 'Gold-standard evaluation for first-touch discovery calls.',
    criteria: [
      {
        id: 'c_agenda',
        name: 'Agenda & Purpose Established',
        description: 'Rep explicitly framed the purpose and agenda within the first 2 minutes.',
        weight: 0.25,
        rubricGuidance: { 1: 'No agenda stated', 3: 'Brief mention', 5: 'Clear collaborative agenda' },
      },
      {
        id: 'c_pain',
        name: 'Pain Points Identified',
        description: 'Rep probed deeply into business friction and quantified impact.',
        weight: 0.35,
        rubricGuidance: { 1: 'Surface level', 3: 'Identified problem', 5: 'Quantified pain & hours lost' },
      },
      {
        id: 'c_decision',
        name: 'Decision Process & Authority',
        description: 'Uncovered key stakeholders, approval hierarchy, and signoff criteria.',
        weight: 0.2,
        rubricGuidance: { 1: 'No authority check', 3: 'Checked title', 5: 'Identified all stakeholders' },
      },
      {
        id: 'c_next_step',
        name: 'Firm Time-Anchored Next Step',
        description: 'Secured concrete follow-up date, time, and attendees before hanging up.',
        weight: 0.2,
        rubricGuidance: { 1: 'Vague follow-up', 3: 'Agreed to touch base', 5: 'Specific calendar invite agreed' },
      },
    ],
    status: 'active',
    createdAt: '2026-09-04T00:00:00.000Z',
    updatedAt: '2026-09-04T00:00:00.000Z',
  };

  describe('analyzeConversationDynamics', () => {
    it('handles empty transcript gracefully without NaN or errors', () => {
      const dynamics = analyzeConversationDynamics([]);
      expect(dynamics.talkToListenRatio.repPercent).toBe(50);
      expect(dynamics.talkToListenRatio.buyerPercent).toBe(50);
      expect(dynamics.talkToListenRatio.evaluation).toBe('balanced');
      expect(dynamics.wordsPerMinute).toBeGreaterThan(0);
      expect(dynamics.hasMonologueAlert).toBe(false);
    });

    it('calculates talk/listen ratio and detects discovery questions accurately', () => {
      const dynamics = analyzeConversationDynamics(sampleTranscript);
      expect(dynamics.talkToListenRatio.repPercent).toBeGreaterThan(0);
      expect(dynamics.talkToListenRatio.buyerPercent).toBeGreaterThan(0);
      expect(dynamics.talkToListenRatio.repPercent + dynamics.talkToListenRatio.buyerPercent).toBe(100);
      expect(dynamics.discoveryQuestionsCount).toBeGreaterThanOrEqual(1);
      expect(dynamics.wordsPerMinute).toBeGreaterThan(50);
      expect(dynamics.hasMonologueAlert).toBe(false);
    });

    it('triggers monologue alert when a speaker turn exceeds 120 seconds', () => {
      const longMonologueTranscript: TranscriptLine[] = [
        {
          id: 'l_mono',
          speaker: 'rep',
          speakerName: 'Rep',
          startMs: 0,
          endMs: 140000, // 140s monologue
          timestampLabel: '02:20',
          text: 'This is a very long monologue from the sales representative describing product features without pause.',
        },
      ];

      const dynamics = analyzeConversationDynamics(longMonologueTranscript);
      expect(dynamics.longestMonologueSeconds).toBe(140);
      expect(dynamics.hasMonologueAlert).toBe(true);
    });
  });

  describe('extractSignalsAndObjections', () => {
    it('extracts buying signals, objections, and competitors correctly', () => {
      const intel = extractSignalsAndObjections(sampleTranscript);

      // Buying signals check
      expect(intel.buyingSignals.length).toBeGreaterThanOrEqual(2);
      expect(intel.buyingSignals.some((s) => s.category === 'budget')).toBe(true);
      expect(intel.buyingSignals.some((s) => s.category === 'timeline')).toBe(true);

      // Objections check
      expect(intel.objections.length).toBeGreaterThanOrEqual(1);
      expect(intel.objections.some((o) => o.objectionType === 'pricing')).toBe(true);

      // Competitors check
      expect(intel.competitorsMentioned).toContain('Salesforce');

      // Next steps & pain points
      expect(intel.painPoints.length).toBeGreaterThan(0);
      expect(intel.nextSteps.length).toBeGreaterThan(0);
      expect(intel.keyStrengths.length).toBeGreaterThan(0);
      expect(intel.coachingRecommendations.length).toBeGreaterThan(0);
    });
  });

  describe('validateScorecardTemplateIntegrity', () => {
    it('validates template when criteria weights sum exactly to 1.0 (100%)', () => {
      const res = validateScorecardTemplateIntegrity(sampleTemplate);
      expect(res.isValid).toBe(true);
      expect(res.totalWeight).toBe(1.0);
      expect(res.errors.length).toBe(0);
    });

    it('rejects template when criteria weights drift from 1.0', () => {
      const invalidTemplate: ScorecardTemplate = {
        ...sampleTemplate,
        criteria: [
          { ...sampleTemplate.criteria[0], weight: 0.5 },
          { ...sampleTemplate.criteria[1], weight: 0.6 }, // 1.1 total
        ],
      };

      const res = validateScorecardTemplateIntegrity(invalidTemplate);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('Criteria weights must sum to 1.0');
    });
  });

  describe('evaluateScorecardUnderRubric', () => {
    it('evaluates call transcript against structured criteria and extracts evidence quotes', () => {
      const review = evaluateScorecardUnderRubric({
        callId: 'call_123',
        workspaceId: 'ws_demo',
        transcript: sampleTranscript,
        template: sampleTemplate,
      });

      expect(review.callId).toBe('call_123');
      expect(review.templateId).toBe('tpl_discovery');
      expect(review.totalScorePercent).toBeGreaterThan(60);
      expect(review.ratings.length).toBe(sampleTemplate.criteria.length);

      // Verify evidence quote anchoring
      const agendaRating = review.ratings.find((r) => r.criteriaId === 'c_agenda');
      expect(agendaRating?.score).toBe(5);
      expect(agendaRating?.aiEvidenceQuotes.length).toBeGreaterThan(0);
      expect(agendaRating?.aiEvidenceQuotes[0].quote).toContain('agenda');
    });
  });

  describe('scoreRoleplayTurn & Practice Lab', () => {
    const sampleScenario: PracticeLabScenario = {
      id: 'sc_pricing_objection',
      workspaceId: 'ws_demo',
      title: 'Enterprise Pricing Pushback',
      category: 'pricing',
      difficulty: 'intermediate',
      description: 'Customer pushes back on per-seat pricing comparing with lower-tier tools.',
      buyerPersona: {
        name: 'David Mensah',
        title: 'VP Operations',
        companyType: 'Logistics Enterprise',
        tone: 'skeptical',
      },
      initialPrompt: "We reviewed your proposal, but your pricing is nearly 40% higher than our current tool. Why shouldn't we stay where we are?",
      expectedCompetencies: ['Objection Handling', 'Value Linkage', 'Active Listening'],
      status: 'active',
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z',
    };

    it('evaluates seller turns and provides real-time coaching tips', () => {
      const res = scoreRoleplayTurn({
        dialogue: [
          { id: 'turn_1', speaker: 'ai_buyer', text: sampleScenario.initialPrompt, timestamp: '10:00:00' },
          {
            id: 'turn_2',
            speaker: 'rep',
            text: "I completely understand that concern David. Many clients felt the same until they saw our automation saves 12 hours a week per rep. Can you share what metrics your current tool is failing to deliver?",
            timestamp: '10:00:15',
          },
        ],
        scenario: sampleScenario,
      });

      expect(res.turnFeedback.listeningScore).toBeGreaterThanOrEqual(80);
      expect(res.turnFeedback.questionQualityScore).toBeGreaterThanOrEqual(80);
      expect(res.turnFeedback.objectionHandlingScore).toBeGreaterThanOrEqual(80);
      expect(res.isComplete).toBe(false);
    });

    it('completes session after 4 rep turns and returns multi-pillar evaluation', () => {
      const res = scoreRoleplayTurn({
        dialogue: [
          { id: 'turn_1', speaker: 'ai_buyer', text: 'Prompt 1', timestamp: '10:00:00' },
          { id: 'turn_2', speaker: 'rep', text: 'I understand David, what is your primary pain point?', timestamp: '10:00:10' },
          { id: 'turn_3', speaker: 'ai_buyer', text: 'Prompt 2', timestamp: '10:00:20' },
          { id: 'turn_4', speaker: 'rep', text: 'Fair question. How does your team measure productivity?', timestamp: '10:00:30' },
          { id: 'turn_5', speaker: 'ai_buyer', text: 'Prompt 3', timestamp: '10:00:40' },
          { id: 'turn_6', speaker: 'rep', text: 'Our solution delivers 300% ROI. Can we review the math together?', timestamp: '10:00:50' },
          { id: 'turn_7', speaker: 'ai_buyer', text: 'Prompt 4', timestamp: '10:01:00' },
          { id: 'turn_8', speaker: 'rep', text: 'Excellent, let us schedule a technical review next Tuesday.', timestamp: '10:01:10' },
        ],
        scenario: sampleScenario,
      });

      expect(res.isComplete).toBe(true);
      expect(res.finalEvaluation).toBeDefined();
      expect(res.finalEvaluation?.overallScore).toBeGreaterThan(60);
      expect(res.finalEvaluation?.discoveryScore).toBeGreaterThan(0);
      expect(res.finalEvaluation?.objectionHandlingScore).toBeGreaterThan(0);
      expect(res.finalEvaluation?.keyStrengths.length).toBeGreaterThan(0);
    });
  });

  describe('recommendNextDrill', () => {
    it('recommends scenario matching the rep weakest competency', () => {
      const skills: RepSkillScores = {
        discovery: 85,
        objectionHandling: 58, // Weakest
        closing: 80,
        productKnowledge: 75,
        callControl: 70,
      };

      const scenarios: PracticeLabScenario[] = [
        {
          id: 'sc_discovery',
          workspaceId: 'ws_demo',
          title: 'Deep Discovery',
          category: 'discovery',
          difficulty: 'beginner',
          description: '',
          buyerPersona: { name: 'P', title: 'T', companyType: 'C', tone: 'friendly' },
          initialPrompt: '',
          expectedCompetencies: [],
          status: 'active',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'sc_pricing',
          workspaceId: 'ws_demo',
          title: 'Pricing Pushback',
          category: 'pricing',
          difficulty: 'intermediate',
          description: '',
          buyerPersona: { name: 'P', title: 'T', companyType: 'C', tone: 'skeptical' },
          initialPrompt: '',
          expectedCompetencies: [],
          status: 'active',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const recommended = recommendNextDrill(skills, scenarios);
      expect(recommended?.id).toBe('sc_pricing');
    });

    it('falls back gracefully when no scenarios match target category', () => {
      const skills: RepSkillScores = {
        discovery: 90,
        objectionHandling: 90,
        closing: 90,
        productKnowledge: 90,
        callControl: 40, // maps to timing
      };

      const scenarios: PracticeLabScenario[] = [
        {
          id: 'sc_generic',
          workspaceId: 'ws_demo',
          title: 'General Pitch',
          category: 'discovery',
          difficulty: 'beginner',
          description: '',
          buyerPersona: { name: 'P', title: 'T', companyType: 'C', tone: 'friendly' },
          initialPrompt: '',
          expectedCompetencies: [],
          status: 'active',
          createdAt: '',
          updatedAt: '',
        },
      ];

      const res = recommendNextDrill(skills, scenarios);
      expect(res?.id).toBe('sc_generic');
    });

    it('returns undefined when scenarios list is empty', () => {
      const skills: RepSkillScores = {
        discovery: 50,
        objectionHandling: 50,
        closing: 50,
        productKnowledge: 50,
        callControl: 50,
      };

      const res = recommendNextDrill(skills, []);
      expect(res).toBeUndefined();
    });
  });
});
