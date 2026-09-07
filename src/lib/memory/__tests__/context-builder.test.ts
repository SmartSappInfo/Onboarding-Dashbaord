/**
 * @fileOverview CompanyBrain 2.0 Phase 5: Context Builder Unit Tests
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Test Coverage Invariant:
 *    - Validates multi-attribute relevance scoring, 4-tier token budget allocation,
 *      deterministic dossier synthesis, and active contradiction alerts.
 * 2. Zero `any` or `any[]`:
 *    - All fixtures and test models are strictly typed.
 */

import { describe, it, expect } from 'vitest';
import { ContextRelevanceScorer } from '../services/context-relevance-scorer';
import { ContextBudgetManager } from '../services/context-budget-manager';
import { generateContextDossierDeterministic } from '@/ai/flows/generate-context-dossier-flow';
import type {
  ContextFact,
  ContextMemory,
  ContextRelationship,
  ContextEvent,
  ContextAction,
  ContextKnowledge,
  ContextConflictWarning,
} from '../context-types';

describe('CompanyBrain Phase 5: Context Builder Engine', () => {
  describe('ContextRelevanceScorer', () => {
    it('calculates bounded score in [0.0, 1.0] and produces attribution', () => {
      const result = ContextRelevanceScorer.calculateRelevance({
        semanticScore: 0.85,
        isDirectSubjectMatch: true,
        graphHops: 1,
        freshnessScore: 0.95,
        importance: 0.8,
        confidence: 0.9,
      });

      expect(result.score).toBeGreaterThanOrEqual(0.0);
      expect(result.score).toBeLessThanOrEqual(1.0);
      expect(result.score).toBeGreaterThan(0.7);
      expect(result.whyRelevant).toContain('Direct entity subject');
      expect(result.whyRelevant).toContain('Verified fresh');
    });

    it('penalizes stale memories with low freshness scores', () => {
      const freshResult = ContextRelevanceScorer.calculateRelevance({
        semanticScore: 0.8,
        isDirectSubjectMatch: false,
        freshnessScore: 1.0,
        importance: 0.8,
        confidence: 0.9,
      });

      const staleResult = ContextRelevanceScorer.calculateRelevance({
        semanticScore: 0.8,
        isDirectSubjectMatch: false,
        freshnessScore: 0.2, // Decayed past TTL
        importance: 0.8,
        confidence: 0.9,
      });

      expect(freshResult.score).toBeGreaterThan(staleResult.score);
      expect(staleResult.whyRelevant).toContain('Temporal decay warning');
    });

    it('rewards close graph proximity over distant relationships', () => {
      const hop1 = ContextRelevanceScorer.calculateRelevance({
        semanticScore: 0.6,
        isDirectSubjectMatch: false,
        graphHops: 1,
        freshnessScore: 0.9,
        importance: 0.8,
        confidence: 0.8,
      });

      const hop3 = ContextRelevanceScorer.calculateRelevance({
        semanticScore: 0.6,
        isDirectSubjectMatch: false,
        graphHops: 3,
        freshnessScore: 0.9,
        importance: 0.8,
        confidence: 0.8,
      });

      expect(hop1.score).toBeGreaterThan(hop3.score);
    });
  });

  describe('ContextBudgetManager', () => {
    const createMockItems = () => {
      const conflicts: ContextConflictWarning[] = [
        {
          id: 'cnf_1',
          summary: 'Price disagreement on pilot',
          conflictType: 'contradiction',
          severity: 'high',
          opposingAspects: ['Pricing'],
          memoryIdA: 'm1',
          memoryIdB: 'm2',
          evidenceQuoteA: 'Quoted GHS 50,000',
          evidenceQuoteB: 'Offered GHS 30,000',
          resolutionStatus: 'unresolved',
        },
      ];

      const structuredFacts: ContextFact[] = [
        { id: 'f1', key: 'type', label: 'Category', value: 'Private School', confidence: 1, tier: 'tier1_critical' },
        { id: 'f2', key: 'students', label: 'Student Count', value: 650, confidence: 0.9, tier: 'tier3_supporting' },
      ];

      const openActions: ContextAction[] = [
        { id: 'a1', title: 'Schedule meeting with Principal', status: 'pending', priority: 'urgent', tier: 'tier1_critical' },
        { id: 'a2', title: 'Send general brochure', status: 'pending', priority: 'low', tier: 'tier3_supporting' },
      ];

      const memories: ContextMemory[] = [
        {
          id: 'mem_high',
          memory: {
            id: 'mem_high',
            workspaceId: 'ws_1',
            organizationId: 'org_1',
            type: 'decision',
            content: 'Approved implementation timeline starting next semester.',
            source: { type: 'user_note', sourceId: 'n1' },
            subjectRefs: { entityIds: [] },
            topics: [],
            entities: [],
            importance: 0.9,
            confidence: 0.95,
            verification: 'user_confirmed',
            visibility: { scope: 'workspace' },
            lifecycle: { status: 'normalized' },
            provenance: { createdBy: 'agent', userId: 'usr_1' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          relevanceScore: 0.85,
          effectiveScore: 0.82,
          freshness: { memoryId: 'mem_high', freshnessScore: 0.95, isStale: false, ttlDays: 365, daysRemaining: 340, lastConfirmedAt: new Date().toISOString(), category: 'decision' },
          tier: 'tier2_relevant',
          whyRelevant: 'Direct entity match',
          citationId: 'cit_1',
        },
        {
          id: 'mem_low',
          memory: {
            id: 'mem_low',
            workspaceId: 'ws_1',
            organizationId: 'org_1',
            type: 'insight',
            content: 'Mentioned general interest in sports day sponsorship in passing.',
            source: { type: 'user_note', sourceId: 'n2' },
            subjectRefs: { entityIds: [] },
            topics: [],
            entities: [],
            importance: 0.4,
            confidence: 0.6,
            verification: 'user_confirmed',
            visibility: { scope: 'workspace' },
            lifecycle: { status: 'normalized' },
            provenance: { createdBy: 'agent', userId: 'usr_1' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          relevanceScore: 0.35,
          effectiveScore: 0.3,
          freshness: { memoryId: 'mem_low', freshnessScore: 0.8, isStale: false, ttlDays: 180, daysRemaining: 150, lastConfirmedAt: new Date().toISOString(), category: 'insight' },
          tier: 'tier4_discoverable',
          whyRelevant: 'Low peripheral mention',
          citationId: 'cit_2',
        },
      ];

      const relationships: ContextRelationship[] = [
        { id: 'rel_1', sourceNodeId: 'ent_1', targetNodeId: 'usr_1', targetNodeName: 'Principal', targetNodeType: 'person', relationshipType: 'DECIDED', hops: 1, tier: 'tier2_relevant' },
        { id: 'rel_3', sourceNodeId: 'ent_1', targetNodeId: 'ven_1', targetNodeName: 'Catering Vendor', targetNodeType: 'entity', relationshipType: 'RELATES_TO', hops: 3, tier: 'tier4_discoverable' },
      ];

      const recentActivity: ContextEvent[] = [
        { id: 'ev_1', eventType: 'meeting', timestamp: new Date().toISOString(), summary: 'Discussed term schedule', tier: 'tier3_supporting' },
      ];

      const relevantKnowledge: ContextKnowledge[] = [
        { id: 'kn_1', insight: 'Implementation speed is critical for adoption', confidence: 0.9, occurrences: 4, theme: 'Speed', tier: 'tier2_relevant' },
      ];

      return {
        structuredFacts,
        memories,
        relationships,
        recentActivity,
        openActions,
        relevantKnowledge,
        conflicts,
      };
    };

    it('allocates budget and prioritizes Tier 1 critical items', () => {
      const items = createMockItems();
      const result = ContextBudgetManager.allocateBudget(items, 4000);

      expect(result.tokenBudget.totalTokens).toBeGreaterThan(0);
      expect(result.tokenBudget.totalTokens).toBeLessThanOrEqual(4000);
      expect(result.tokenBudget.tierBreakdown.tier1Critical).toBeGreaterThan(0);
      expect(result.budgetedItems.conflicts.length).toBe(1);
      expect(result.budgetedItems.structuredFacts.some((f) => f.tier === 'tier1_critical')).toBe(true);
    });

    it('enforces strict token ceiling and truncates lower tiers when budget is small', () => {
      const items = createMockItems();
      // Tight budget of 500 tokens
      const result = ContextBudgetManager.allocateBudget(items, 500);

      expect(result.tokenBudget.totalTokens).toBeLessThanOrEqual(500);
      // Critical items must still be preserved
      expect(result.budgetedItems.conflicts.length).toBe(1);
    });
  });

  describe('generateContextDossierDeterministic', () => {
    it('generates a structured executive briefing and flags contradictions', () => {
      const brief = generateContextDossierDeterministic({
        subjectName: 'Apex International School',
        subjectType: 'entity',
        category: 'Private K-12',
        dealValue: 120000,
        facts: ['Category: Private K-12', 'Active Deal: GHS 120,000'],
        memories: ['Signed letter of intent for 650 students'],
        openActions: ['Submit deployment plan by Friday'],
        activeConflicts: ['Fee quote discrepancy between MD and Bursar'],
        citationCount: 4,
      });

      expect(brief.executiveSummary).toContain('Apex International School');
      expect(brief.executiveSummary).toContain('120,000');
      expect(brief.executiveSummary).toContain('active contradiction dispute');
      expect(brief.commercialOutlook).toContain('GHS 120,000');
      expect(brief.concernsAndRisks.length).toBeGreaterThan(0);
      expect(brief.concernsAndRisks[0]).toContain('Fee quote discrepancy');
      expect(brief.strategicRecommendations.length).toBeGreaterThan(0);
      expect(brief.confidenceScore).toBe(0.9);
    });
  });
});
