/**
 * @fileOverview Meeting intelligence v2: item, evidence and model-output schemas
 * (Phase 11 M2 · T3; plan §4.4; Rules 30, 31, 47, 48).
 *
 * Two shapes on purpose:
 * - `ChunkModelOutputSchema` is what the model is asked for. It is UNTRUSTED: every item is
 *   re-validated (schema → business → evidence) before anything is kept.
 * - `MeetingItemSchema` is what is stored after validation, in
 *   `meeting_intelligence/{meetingId}/items/{itemHash}`. Readers (prep brief, tasks, drafts) use only
 *   `status: 'valid'` items.
 *
 * CAUTION: changing `MEETING_ITEM_TYPES` or the stored item shape is a contract change for the
 * prep brief (`prep-brief-service.ts`) and the T4 actions. Add, never repurpose.
 */

import { z } from 'zod/v4';

export const MEETING_ITEM_TYPES = ['topic', 'decision', 'commitment', 'action_item', 'buying_signal', 'objection', 'risk', 'question'] as const;
export const MeetingItemTypeSchema = z.enum(MEETING_ITEM_TYPES);
export type MeetingItemType = z.infer<typeof MeetingItemTypeSchema>;

/** Items people can act on (tasks, follow-ups). */
export const ACTIONABLE_ITEM_TYPES: readonly MeetingItemType[] = ['commitment', 'action_item'];

export const MIN_QUOTE_WORDS = 3;
export const LOW_CONFIDENCE = 0.6;

// ── Model output (untrusted) ─────────────────────────────────────────────────────

export const ChunkModelItemSchema = z.object({
  type: MeetingItemTypeSchema,
  text: z.string().trim().min(1).max(500),
  ownerName: z.string().trim().max(200).optional(),
  /** The words used for the deadline, e.g. "by Friday". Resolved by our code, never trusted as a date. */
  dueText: z.string().trim().max(120).optional(),
  amountValue: z.number().finite().nonnegative().optional(),
  amountCurrency: z.string().trim().max(10).optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.object({
    segmentIds: z.array(z.string().min(1).max(64)).min(1).max(6),
    quote: z.string().trim().min(1).max(600),
  })).min(1).max(3),
});
export type ChunkModelItem = z.infer<typeof ChunkModelItemSchema>;

/** Arrays are parsed item by item so one bad item never discards the rest. */
export const ChunkModelOutputLooseSchema = z.object({ items: z.array(z.unknown()).max(60) });

// ── Stored (validated) ───────────────────────────────────────────────────────────

export const DROP_REASONS = [
  'schema', 'unknown_segment', 'quote_not_found', 'quote_too_short', 'duplicate', 'over_limit',
] as const;
export type DropReason = (typeof DROP_REASONS)[number];

export const ItemOwnerSchema = z.object({
  name: z.string().max(200),
  participantId: z.string().max(200).optional(),
  userId: z.string().max(200).optional(),
  /** False when the name matched no speaker or participant ("Unassigned" is shown). */
  matched: z.boolean(),
});

export const ItemDueDateSchema = z.object({
  /** Local calendar date YYYY-MM-DD in `timeZone`. */
  iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resolvedFrom: z.string().max(120),
  timeZone: z.string().max(64),
  timeZoneSource: z.enum(['meeting', 'workspace', 'default']),
});

export const ItemAmountSchema = z.object({
  value: z.number().finite().nonnegative(),
  currency: z.string().length(3).nullable(),
  ambiguous: z.boolean(),
});

export const ItemEvidenceSchema = z.object({
  segmentIds: z.array(z.string()).min(1),
  quote: z.string().min(1),
});

export const MeetingItemSchema = z.object({
  workspaceId: z.string().min(1),
  meetingId: z.string().min(1),
  transcriptId: z.string().min(1),
  itemHash: z.string().min(1),
  type: MeetingItemTypeSchema,
  text: z.string().trim().min(1).max(2000),
  owner: ItemOwnerSchema.optional(),
  dueDate: ItemDueDateSchema.optional(),
  /** Convenience copy of `dueDate.iso` for readers that only need the date. */
  dueIso: z.string().optional(),
  amount: ItemAmountSchema.optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(ItemEvidenceSchema).min(1),
  contradicts: z.array(z.string()).default([]),
  needsReview: z.boolean(),
  reviewReasons: z.array(z.enum(['low_confidence', 'injection_flagged', 'ambiguous_amount', 'default_time_zone', 'unassigned_owner'])).default([]),
  status: z.literal('valid'),
  promptVersion: z.string().min(1),
  createdAt: z.string(),
});
export type MeetingItem = z.infer<typeof MeetingItemSchema>;
