/**
 * @fileOverview Owner mapping (Phase 11 M2 · T3.1; plan §4.4 rule 6; §4.6 "assignee shown, never guessed").
 *
 * A model-named owner is matched to a transcript speaker or meeting participant by full name, or
 * by a first name that is UNIQUE among them. Anything else stays unmatched and is shown as
 * "Unassigned": we never guess who owns a commitment.
 *
 * Pure. Tests: src/lib/meetings/__tests__/intelligence-pure.test.ts
 */

import { normalizeForMatch } from './text-normalize';

export interface OwnerCandidate {
  name: string;
  participantId?: string;
  userId?: string;
}

export interface MappedOwner {
  name: string;
  participantId?: string;
  userId?: string;
  matched: boolean;
}

export function mapOwner(ownerName: string | undefined, candidates: readonly OwnerCandidate[]): MappedOwner | undefined {
  const wanted = normalizeForMatch(ownerName ?? '');
  if (!wanted) return undefined;
  const named = candidates.filter((c) => normalizeForMatch(c.name));

  const byFull = named.filter((c) => normalizeForMatch(c.name) === wanted);
  const firstName = (n: string) => normalizeForMatch(n).split(' ')[0] ?? '';
  // A one-word name ("Ama") may match a unique first name; a full name must match exactly.
  const isSingleWord = !wanted.includes(' ');
  const byFirst = byFull.length > 0 ? byFull : isSingleWord ? named.filter((c) => firstName(c.name) === wanted) : [];

  // Several different people share the name → ambiguous → not matched.
  const distinct = new Map(byFirst.map((c) => [c.participantId ?? c.userId ?? normalizeForMatch(c.name), c]));
  if (distinct.size !== 1) return { name: ownerName?.trim() ?? '', matched: false };
  const c = [...distinct.values()][0];
  return {
    name: c.name,
    matched: true,
    ...(c.participantId ? { participantId: c.participantId } : {}),
    ...(c.userId ? { userId: c.userId } : {}),
  };
}
