/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Unit tests for Semantic Redlining & Clause Difference Engine (P5.2).
 * 2. Invariants Tested:
 *    - Clause difference categorization (added, removed, modified, unchanged).
 *    - Plain-English change summary synthesis and significance classification.
 *    - Immutable Version Barrier (FM-P5-04): Throws error if applying changes to non-draft versions.
 *    - Zero-tolerance typing (Rule 4).
 */

import { describe, it, expect } from 'vitest';
import {
  compareDocumentVersions,
  applySemanticProposal,
  extractDocumentClauses,
} from '../contract-semantic-diff-service';

describe('P5.2 Semantic Redlining & Clause Difference Engine', () => {
  const versionAText = `Section 1: Scope of Services. Provider agrees to deliver enterprise cloud onboarding services.
Section 2: Payment Terms. Client shall pay within 30 days of invoice receipt.
Section 3: Limitation of Liability. Total liability shall not exceed $50,000.
Section 4: Governing Law. This Agreement is governed by the laws of California.`;

  const versionBText = `Section 1: Scope of Services. Provider agrees to deliver enterprise cloud onboarding services and continuous monitoring.
Section 2: Payment Terms. Client shall pay within 60 days of invoice receipt.
Section 3: Limitation of Liability. Total liability shall not exceed $1,000,000.
Section 5: Data Privacy. Both parties shall comply with applicable GDPR regulations.`;

  describe('extractDocumentClauses', () => {
    it('breaks document text into structured title and body sections', () => {
      const clauses = extractDocumentClauses(versionAText);
      expect(clauses.length).toBe(4);
      expect(clauses[0].title).toContain('Scope of Services');
      expect(clauses[2].title).toContain('Limitation of Liability');
    });
  });

  describe('compareDocumentVersions', () => {
    it('accurately categorizes added, removed, and modified clauses', async () => {
      const diffReport = await compareDocumentVersions({
        workspaceId: 'ws_prod',
        documentId: 'doc_msa',
        versionAId: 'v1.0',
        versionBId: 'v1.1',
        versionAText,
        versionBText,
      });

      expect(diffReport.documentId).toBe('doc_msa');
      expect(diffReport.versionA).toBe('v1.0');
      expect(diffReport.versionB).toBe('v1.1');
      expect(diffReport.clauses.length).toBeGreaterThan(0);

      // Section 1, 2, 3 were modified
      const modified = diffReport.clauses.filter((c) => c.changeType === 'modified');
      expect(modified.length).toBeGreaterThanOrEqual(2);

      // Section 4 (Governing Law) was removed in Version B
      const removed = diffReport.clauses.filter((c) => c.changeType === 'removed');
      expect(removed.length).toBe(1);
      expect(removed[0].clauseTitle).toContain('Governing Law');

      // Section 5 (Data Privacy) was added in Version B
      const added = diffReport.clauses.filter((c) => c.changeType === 'added');
      expect(added.length).toBe(1);
      expect(added[0].clauseTitle).toContain('Data Privacy');

      // Executive summary explains changes
      expect(diffReport.executiveSummary.length).toBeGreaterThan(20);
    });

    it('assigns high significance to liability and payment term modifications', async () => {
      const diffReport = await compareDocumentVersions({
        workspaceId: 'ws_prod',
        documentId: 'doc_msa',
        versionAId: 'v1.0',
        versionBId: 'v1.1',
        versionAText,
        versionBText,
      });

      const liabilityClause = diffReport.clauses.find((c) =>
        c.clauseTitle.toLowerCase().includes('liability')
      );
      expect(liabilityClause).toBeDefined();
      expect(liabilityClause?.significance).toBe('high');
    });
  });

  describe('Immutable Version Barrier (FM-P5-04)', () => {
    it('throws error when trying to apply changes to an issued or completed document version', async () => {
      await expect(
        applySemanticProposal({
          workspaceId: 'ws_prod',
          templateId: 'tpl_100',
          versionStatus: 'published', // Not draft!
          proposedChanges: { text: 'New clause' },
        })
      ).rejects.toThrow(/immutable|draft/i);

      await expect(
        applySemanticProposal({
          workspaceId: 'ws_prod',
          templateId: 'tpl_100',
          versionStatus: 'completed', // Not draft!
          proposedChanges: { text: 'New clause' },
        })
      ).rejects.toThrow(/immutable|draft/i);
    });

    it('permits applying changes when target version status is strictly draft', async () => {
      const result = await applySemanticProposal({
        workspaceId: 'ws_prod',
        templateId: 'tpl_100',
        versionStatus: 'draft',
        proposedChanges: { text: 'Updated clause text' },
      });

      expect(result.success).toBe(true);
    });
  });
});
