import { describe, it, expect } from 'vitest';
import {
  calculateIceScore,
  getIceQuadrant,
  validateLifecycleTransition,
  calculateIdeaValidationSummary,
  projectIdeaToCanvas,
  filterIdeas,
  getLifecycleStageDisplayLabel,
  getValidationStatusDisplayLabel,
  getAssumptionRiskDisplay,
} from '../quick-notes-domain';
import type { Idea, IdeaAssumption, IdeaHypothesis } from '../quick-notes-types';

describe('Phase 6: Idea Intelligence Pure Domain Functions', () => {
  describe('calculateIceScore', () => {
    it('calculates standard ICE score correctly', () => {
      // (Impact 8 * Confidence 7) / Effort 4 = 56 / 4 = 14
      expect(calculateIceScore(8, 4, 7, 'standard_ice')).toBe(14);

      // Max score: (10 * 10) / 1 = 100
      expect(calculateIceScore(10, 1, 10, 'standard_ice')).toBe(100);

      // Min score: (1 * 1) / 10 = 0.1
      expect(calculateIceScore(1, 10, 1, 'standard_ice')).toBe(0.1);
    });

    it('calculates weighted ICE score correctly', () => {
      // (0.4 * 8 + 0.4 * 6 - 0.2 * 4) * 10 = (3.2 + 2.4 - 0.8) * 10 = 48
      expect(calculateIceScore(8, 4, 6, 'weighted_ice')).toBe(48);
    });

    it('calculates value vs effort ratio correctly', () => {
      // (8 / 4) * 10 = 20
      expect(calculateIceScore(8, 4, 5, 'value_effort')).toBe(20);
    });
  });

  describe('getIceQuadrant', () => {
    it('classifies quick wins (high impact >=6, low effort <=5)', () => {
      expect(getIceQuadrant(8, 3)).toBe('quick_wins');
      expect(getIceQuadrant(6, 5)).toBe('quick_wins');
    });

    it('classifies strategic bets (high impact >=6, high effort >=6)', () => {
      expect(getIceQuadrant(9, 8)).toBe('strategic_bets');
      expect(getIceQuadrant(6, 6)).toBe('strategic_bets');
    });

    it('classifies fill-ins (low impact <=5, low effort <=5)', () => {
      expect(getIceQuadrant(4, 2)).toBe('fill_ins');
      expect(getIceQuadrant(5, 5)).toBe('fill_ins');
    });

    it('classifies hard slogs (low impact <=5, high effort >=6)', () => {
      expect(getIceQuadrant(3, 8)).toBe('hard_slogs');
      expect(getIceQuadrant(5, 6)).toBe('hard_slogs');
    });
  });

  describe('validateLifecycleTransition', () => {
    const mockIdea: Idea = {
      id: 'idea-123',
      workspaceId: 'ws-1',
      knowledgeObjectId: 'note-1',
      title: 'WhatsApp Automation for Schools',
      impact: 8,
      effort: 3,
      confidence: 7,
      iceScore: 18.7,
      validationStatus: 'unvalidated',
      lifecycleStage: 'captured',
      priority: 'high',
      tags: ['whatsapp', 'crm'],
      assumptions: [],
      hypotheses: [],
      experiments: [],
      decisions: [],
      evidenceIds: [],
      relatedIdeaIds: [],
      createdBy: 'user-1',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };

    it('allows transition to archived/rejected without strict requirements', () => {
      const res = validateLifecycleTransition('captured', 'archived', mockIdea, true);
      expect(res.allowed).toBe(true);

      const res2 = validateLifecycleTransition('exploring', 'rejected', mockIdea, true);
      expect(res2.allowed).toBe(true);
    });

    it('blocks moving to validating in strict mode when no hypotheses exist', () => {
      const res = validateLifecycleTransition('structured', 'validating', mockIdea, true);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('at least 1 testable hypothesis');
    });

    it('allows moving to validating when hypotheses exist', () => {
      const ideaWithHypo: Idea = {
        ...mockIdea,
        hypotheses: [
          {
            id: 'hypo-1',
            statement: 'If we send WhatsApp reminders, attendance increases by 25%',
            action: 'Send WhatsApp reminders',
            expectedOutcome: '25% increase',
            status: 'testing',
            evidenceIds: [],
            createdAt: '2026-09-01',
          },
        ],
      };
      const res = validateLifecycleTransition('structured', 'validating', ideaWithHypo, true);
      expect(res.allowed).toBe(true);
    });

    it('blocks moving to approved if unvalidated and lacking evidence in strict mode', () => {
      const res = validateLifecycleTransition('validating', 'approved', mockIdea, true, 2);
      expect(res.allowed).toBe(false);
    });
  });

  describe('calculateIdeaValidationSummary', () => {
    it('computes validation summary and percentage accurately', () => {
      const assumptions: IdeaAssumption[] = [
        { id: 'a1', statement: 'Parents check WhatsApp daily', riskLevel: 'critical', status: 'supported', evidenceIds: ['ev-1', 'ev-2'], createdAt: '2026-09-01' },
        { id: 'a2', statement: 'School admins have WhatsApp Web', riskLevel: 'medium', status: 'untested', evidenceIds: [], createdAt: '2026-09-01' },
      ];
      const hypotheses: IdeaHypothesis[] = [
        { id: 'h1', statement: 'If X then Y', action: 'X', expectedOutcome: 'Y', status: 'proven', evidenceIds: ['ev-3'], createdAt: '2026-09-01' },
      ];

      const idea: Idea = {
        id: 'idea-1',
        workspaceId: 'ws-1',
        knowledgeObjectId: 'note-1',
        title: 'Idea 1',
        impact: 7,
        effort: 4,
        confidence: 6,
        iceScore: 10.5,
        validationStatus: 'testing',
        lifecycleStage: 'validating',
        priority: 'medium',
        tags: [],
        assumptions,
        hypotheses,
        experiments: [],
        decisions: [],
        evidenceIds: ['ev-direct'],
        relatedIdeaIds: [],
        createdBy: 'user-1',
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      };

      const summary = calculateIdeaValidationSummary(idea);
      expect(summary.totalAssumptions).toBe(2);
      expect(summary.supportedAssumptions).toBe(1);
      expect(summary.totalHypotheses).toBe(1);
      expect(summary.provenHypotheses).toBe(1);
      // Total evidence: 1 direct + 2 from a1 + 1 from h1 = 4
      expect(summary.totalEvidenceCount).toBe(4);
      // 2 verified (1 supported assumption + 1 proven hypothesis) out of 3 items = 67%
      expect(summary.validationPercentage).toBe(67);
    });
  });

  describe('projectIdeaToCanvas', () => {
    it('creates balanced hierarchical nodes and edges from structured idea', () => {
      const idea: Idea = {
        id: 'idea-canvas-1',
        workspaceId: 'ws-1',
        knowledgeObjectId: 'note-1',
        title: 'Online Portal for Parents',
        problem: 'Parents cannot see real-time payment statements',
        proposedSolution: 'Self-service mobile web portal with payment receipt download',
        impact: 9,
        effort: 5,
        confidence: 8,
        iceScore: 14.4,
        validationStatus: 'testing',
        lifecycleStage: 'structured',
        priority: 'urgent',
        tags: ['portal'],
        assumptions: [
          { id: 'a1', statement: 'Parents have smartphones', riskLevel: 'low', status: 'supported', evidenceIds: [], createdAt: '2026-09-01' },
        ],
        hypotheses: [
          { id: 'h1', statement: 'Portal reduces support calls by 40%', action: 'Launch portal', expectedOutcome: '40% fewer calls', status: 'draft', evidenceIds: [], createdAt: '2026-09-01' },
        ],
        experiments: [],
        decisions: [],
        evidenceIds: [],
        relatedIdeaIds: [],
        createdBy: 'user-1',
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      };

      const layout = projectIdeaToCanvas(idea, [], [{ id: 'school-1', name: 'Springfield Academy', type: 'school' }]);

      expect(layout.nodes.length).toBeGreaterThanOrEqual(5); // Core + Problem + Solution + 1 Assumption + 1 Hypothesis + 1 CRM entity
      expect(layout.edges.length).toBeGreaterThanOrEqual(5);

      const coreNode = layout.nodes.find((n) => n.type === 'core_idea');
      expect(coreNode).toBeDefined();
      expect(coreNode?.title).toBe('Online Portal for Parents');

      const problemNode = layout.nodes.find((n) => n.type === 'problem');
      expect(problemNode).toBeDefined();

      const crmNode = layout.nodes.find((n) => n.type === 'crm_entity');
      expect(crmNode).toBeDefined();
      expect(crmNode?.title).toBe('Springfield Academy');
    });
  });

  describe('filterIdeas', () => {
    const ideas: Idea[] = [
      {
        id: 'i1',
        workspaceId: 'ws-1',
        knowledgeObjectId: 'n1',
        title: 'Automated Invoicing',
        problem: 'Manual invoices take 10 hours',
        impact: 8,
        effort: 3,
        confidence: 8,
        iceScore: 21.3,
        validationStatus: 'validated',
        lifecycleStage: 'approved',
        priority: 'high',
        tags: ['billing', 'finance'],
        assumptions: [],
        hypotheses: [],
        experiments: [],
        decisions: [],
        evidenceIds: [],
        relatedIdeaIds: [],
        createdBy: 'user-1',
        createdByName: 'John Doe',
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      },
      {
        id: 'i2',
        workspaceId: 'ws-1',
        knowledgeObjectId: 'n2',
        title: 'Virtual VR Classroom',
        problem: 'Remote students feel disconnected',
        impact: 9,
        effort: 9,
        confidence: 4,
        iceScore: 4.0,
        validationStatus: 'unvalidated',
        lifecycleStage: 'captured',
        priority: 'low',
        tags: ['vr', 'innovation'],
        assumptions: [],
        hypotheses: [],
        experiments: [],
        decisions: [],
        evidenceIds: [],
        relatedIdeaIds: [],
        createdBy: 'user-2',
        createdByName: 'Jane Smith',
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      },
    ];

    it('filters by lifecycle stage', () => {
      const filtered = filterIdeas(ideas, { lifecycleStage: 'approved' });
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('i1');
    });

    it('filters by quadrant', () => {
      // i1 is High Impact (8), Low Effort (3) -> quick_wins
      // i2 is High Impact (9), High Effort (9) -> strategic_bets
      expect(filterIdeas(ideas, { quadrant: 'quick_wins' }).length).toBe(1);
      expect(filterIdeas(ideas, { quadrant: 'strategic_bets' }).length).toBe(1);
      expect(filterIdeas(ideas, { quadrant: 'fill_ins' }).length).toBe(0);
    });

    it('filters by search query', () => {
      expect(filterIdeas(ideas, { searchQuery: 'invoicing' }).length).toBe(1);
      expect(filterIdeas(ideas, { searchQuery: 'Jane' }).length).toBe(1);
      expect(filterIdeas(ideas, { searchQuery: 'nonexistent' }).length).toBe(0);
    });
  });

  describe('label and styling formatters', () => {
    it('returns valid display labels for stages', () => {
      expect(getLifecycleStageDisplayLabel('approved').label).toBe('Approved');
      expect(getLifecycleStageDisplayLabel('validating').label).toBe('Validating');
    });

    it('returns valid display labels for validation status', () => {
      expect(getValidationStatusDisplayLabel('validated').label).toBe('Validated');
    });

    it('returns valid display labels for assumption risks', () => {
      expect(getAssumptionRiskDisplay('critical').label).toBe('Critical Risk');
    });
  });
});
