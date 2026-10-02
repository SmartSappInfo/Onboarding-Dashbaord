/**
 * @fileOverview Recursive Token-Aware Document Chunker (Phase 4 Milestone 3)
 *
 * Implements CompanyBrain PRD §21, Rule 4 (Zero-any), Rule 9 (Load Governance),
 * Rule 10 (Inline Architectural Docs), Rule 16 (Provenance Tracking),
 * Rule 22 (SHA-256 Content Hashing), and Rule 28 (Context Budgeting).
 *
 * ALGORITHMIC STRATEGY:
 * 1. Preserves hierarchical document structure by tracking Markdown headings
 *    (#, ##, ###, ####) and building semantic breadcrumbs.
 * 2. Recursively divides large sections along natural semantic breaks:
 *    paragraphs (\n\n) -> list items / lines (\n) -> sentences (. ! ?).
 * 3. Enforces bounded token sizing (target 500 tokens / ~2,000 chars) with
 *    50 tokens (~200 chars) overlap to prevent contextual disconnect.
 * 4. Generates deterministic chunk IDs and SHA-256 content hashes for deduplication.
 *
 * @testability Covered in `src/platform/__tests__/memory/document-chunker.test.ts`.
 */

import { createHash } from 'node:crypto';
import {
  ChunkingOptionsSchema,
  type ChunkingOptions,
  type DocumentChunk,
} from './ingestion-types';

interface SectionBlock {
  heading?: string;
  breadcrumbs: string[];
  content: string;
}

export class DocumentChunker {
  private static readonly CHARS_PER_TOKEN = 4.0;

  /**
   * Computes a deterministic SHA-256 content hash for chunk deduplication.
   */
  public static hashChunkContent(content: string, heading?: string): string {
    const normalized = (heading ? `${heading}\n` : '') + content.trim().toLowerCase();
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Splits text into bounded, token-aware semantic chunks.
   */
  public static chunk(
    documentId: string,
    text: string,
    options: Partial<ChunkingOptions> = {}
  ): DocumentChunk[] {
    const cleanDocId = (documentId || '').trim();
    if (!cleanDocId) {
      throw new Error('documentId is required for chunking');
    }

    const cleanText = (text || '').trim();
    if (!cleanText) {
      return [];
    }

    const parsedOptions = ChunkingOptionsSchema.parse(options);
    const targetChars = Math.round(parsedOptions.targetTokens * this.CHARS_PER_TOKEN);
    const overlapChars = Math.round(parsedOptions.tokenOverlap * this.CHARS_PER_TOKEN);

    // 1. Parse document into hierarchical sections by Markdown headings
    const sections = this.parseSections(cleanText, parsedOptions.preserveHeadings);

    // 2. Subdivide large sections into bounded units with overlap
    const chunks: DocumentChunk[] = [];
    let position = 0;

    for (const section of sections) {
      const sectionChunks = this.chunkSection(
        cleanDocId,
        section,
        targetChars,
        overlapChars,
        position
      );

      for (const sc of sectionChunks) {
        if (chunks.length >= parsedOptions.maxChunks) {
          console.warn(
            `[DocumentChunker] Document ${cleanDocId} exceeded maxChunks (${parsedOptions.maxChunks}). Truncating further chunks.`
          );
          return chunks;
        }
        chunks.push(sc);
        position++;
      }
    }

    return chunks;
  }

  /**
   * Parses text into section blocks according to Markdown headings.
   */
  private static parseSections(text: string, preserveHeadings: boolean): SectionBlock[] {
    const lines = text.split('\n');
    const sections: SectionBlock[] = [];
    const currentBreadcrumbs: string[] = [];

    let currentHeading: string | undefined = undefined;
    let currentLines: string[] = [];

    const flushCurrent = () => {
      const content = currentLines.join('\n').trim();
      if (content) {
        sections.push({
          heading: currentHeading,
          breadcrumbs: [...currentBreadcrumbs],
          content,
        });
      }
      currentLines = [];
    };

    const headingRegex = /^(#{1,4})\s+(.+)$/;

    for (const line of lines) {
      const match = line.match(headingRegex);
      if (match && preserveHeadings) {
        flushCurrent();

        const level = match[1].length;
        const title = match[2].trim();

        // Adjust breadcrumb hierarchy
        currentBreadcrumbs.splice(level - 1);
        currentBreadcrumbs[level - 1] = title;
        currentHeading = title;
      } else {
        currentLines.push(line);
      }
    }

    flushCurrent();

    // If no headings found, return entire document as one section
    if (sections.length === 0 && text.trim().length > 0) {
      sections.push({
        breadcrumbs: [],
        content: text.trim(),
      });
    }

    return sections;
  }

  /**
   * Recursively chunks a single section along semantic boundaries.
   */
  private static chunkSection(
    docId: string,
    section: SectionBlock,
    targetChars: number,
    overlapChars: number,
    startPosition: number
  ): DocumentChunk[] {
    const content = section.content.trim();
    if (!content) return [];

    // If small enough, emit as a single chunk
    if (content.length <= targetChars) {
      const chunkId = `${docId}_chunk_${startPosition}`;
      return [
        {
          chunkId,
          position: startPosition,
          content,
          characterCount: content.length,
          tokenCountEstimate: Math.ceil(content.length / this.CHARS_PER_TOKEN),
          heading: section.heading,
          sectionBreadcrumbs: section.breadcrumbs,
          contentHash: this.hashChunkContent(content, section.heading),
        },
      ];
    }

    // Split section into atomic semantic units (paragraphs -> lists -> sentences)
    const atomicUnits = this.splitIntoAtomicUnits(content, targetChars);
    const result: DocumentChunk[] = [];
    let currentPosition = startPosition;

    let currentBuffer = '';

    for (let i = 0; i < atomicUnits.length; i++) {
      const unit = atomicUnits[i];

      if (currentBuffer.length + unit.length + 1 > targetChars && currentBuffer.length > 0) {
        // Emit current buffer
        const chunkContent = currentBuffer.trim();
        if (chunkContent.length >= 10) {
          const chunkId = `${docId}_chunk_${currentPosition}`;
          result.push({
            chunkId,
            position: currentPosition,
            content: chunkContent,
            characterCount: chunkContent.length,
            tokenCountEstimate: Math.ceil(chunkContent.length / this.CHARS_PER_TOKEN),
            heading: section.heading,
            sectionBreadcrumbs: section.breadcrumbs,
            contentHash: this.hashChunkContent(chunkContent, section.heading),
          });
          currentPosition++;
        }

        // Calculate overlap tail from currentBuffer
        if (overlapChars > 0 && currentBuffer.length > overlapChars) {
          const tail = currentBuffer.slice(-overlapChars).trim();
          currentBuffer = tail ? `${tail} ${unit}` : unit;
        } else {
          currentBuffer = unit;
        }
      } else {
        currentBuffer = currentBuffer ? `${currentBuffer}\n\n${unit}` : unit;
      }
    }

    // Flush residual buffer
    const finalContent = currentBuffer.trim();
    if (finalContent.length >= 10) {
      const chunkId = `${docId}_chunk_${currentPosition}`;
      result.push({
        chunkId,
        position: currentPosition,
        content: finalContent,
        characterCount: finalContent.length,
        tokenCountEstimate: Math.ceil(finalContent.length / this.CHARS_PER_TOKEN),
        heading: section.heading,
        sectionBreadcrumbs: section.breadcrumbs,
        contentHash: this.hashChunkContent(finalContent, section.heading),
      });
    }

    return result;
  }

  /**
   * Deconstructs content into semantic fragments: paragraphs, bullet points, or sentences.
   */
  private static splitIntoAtomicUnits(text: string, targetChars: number): string[] {
    const rawParagraphs = text.split(/\n\s*\n/);
    const units: string[] = [];

    for (const para of rawParagraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if (trimmed.length <= targetChars) {
        units.push(trimmed);
      } else {
        // Subdivide paragraph by bullet points or lines
        const lines = trimmed.split('\n');
        let lineBuffer = '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;

          if (cleanLine.length > targetChars) {
            // Subdivide long line by sentences
            if (lineBuffer) {
              units.push(lineBuffer.trim());
              lineBuffer = '';
            }
            const sentences = cleanLine.split(/(?<=[.!?])\s+/);
            for (const sent of sentences) {
              const cleanSent = sent.trim();
              if (cleanSent) units.push(cleanSent);
            }
          } else if (lineBuffer.length + cleanLine.length + 1 > targetChars) {
            units.push(lineBuffer.trim());
            lineBuffer = cleanLine;
          } else {
            lineBuffer = lineBuffer ? `${lineBuffer}\n${cleanLine}` : cleanLine;
          }
        }

        if (lineBuffer.trim()) {
          units.push(lineBuffer.trim());
        }
      }
    }

    return units;
  }
}
