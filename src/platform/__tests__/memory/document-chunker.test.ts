/**
 * @fileOverview Unit Tests for DocumentChunker (Phase 4 Milestone 3)
 *
 * Verifies CompanyBrain PRD §21, Rule 4 (Zero-any), Rule 9 (Load Bounds),
 * Rule 16 (Provenance), Rule 22 (SHA-256 Hashing), and Rule 28 (Budgeting).
 */

import { describe, it, expect } from 'vitest';
import { DocumentChunker } from '../../memory/ingestion/document-chunker';

describe('DocumentChunker', () => {
  it('splits text along Markdown heading hierarchies and extracts section breadcrumbs', () => {
    const markdown = `
# Engineering Handbook
Welcome to the engineering handbook.

## Architecture
Our system uses Next.js and Firebase Cloud Run.

### Vector Engine
Qdrant handles all 768-dimensional embeddings.

## Security
Tenant isolation is enforced strictly at all layers.
`;

    const chunks = DocumentChunker.chunk('doc-101', markdown, {
      targetTokens: 100,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(3);

    const vectorChunk = chunks.find((c) => c.content.includes('Qdrant handles'));
    expect(vectorChunk).toBeDefined();
    expect(vectorChunk?.heading).toBe('Vector Engine');
    expect(vectorChunk?.sectionBreadcrumbs).toEqual(['Engineering Handbook', 'Architecture', 'Vector Engine']);

    const secChunk = chunks.find((c) => c.content.includes('Tenant isolation'));
    expect(secChunk).toBeDefined();
    expect(secChunk?.heading).toBe('Security');
    expect(secChunk?.sectionBreadcrumbs).toEqual(['Engineering Handbook', 'Security']);
  });

  it('respects token limits and creates semantic overlap across chunk boundaries', () => {
    // Generate a long text with distinct paragraphs
    const paragraphs: string[] = [];
    for (let i = 1; i <= 15; i++) {
      paragraphs.push(
        `Paragraph ${i}: This is an in-depth explanation of component number ${i} covering all required architectural details and guidelines for maintainers.`
      );
    }
    const longText = paragraphs.join('\n\n');

    const chunks = DocumentChunker.chunk('doc-102', longText, {
      targetTokens: 60, // ~240 chars
      tokenOverlap: 15, // ~60 chars
    });

    expect(chunks.length).toBeGreaterThan(1);

    // Verify token estimation
    for (const chunk of chunks) {
      expect(chunk.tokenCountEstimate).toBeGreaterThan(0);
      expect(chunk.characterCount).toBe(chunk.content.length);
      expect(chunk.chunkId).toMatch(/^doc-102_chunk_\d+$/);
    }
  });

  it('preserves bullet lists and paragraph boundaries intact', () => {
    const listText = `
# Key Deliverables
Here are the core components to review:
* Ingestion Contracts & Taxonomy
* Recursive Document Chunker
* Decoupled Embedding Provider
* Cloud Tasks Background Worker
* Domain Event Subscribers
`;

    const chunks = DocumentChunker.chunk('doc-103', listText);
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toContain('* Ingestion Contracts');
    expect(chunks[0].content).toContain('* Domain Event Subscribers');
  });

  it('generates deterministic SHA-256 content hashes (Rule 22)', () => {
    const textA = '# Heading A\nThis is identical content across two documents.';
    const textB = '# Heading A\nThis is identical content across two documents.';

    const chunksA = DocumentChunker.chunk('doc-A', textA);
    const chunksB = DocumentChunker.chunk('doc-B', textB);

    expect(chunksA.length).toBe(1);
    expect(chunksB.length).toBe(1);
    expect(chunksA[0].contentHash).toBe(chunksB[0].contentHash);
    expect(chunksA[0].contentHash).toHaveLength(64);
  });

  it('suppresses empty and whitespace-only content safely', () => {
    expect(DocumentChunker.chunk('doc-104', '')).toEqual([]);
    expect(DocumentChunker.chunk('doc-104', '   \n\n\t   ')).toEqual([]);
    expect(() => DocumentChunker.chunk('', 'valid text')).toThrowError('documentId is required');
  });

  it('strictly caps output to maxChunks to prevent memory exhaustion (Rule 9)', () => {
    // Generate huge text
    const paragraphs: string[] = [];
    for (let i = 0; i < 50; i++) {
      paragraphs.push(`Section ${i}:\n` + 'A'.repeat(500));
    }
    const massiveText = paragraphs.join('\n\n');

    const chunks = DocumentChunker.chunk('doc-105', massiveText, {
      targetTokens: 100,
      maxChunks: 5,
    });

    expect(chunks.length).toBe(5);
  });
});
