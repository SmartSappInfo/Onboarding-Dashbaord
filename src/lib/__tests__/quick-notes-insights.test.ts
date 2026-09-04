import { describe, it, expect } from 'vitest';
import {
  detectLexicalDuplicates,
  evaluateContradictionConfidence,
  calculateInsightScore,
  filterInboxItems,
  filterInsights,
  mergeKnowledgeObjects,
  getInboxTypeDisplayLabel,
  getInsightSeverityDisplayLabel,
  getInsightTypeDisplayLabel,
} from '../quick-notes-domain';
import type {
  KnowledgeInboxItem,
  KnowledgeInsight,
  NoteDocument,
} from '../quick-notes-types';

describe('Phase 7: Knowledge Inbox & Insights Pure Domain Logic', () => {
  describe('detectLexicalDuplicates', () => {
    it('detects near-identical notes as duplicates with high similarity score', () => {
      const textA = 'Schools repeatedly request automated fee reminders via WhatsApp to improve revenue collection.';
      const textB = 'Schools repeatedly request automated fee reminders via WhatsApp to improve revenue collection for next term.';

      const result = detectLexicalDuplicates(textA, textB, 0.75);
      expect(result.isDuplicate).toBe(true);
      expect(result.similarityScore).toBeGreaterThanOrEqual(0.75);
      expect(result.overlappingTerms).toContain('schools');
      expect(result.overlappingTerms).toContain('whatsapp');
    });

    it('rejects unrelated text as not duplicate', () => {
      const textA = 'Quarterly financial board meeting minutes covering payroll expenditures.';
      const textB = 'New playground equipment vendor selection and safety compliance audit.';

      const result = detectLexicalDuplicates(textA, textB, 0.70);
      expect(result.isDuplicate).toBe(false);
      expect(result.similarityScore).toBeLessThan(0.30);
    });

    it('handles empty or blank strings safely without crashing', () => {
      const result = detectLexicalDuplicates('', 'Some text', 0.8);
      expect(result.isDuplicate).toBe(false);
      expect(result.similarityScore).toBe(0);
      expect(result.overlappingTerms).toEqual([]);
    });
  });

  describe('evaluateContradictionConfidence', () => {
    it('scores higher confidence when supported by multiple evidence sources', () => {
      const thesis = 'Schools are satisfied with manual spreadsheet reconciliation.';
      const antithesis = '12 Bursars reported manual spreadsheets cause weekly accounting delays and errors.';

      const scoreLowEvidence = evaluateContradictionConfidence(thesis, antithesis, 0);
      const scoreHighEvidence = evaluateContradictionConfidence(thesis, antithesis, 6);

      expect(scoreHighEvidence).toBeGreaterThan(scoreLowEvidence);
      expect(scoreHighEvidence).toBeGreaterThanOrEqual(0.85);
    });

    it('returns minimal confidence on stub text', () => {
      const score = evaluateContradictionConfidence('No', 'Yes', 0);
      expect(score).toBeLessThanOrEqual(0.5);
    });
  });

  describe('calculateInsightScore', () => {
    it('prioritizes critical and high severity insights with substantial evidence', () => {
      const criticalInsight: KnowledgeInsight = {
        id: 'ins-1',
        workspaceId: 'ws-test',
        type: 'risk',
        severity: 'critical',
        title: 'Payment Gateway Outage in Term 3',
        summary: 'Multiple schools experienced failed transactions.',
        evidenceCount: 8,
        evidenceSources: [],
        suggestedActions: [],
        status: 'active',
        createdBy: 'ai_agent:insight',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };

      const lowInsight: KnowledgeInsight = {
        id: 'ins-2',
        workspaceId: 'ws-test',
        type: 'trend',
        severity: 'low',
        title: 'Slight preference for blue uniforms',
        summary: 'A few parents mentioned colors.',
        evidenceCount: 1,
        evidenceSources: [],
        suggestedActions: [],
        status: 'active',
        createdBy: 'ai_agent:insight',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      };

      const scoreCrit = calculateInsightScore(criticalInsight);
      const scoreLow = calculateInsightScore(lowInsight);

      expect(scoreCrit).toBeGreaterThan(scoreLow);
      expect(scoreCrit).toBeGreaterThanOrEqual(125);
    });
  });

  describe('filterInboxItems', () => {
    const sampleItems: KnowledgeInboxItem[] = [
      {
        id: 'item-1',
        workspaceId: 'ws-1',
        type: 'duplicate_detection',
        status: 'pending',
        title: 'Potential Duplicate: WhatsApp reminders',
        description: 'Two similar notes detected',
        sourceKnowledgeId: 'note-1',
        confidence: 0.92,
        evidence: [],
        createdBy: 'ai_agent:governance',
        createdAt: '2026-09-02T10:00:00Z',
        updatedAt: '2026-09-02T10:00:00Z',
      },
      {
        id: 'item-2',
        workspaceId: 'ws-1',
        type: 'contradiction_detection',
        status: 'accepted',
        title: 'Contradiction: Fee Schedule agreement',
        description: 'Conflicting dates found in call logs',
        sourceKnowledgeId: 'note-2',
        confidence: 0.88,
        evidence: [],
        createdBy: 'ai_agent:governance',
        createdAt: '2026-09-03T10:00:00Z',
        updatedAt: '2026-09-03T10:00:00Z',
      },
      {
        id: 'item-3',
        workspaceId: 'ws-1',
        type: 'link_suggestion',
        status: 'pending',
        title: 'Suggested Link: St Andrews Academy',
        description: 'Associate with customer account',
        sourceKnowledgeId: 'note-3',
        confidence: 0.65,
        evidence: [],
        createdBy: 'ai_agent:governance',
        createdAt: '2026-09-04T10:00:00Z',
        updatedAt: '2026-09-04T10:00:00Z',
      },
    ];

    it('filters correctly by status', () => {
      const pendingOnly = filterInboxItems(sampleItems, { status: 'pending' });
      expect(pendingOnly.length).toBe(2);
      expect(pendingOnly.map((i) => i.id)).toEqual(['item-1', 'item-3']);
    });

    it('filters correctly by item type', () => {
      const duplicatesOnly = filterInboxItems(sampleItems, { type: 'duplicate_detection' });
      expect(duplicatesOnly.length).toBe(1);
      expect(duplicatesOnly[0].id).toBe('item-1');
    });

    it('filters correctly by minimum confidence threshold', () => {
      const highConfidence = filterInboxItems(sampleItems, { minConfidence: 0.85 });
      expect(highConfidence.length).toBe(2);
      expect(highConfidence.map((i) => i.id)).toContain('item-1');
      expect(highConfidence.map((i) => i.id)).toContain('item-2');
    });

    it('filters correctly by search query', () => {
      const searchResults = filterInboxItems(sampleItems, { searchQuery: 'Andrews' });
      expect(searchResults.length).toBe(1);
      expect(searchResults[0].id).toBe('item-3');
    });
  });

  describe('filterInsights', () => {
    const sampleInsights: KnowledgeInsight[] = [
      {
        id: 'ins-1',
        workspaceId: 'ws-1',
        type: 'recurring_problem',
        severity: 'critical',
        title: 'SMS Delivery Failures across MTN Network',
        summary: 'High delivery dropoff in Volta region.',
        evidenceCount: 12,
        evidenceSources: [],
        suggestedActions: [],
        status: 'active',
        createdBy: 'ai_agent:insight',
        createdAt: '2026-09-01T10:00:00Z',
        updatedAt: '2026-09-01T10:00:00Z',
      },
      {
        id: 'ins-2',
        workspaceId: 'ws-1',
        type: 'opportunity',
        severity: 'high',
        title: 'High Demand for Biometric Attendance',
        summary: '5 private schools requested hardware quotes.',
        evidenceCount: 5,
        evidenceSources: [],
        suggestedActions: [],
        status: 'resolved',
        createdBy: 'ai_agent:insight',
        createdAt: '2026-09-02T10:00:00Z',
        updatedAt: '2026-09-02T10:00:00Z',
      },
    ];

    it('filters by status and severity', () => {
      const activeCritical = filterInsights(sampleInsights, { status: 'active', severity: 'critical' });
      expect(activeCritical.length).toBe(1);
      expect(activeCritical[0].id).toBe('ins-1');
    });
  });

  describe('mergeKnowledgeObjects', () => {
    it('concatenates two TipTap docs with a horizontal rule separator', () => {
      const docA: NoteDocument = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note A Content' }] }],
      };
      const docB: NoteDocument = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note B Content' }] }],
      };

      const merged = mergeKnowledgeObjects(docB, docA, 'concatenate');
      expect(merged.content?.length).toBe(3);
      expect(merged.content?.[0]).toEqual(docA.content?.[0]);
      expect(merged.content?.[1]).toEqual({ type: 'horizontalRule' });
      expect(merged.content?.[2]).toEqual(docB.content?.[0]);
    });
  });

  describe('display formatters', () => {
    it('returns descriptive labels and semantic badges', () => {
      expect(getInboxTypeDisplayLabel('duplicate_detection').label).toBe('Potential Duplicate');
      expect(getInsightSeverityDisplayLabel('critical').label).toBe('Critical Severity');
      expect(getInsightTypeDisplayLabel('recurring_problem').label).toBe('Recurring Objection');
    });
  });
});
