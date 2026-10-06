/**
 * @fileOverview Contradiction linking (Phase 11 M2 · T3.1; plan §4.4 rule 8).
 *
 * People change their minds in meetings ("ship Friday" … "actually, not before Monday"). Both
 * items are KEPT and linked through `contradicts`, so a person sees both and decides; we never
 * silently pick one.
 *
 * Two decisions/commitments/action items are linked when they are about the same thing (word
 * overlap ≥ 0.5 after removing filler words) and differ in a way that matters: one is negated and
 * the other isn't, or both carry different due dates or amounts.
 *
 * Pure, O(n²) over ≤ a few hundred items per meeting. Tests: intelligence-pure.test.ts
 */

import type { MeetingItemType } from './intelligence-schemas';
import { normalizeForMatch } from './text-normalize';

const LINKABLE: ReadonlySet<MeetingItemType> = new Set(['decision', 'commitment', 'action_item']);
const STOP = new Set(['the', 'a', 'an', 'to', 'we', 'will', 'i', 'you', 'they', 'it', 'on', 'by', 'of', 'for', 'and', 'or', 'be', 'is', 'are', 'this', 'that', 'with', 'our', 'their', 'shall', 'should']);
const NEGATION = /\b(not|no|never|won t|wont|dont|don t|cancel|cancelled|canceled|drop|dropped|instead|no longer|postpone|postponed)\b/;

export interface LinkableItem {
  itemHash: string;
  type: MeetingItemType;
  text: string;
  dueIso?: string;
  amountValue?: number;
}

const contentWords = (text: string) => new Set(normalizeForMatch(text).split(' ').filter((w) => w && !STOP.has(w) && !NEGATION.test(w)));

function overlap(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

/** Returns itemHash → hashes it contradicts (symmetric). */
export function linkContradictions(items: readonly LinkableItem[]): Map<string, string[]> {
  const links = new Map<string, string[]>();
  const candidates = items.filter((i) => LINKABLE.has(i.type)).map((i) => ({ ...i, words: contentWords(i.text), negated: NEGATION.test(normalizeForMatch(i.text)) }));
  const add = (a: string, b: string) => links.set(a, [...(links.get(a) ?? []), b]);
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const x = candidates[i];
      const y = candidates[j];
      if (x.itemHash === y.itemHash || overlap(x.words, y.words) < 0.5) continue;
      const differs =
        x.negated !== y.negated ||
        (x.dueIso !== undefined && y.dueIso !== undefined && x.dueIso !== y.dueIso) ||
        (x.amountValue !== undefined && y.amountValue !== undefined && x.amountValue !== y.amountValue);
      if (differs) {
        add(x.itemHash, y.itemHash);
        add(y.itemHash, x.itemHash);
      }
    }
  }
  return links;
}
