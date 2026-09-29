/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Strict domain schema validation unit tests for Phase 5 (AI Document Intelligence).
 *    Validates field detection geometry, grounded Q&A citations, semantic redline ASTs,
 *    candidate obligations, and audit governance logging contracts.
 * 2. Invariants Tested:
 *    - Normalized percentage coordinate bounding ([0, 100]).
 *    - Citation grounding completeness (pageNumber >= 1, non-empty excerpt).
 *    - Semantic diff change categorization ('added', 'removed', 'modified').
 *    - Candidate obligation review state machine ('review_required', 'approved', 'rejected').
 *    - AI governance log auditing (taskType, modelName, tokenUsage).
 *    - Zero-tolerance typing (Rule 4).
 */

import { describe, it, expect } from 'vitest';
import {
  AiFieldSuggestionSchema,
  AiDocumentQaCitationSchema,
  AiDocumentQaRequestSchema,
  AiDocumentQaResponseSchema,
  SemanticClauseDiffItemSchema,
  SemanticClauseDiffSchema,
  AiObligationCandidateSchema,
  DocumentAiAnalysisLogSchema,
} from '@/lib/types/document-signing';

describe('Phase 5 AI Document Intelligence Domain Schemas (P5.1 - P5.5)', () => {
  describe('AiFieldSuggestionSchema (P5.1 Field Detection & Geometry)', () => {
    it('validates a correct field suggestion with normalized percentage coordinates', () => {
      const valid = {
        id: 'sug_sig_1',
        pageNumber: 3,
        fieldType: 'signature',
        label: 'Client Signature',
        recipientRole: 'signer',
        confidence: 0.96,
        leftPct: 20.5,
        topPct: 75.0,
        widthPct: 30.0,
        heightPct: 8.5,
        sourceExcerpt: 'IN WITNESS WHEREOF, the parties have executed...',
        accepted: false,
      };

      const result = AiFieldSuggestionSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fieldType).toBe('signature');
        expect(result.data.leftPct).toBe(20.5);
      }
    });

    it('rejects field suggestions with invalid coordinate percentages outside [0, 100]', () => {
      const invalid = {
        id: 'sug_sig_err',
        pageNumber: 1,
        fieldType: 'signature',
        label: 'Signature',
        recipientRole: 'signer',
        confidence: 0.9,
        leftPct: -5, // Invalid negative
        topPct: 105, // Invalid > 100
        widthPct: 20,
        heightPct: 10,
      };

      const result = AiFieldSuggestionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects field suggestions with invalid page numbers (< 1)', () => {
      const invalid = {
        id: 'sug_sig_0',
        pageNumber: 0,
        fieldType: 'date',
        label: 'Execution Date',
        recipientRole: 'signer',
        confidence: 0.85,
        leftPct: 10,
        topPct: 10,
        widthPct: 20,
        heightPct: 5,
      };

      const result = AiFieldSuggestionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('AiDocumentQaCitationSchema & Response (P5.3 Grounded Q&A)', () => {
    it('validates a grounded citation with positive page number and excerpt snippet', () => {
      const citation = {
        pageNumber: 2,
        textSnippet: 'Payment shall be rendered within 30 days of invoice receipt.',
        score: 0.92,
      };

      const result = AiDocumentQaCitationSchema.safeParse(citation);
      expect(result.success).toBe(true);
    });

    it('validates a complete Q&A response payload', () => {
      const response = {
        answer: 'The contract provides for Net-30 payment terms.',
        citations: [
          {
            pageNumber: 2,
            textSnippet: 'Payment shall be rendered within 30 days of invoice receipt.',
            score: 0.95,
          },
        ],
        confidence: 0.94,
        isSupported: true,
        documentId: 'doc_123',
        documentVersionId: 'ver_1',
        generatedAt: '2026-09-29T10:00:00.000Z',
      };

      const result = AiDocumentQaResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isSupported).toBe(true);
        expect(result.data.citations).toHaveLength(1);
      }
    });

    it('validates a Q&A request payload with workspace scoping', () => {
      const request = {
        workspaceId: 'ws_prod',
        documentId: 'doc_123',
        question: 'What is the governing law of this agreement?',
      };

      const result = AiDocumentQaRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('SemanticClauseDiffSchema (P5.2 Semantic Redlining)', () => {
    it('validates a semantic clause diff item with significance and change summary', () => {
      const item = {
        id: 'diff_item_1',
        clauseTitle: 'Limitation of Liability',
        changeType: 'modified',
        originalText: 'Liability capped at fees paid in prior 12 months.',
        newText: 'Liability capped at $1,000,000.',
        summaryOfChange: 'Liability cap changed from 12-month trailing fees to a fixed $1M ceiling.',
        significance: 'high',
      };

      const result = SemanticClauseDiffItemSchema.safeParse(item);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.changeType).toBe('modified');
        expect(result.data.significance).toBe('high');
      }
    });

    it('validates an entire document semantic redline report', () => {
      const diffReport = {
        documentId: 'doc_enterprise_msa',
        versionA: 'v1.0.0',
        versionB: 'v1.1.0',
        executiveSummary: 'This revision increases the liability cap and updates notice periods from 30 to 60 days.',
        clauses: [
          {
            id: 'cl_1',
            clauseTitle: 'Termination Notice',
            changeType: 'modified',
            originalText: '30 days written notice',
            newText: '60 days written notice',
            summaryOfChange: 'Notice requirement lengthened to 60 days.',
            significance: 'medium',
          },
          {
            id: 'cl_2',
            clauseTitle: 'Data Protection Addendum',
            changeType: 'added',
            newText: 'Supplier agrees to standard contractual clauses under GDPR...',
            summaryOfChange: 'Added GDPR standard contractual clauses.',
            significance: 'high',
          },
        ],
        addedCount: 1,
        removedCount: 0,
        modifiedCount: 1,
        generatedAt: '2026-09-29T10:15:00.000Z',
      };

      const result = SemanticClauseDiffSchema.safeParse(diffReport);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.addedCount).toBe(1);
        expect(result.data.clauses).toHaveLength(2);
      }
    });
  });

  describe('AiObligationCandidateSchema (P5.4 Post-Execution Obligation Detection)', () => {
    it('validates an extracted obligation candidate in review_required status', () => {
      const candidate = {
        id: 'obl_cand_1',
        workspaceId: 'ws_prod',
        contractId: 'ctr_enterprise_1',
        title: 'Submit SOC2 Type II Audit Report',
        description: 'Vendor must provide annual SOC2 Type II compliance audit report within 90 days of fiscal year end.',
        type: 'compliance',
        suggestedDueDate: '2026-12-31T00:00:00.000Z',
        suggestedResponsibleParty: 'internal',
        confidence: 0.91,
        sourcePage: 8,
        sourceExcerpt: 'Section 14.3: Vendor shall provide annual SOC2 Type II reports...',
        status: 'review_required',
        createdAt: '2026-09-29T10:20:00.000Z',
      };

      const result = AiObligationCandidateSchema.safeParse(candidate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('review_required');
        expect(result.data.type).toBe('compliance');
      }
    });

    it('rejects candidate obligations with negative sourcePage', () => {
      const invalid = {
        id: 'obl_cand_bad',
        workspaceId: 'ws_prod',
        contractId: 'ctr_1',
        title: 'Monthly SLA Report',
        description: 'Provide monthly reports',
        type: 'reporting',
        suggestedResponsibleParty: 'internal',
        confidence: 0.88,
        sourcePage: -1,
        sourceExcerpt: 'Report monthly',
        status: 'review_required',
        createdAt: '2026-09-29T10:20:00.000Z',
      };

      const result = AiObligationCandidateSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('DocumentAiAnalysisLogSchema (P5.5 Governance & Telemetry)', () => {
    it('validates an AI execution audit log entry with cost and latency telemetry', () => {
      const log = {
        id: 'ai_log_001',
        workspaceId: 'ws_prod',
        documentId: 'doc_123',
        documentVersionId: 'ver_1',
        taskType: 'qa',
        status: 'succeeded',
        modelProvider: 'google',
        modelName: 'gemini-2.0-flash',
        promptVersionId: 'qa_v2.1',
        inputDigest: 'sha256_input_digest_abc',
        confidence: 0.95,
        latencyMs: 820,
        tokenUsage: {
          promptTokens: 1420,
          completionTokens: 180,
          totalTokens: 1600,
        },
        costUsd: 0.00045,
        createdAt: '2026-09-29T10:25:00.000Z',
      };

      const result = DocumentAiAnalysisLogSchema.safeParse(log);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.taskType).toBe('qa');
        expect(result.data.tokenUsage?.totalTokens).toBe(1600);
      }
    });
  });
});
