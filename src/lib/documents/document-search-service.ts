/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Search & Text Indexing Engine:
 *    Builds lightweight, high-performance inverted indices over extracted document page text
 *    (PRD Sections 24, 37 & 85).
 * 2. Instant In-Reader Keyword Search:
 *    Enables readers to query terms across 100+ pages in sub-10ms with contextual snippet extraction.
 * 3. Mobile & Low-Resource Optimization:
 *    Indices are compact token-to-page mappings that execute in client or edge runtimes without server roundtrips.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

export interface SearchMatchResult {
  pageNumber: number;
  snippet: string;
  matchScore: number;
  highlightWords: string[];
}

export interface DocumentSearchIndex {
  documentId: string;
  versionId: string;
  totalTerms: number;
  invertedIndex: Record<string, number[]>; // term -> pageNumbers[]
  snippetsByPage: Record<number, string>;  // pageNumber -> rawTextPreview
}

const COMMON_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for',
  'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on',
  'that', 'the', 'to', 'was', 'were', 'will', 'with'
]);

/**
 * Tokenizes and normalizes raw text into clean searchable words.
 */
export function tokenizeText(rawText: string): string[] {
  if (!rawText || typeof rawText !== 'string') return [];
  return rawText
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !COMMON_STOP_WORDS.has(word));
}

/**
 * Builds an inverted search index from extracted page texts.
 */
export function buildDocumentSearchIndex(
  documentId: string,
  versionId: string,
  pages: Array<{ pageNumber: number; extractedText?: string }>
): DocumentSearchIndex {
  const invertedIndex: Record<string, number[]> = {};
  const snippetsByPage: Record<number, string> = {};
  let totalTerms = 0;

  for (const page of pages) {
    const text = page.extractedText || '';
    snippetsByPage[page.pageNumber] = text.slice(0, 300);

    const tokens = tokenizeText(text);
    totalTerms += tokens.length;

    for (const token of tokens) {
      if (!invertedIndex[token]) {
        invertedIndex[token] = [];
      }
      if (!invertedIndex[token].includes(page.pageNumber)) {
        invertedIndex[token].push(page.pageNumber);
      }
    }
  }

  return {
    documentId,
    versionId,
    totalTerms,
    invertedIndex,
    snippetsByPage,
  };
}

/**
 * Searches a document index or raw pages for a user search query.
 */
export function searchDocumentText(
  pages: Array<{ pageNumber: number; extractedText?: string }>,
  query: string,
  index?: DocumentSearchIndex
): SearchMatchResult[] {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }

  const queryTerms = tokenizeText(query);
  if (queryTerms.length === 0) {
    const fallbackTerm = query.trim().toLowerCase();
    queryTerms.push(fallbackTerm);
  }

  const results: SearchMatchResult[] = [];

  for (const page of pages) {
    const text = page.extractedText || '';
    const lowerText = text.toLowerCase();
    let matchScore = 0;
    const highlightWords: string[] = [];

    let bestMatchIndex = -1;

    for (const term of queryTerms) {
      if (lowerText.includes(term)) {
        matchScore += 10;
        highlightWords.push(term);
        if (bestMatchIndex === -1) {
          bestMatchIndex = lowerText.indexOf(term);
        }
      }
    }

    if (matchScore > 0) {
      // Extract contextual snippet around first match
      const start = Math.max(0, bestMatchIndex - 50);
      const end = Math.min(text.length, bestMatchIndex + 120);
      let snippet = text.slice(start, end).trim();

      if (start > 0) snippet = `...${snippet}`;
      if (end < text.length) snippet = `${snippet}...`;

      results.push({
        pageNumber: page.pageNumber,
        snippet: snippet || `Match found on page ${page.pageNumber}`,
        matchScore,
        highlightWords,
      });
    }
  }

  return results.sort((a, b) => b.matchScore - a.matchScore || a.pageNumber - b.pageNumber);
}
