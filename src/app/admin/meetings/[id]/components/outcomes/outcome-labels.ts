/**
 * @fileOverview Display labels and plain-language explanations for meeting outcomes (Phase 11 M2 · T6).
 * Client-safe: no server imports (type-only imports are erased).
 */

import type { MeetingItem, MeetingItemType } from '@/lib/meetings/intelligence/intelligence-schemas';

/** Group order on the panel: what leads to action first. */
export const OUTCOME_GROUPS: ReadonlyArray<{ type: MeetingItemType; label: string }> = [
  { type: 'decision', label: 'Decisions' },
  { type: 'commitment', label: 'Commitments' },
  { type: 'action_item', label: 'Action items' },
  { type: 'risk', label: 'Risks' },
  { type: 'objection', label: 'Objections' },
  { type: 'buying_signal', label: 'Buying signals' },
  { type: 'question', label: 'Open questions' },
  { type: 'topic', label: 'Topics' },
];

export const TYPE_LABEL: Readonly<Record<MeetingItemType, string>> = {
  decision: 'Decision',
  commitment: 'Commitment',
  action_item: 'Action item',
  risk: 'Risk',
  objection: 'Objection',
  buying_signal: 'Buying signal',
  question: 'Open question',
  topic: 'Topic',
};

export const REVIEW_REASON_TEXT: Readonly<Record<MeetingItem['reviewReasons'][number], string>> = {
  low_confidence: 'The AI was not sure this was really agreed.',
  injection_flagged: 'The transcript contains text that looks like instructions to the AI, so everything from it is checked by a person first.',
  ambiguous_amount: 'An amount was mentioned without a clear currency.',
  default_time_zone: "A date was worked out without this meeting's time zone (UTC was used).",
};

export const PAGE_STEP = 50;

/** "Line N" for a transcript segment id (`s0` is line 1); null for ids from other formats. */
export function lineNumber(segmentId: string): number | null {
  const m = /^s(\d+)$/.exec(segmentId);
  return m ? Number(m[1]) + 1 : null;
}

export const isActionable = (type: MeetingItemType) => type === 'commitment' || type === 'action_item';

export function composerHref(meetingId: string, draftId: string): string {
  return `/admin/messaging/composer?meetingId=${encodeURIComponent(meetingId)}&draftId=${encodeURIComponent(draftId)}`;
}
