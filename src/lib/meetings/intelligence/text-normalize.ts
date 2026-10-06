/**
 * @fileOverview Text normalisation shared by evidence checks and item hashing (Phase 11 M2 · T3).
 * Pure. Case, Unicode form, punctuation, quote styles and whitespace never decide a match.
 */

export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(text: string): number {
  const n = normalizeForMatch(text);
  return n ? n.split(' ').length : 0;
}

/** Rough token estimate (≈ 4 characters per token) used for budgets only. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
