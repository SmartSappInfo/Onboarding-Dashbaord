/**
 * @fileOverview Stable item identity (Phase 11 M2 · T3.1; Rules 19, 20).
 *
 * `itemHash` = sha256(type | normalised text | owner | due date). The same item extracted twice
 * (chunk overlap, a retry, a re-run with the same prompt version) gets the same hash, so it is
 * stored once and actions built on it (tasks, drafts) stay idempotent.
 *
 * Pure. Tests: src/lib/meetings/__tests__/intelligence-pure.test.ts
 */

import { createHash } from 'node:crypto';
import type { MeetingItemType } from './intelligence-schemas';
import { normalizeForMatch } from './text-normalize';

export function itemHash(item: { type: MeetingItemType; text: string; ownerName?: string; dueIso?: string }): string {
  const parts = [item.type, normalizeForMatch(item.text), normalizeForMatch(item.ownerName ?? ''), item.dueIso ?? ''];
  return `it_${createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 32)}`;
}
