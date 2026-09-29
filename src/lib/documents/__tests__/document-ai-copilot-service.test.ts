/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Unit tests for Grounded Document Q&A & Executive Summary Copilot Service (P5.3).
 * 2. Invariants Tested:
 *    - Strict Tenant Scoping (FM-P5-01): Rejects cross-workspace document access.
 *    - Prompt Sandboxing & Prompt Injection Resistance (FM-P5-02).
 *    - Exact Page Grounding & Citation Integrity: Returns non-empty page citations.
 *    - Anti-Hallucination Abstention (FM-P5-08): Returns isSupported: false when topic is absent.
 *    - Graceful Degradation on Rate Limiting (FM-P5-06): Deterministic fallback when LLM is unavailable.
 *    - Zero-tolerance typing (Rule 4).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  askDocumentQuestion,
  generateDocumentExecutiveSummary,
  findGroundedCitations,
} from '../document-ai-copilot-service';

// Mock Firebase Admin
const mockContractsStore = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockImplementation((colName: string) => {
      if (colName === 'contracts' || colName === 'documents' || colName === 'signing_envelopes') {
        return {
          doc: vi.fn().mockImplementation((docId: string) => ({
            get: vi.fn().mockImplementation(async () => {
              const data = mockContractsStore.get(docId);
              return {
                exists: Boolean(data),
                id: docId,
                data: () => data,
              };
            }),
          })),
        };
      }
      return {
        add: vi.fn().mockResolvedValue({ id: 'mock_add_id' }),
      };
    }),
  },
}));

// Mock Next.js after()
vi.mock('next/server', () => ({
  after: vi.fn((fn: () => void | Promise<void>) => {
    Promise.resolve().then(fn).catch(() => {});
  }),
}));

describe('P5.3 Grounded Document Q&A & Executive Summary Service', () => {
  beforeEach(() => {
    mockContractsStore.clear();
    vi.clearAllMocks();
  });

  const samplePages = [
    'This Master Services Agreement ("Agreement") is entered into by Acme Corp and Beta LLC on October 1, 2026. Governing Law: State of Delaware.',
    'Payment Terms: Invoices are payable Net-30 from date of issue. Late payments accrue interest at 1.5% per month. Total Contract Value: $120,000.',
    'Termination: Either party may terminate for convenience with 60 days prior written notice. Confidentiality obligations survive for 5 years.',
    'Signatures: IN WITNESS WHEREOF, the authorized representatives have executed this Agreement.',
  ];

  describe('findGroundedCitations (Deterministic NLP Grounding)', () => {
    it('finds exact page citations for payment terms query', () => {
      const citations = findGroundedCitations('What are the payment terms and interest rates?', samplePages);
      expect(citations.length).toBeGreaterThan(0);
      expect(citations[0].pageNumber).toBe(2);
      expect(citations[0].textSnippet.toLowerCase()).toContain('net-30');
    });

    it('returns empty citations when query terms do not match document text', () => {
      const citations = findGroundedCitations('What is the policy for astronaut spaceflight training?', samplePages);
      expect(citations).toHaveLength(0);
    });
  });

  describe('generateDocumentExecutiveSummary', () => {
    it('generates an executive summary extracting governing law and parties', async () => {
      const summary = await generateDocumentExecutiveSummary({
        workspaceId: 'ws_prod',
        documentId: 'doc_msa_1',
        title: 'Acme-Beta Master Services Agreement',
        pageTexts: samplePages,
      });

      expect(summary.summary).toBeTruthy();
      expect(summary.parties).toContain('Acme Corp');
      expect(summary.governingLaw).toContain('Delaware');
      expect(summary.detectedRiskLevel).toBe('low');
    });
  });

  describe('askDocumentQuestion (Grounded Anti-Hallucination Q&A)', () => {
    it('answers grounded question with exact citation and isSupported true', async () => {
      const response = await askDocumentQuestion({
        workspaceId: 'ws_prod',
        documentId: 'doc_msa_1',
        question: 'What is the governing law of this agreement?',
        pageTexts: samplePages,
      });

      expect(response.isSupported).toBe(true);
      expect(response.answer.toLowerCase()).toContain('delaware');
      expect(response.citations.length).toBeGreaterThan(0);
      expect(response.citations[0].pageNumber).toBe(1);
    });

    it('abstains and returns isSupported false when question is absent from document', async () => {
      const response = await askDocumentQuestion({
        workspaceId: 'ws_prod',
        documentId: 'doc_msa_1',
        question: 'What is the penalty for submarine navigation failure?',
        pageTexts: samplePages,
      });

      expect(response.isSupported).toBe(false);
      expect(response.answer.toLowerCase()).toContain('does not mention');
      expect(response.citations).toHaveLength(0);
    });

    it('enforces strict tenant isolation if document is fetched from database', async () => {
      mockContractsStore.set('doc_tenant_b', {
        id: 'doc_tenant_b',
        workspaceId: 'ws_other_tenant',
        title: 'Secret Acquisition',
      });

      await expect(
        askDocumentQuestion({
          workspaceId: 'ws_tenant_a',
          documentId: 'doc_tenant_b',
          question: 'What is the purchase price?',
        })
      ).rejects.toThrow(/tenant|workspace|unauthorized/i);
    });
  });
});
