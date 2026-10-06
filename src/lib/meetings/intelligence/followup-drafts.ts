/**
 * @fileOverview Follow-up drafts from meeting outcomes (Phase 11 M2 · T4.2; plan §4.7, §4.11, §7.2; Rules 13, 31–33, 40, 57).
 *
 * A draft is written by the model from the meeting's CHECKED items only (never the transcript),
 * keeps only sentences that cite real items, and is stored, never sent: a person opens it in the
 * messaging composer and sends it from there (D16).
 *
 * Guards, in order (each one refuses before anything is spent or stored):
 * 1. Recipients: 1–20 addresses, each a meeting participant or a contact of the linked record.
 * 2. Analysis exists in this workspace; bound to the version the person reviewed.
 * 3. AI use allowed, `ai_read` consent, data policy allows a model (same stops as the pipeline).
 * 4. Model output: cited sentences only; any sentence naming an email address that is not a
 *    recipient is removed (another person's data never reaches the draft, Rule 32).
 * 5. Egress scan for `external_email` with a `confidential` ceiling: credentials, financial and
 *    personal identifiers block the draft (Rule 33).
 *
 * Idempotency: the draft id is derived from meeting + analysis version + recipient set, so asking
 * again returns the same draft without another model call. Drafts are never edited in place; delete
 * is a soft delete kept for audit, and the next request writes a new generation (`…_2`, `…_3`).
 *
 * Tests: src/lib/meetings/__tests__/followup-drafts.test.ts
 */

import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import { CircuitBreaker } from '@/platform/events/resilience/circuit-breaker';
import { readIntelligenceV2 } from './intelligence-store';
import { FOLLOWUP_DRAFT_PROMPT_VERSION, buildFollowupDraftPrompt } from './prompts';
import { assertAnalysable, SUMMARY_DEADLINE_MS, withDeadline, type IntelligenceModelRequest, type IntelligenceModelResponse } from './pipeline';

export const FOLLOWUP_DRAFTS = 'meeting_followup_drafts';
export const MAX_DRAFT_RECIPIENTS = 20;
const MAX_GENERATIONS = 20;
const MAX_SENTENCES = 8;

export type FollowupDraftErrorCode =
  | 'NOT_FOUND'
  | 'VERSION_CONFLICT'
  | 'RECIPIENT_NOT_ALLOWED'
  | 'NOTHING_TO_DRAFT'
  | 'EGRESS_BLOCKED'
  | 'TOO_MANY';

export class FollowupDraftError extends Error {
  constructor(readonly code: FollowupDraftErrorCode, message: string) {
    super(message);
    this.name = 'FollowupDraftError';
  }
}

export interface FollowupDraftModel {
  readonly breakerKey: string;
  draft(request: IntelligenceModelRequest): Promise<IntelligenceModelResponse>;
}

export interface FollowupDraftDeps {
  model: FollowupDraftModel;
  /** Meeting participants with an email + contacts of the linked record (lower-cased by the caller or here). */
  loadAllowedRecipients: (params: { workspaceId: string; meetingId: string }) => Promise<Array<{ email: string; name?: string }>>;
  egress: (payload: unknown, tenant: { organizationId: string; workspaceId: string }) => Promise<{ allowed: boolean; reason?: string }>;
  nowMs: () => number;
  breaker?: CircuitBreaker;
  deadlineMs?: number;
}

export const FollowupDraftSchema = z.object({
  draftId: z.string(),
  requestKey: z.string(),
  workspaceId: z.string(),
  meetingId: z.string(),
  transcriptId: z.string(),
  intelligenceVersion: z.number().int(),
  status: z.enum(['draft', 'deleted']),
  version: z.number().int(),
  recipients: z.array(z.string()),
  subject: z.string(),
  sentences: z.array(z.object({ text: z.string(), itemHashes: z.array(z.string()) })),
  body: z.string(),
  sourceItemHashes: z.array(z.string()),
  droppedSentences: z.number().int(),
  provider: z.object({ modelId: z.string(), promptVersion: z.string() }),
  createdBy: z.string(),
  createdAt: z.string(),
  deletedBy: z.string().optional(),
  deletedAt: z.string().optional(),
});
export type FollowupDraft = z.infer<typeof FollowupDraftSchema>;

const DraftModelOutputSchema = z.object({
  subject: z.string().trim().min(1).max(160),
  sentences: z.array(z.unknown()).max(12),
});
const DraftSentenceSchema = z.object({
  text: z.string().trim().min(1).max(400),
  itemIds: z.array(z.string().min(1)).min(1).max(10),
});
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const defaultBreaker = new CircuitBreaker();

export function normalizeRecipients(recipients: readonly string[]): string[] {
  return [...new Set(recipients.map((r) => r.trim().toLowerCase()).filter(Boolean))].sort();
}

const requestKeyOf = (meetingId: string, intelligenceVersion: number, recipients: readonly string[]) =>
  `mtg_draft_${meetingId}_v${intelligenceVersion}_${createHash('sha256').update(recipients.join(',')).digest('hex').slice(0, 12)}`;

function parseDraft(raw: unknown): FollowupDraft | null {
  const parsed = FollowupDraftSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** First live draft for this request, or the id the next generation should use. */
async function findSlot(db: Firestore, requestKey: string, workspaceId: string): Promise<{ live: FollowupDraft } | { freeId: string }> {
  for (let g = 1; g <= MAX_GENERATIONS; g += 1) {
    const id = `${requestKey}_${g}`;
    const snap = await db.collection(FOLLOWUP_DRAFTS).doc(id).get();
    if (!snap.exists) return { freeId: id };
    const draft = parseDraft(snap.data());
    if (!draft || draft.workspaceId !== workspaceId) throw new FollowupDraftError('NOT_FOUND', 'Draft not found.');
    if (draft.status === 'draft') return { live: draft };
  }
  throw new FollowupDraftError('TOO_MANY', 'Too many drafts were deleted for this follow-up. Re-analyse the meeting to start again.');
}

export async function generateFollowupDraft(
  db: Firestore,
  deps: FollowupDraftDeps,
  params: {
    workspaceId: string;
    organizationId: string;
    meetingId: string;
    meetingTitle?: string;
    actorUid: string;
    recipients: readonly string[];
    expectedVersion?: number;
  }
): Promise<{ draftId: string; replayed: boolean; draft: FollowupDraft }> {
  // 1. Recipients.
  const recipients = normalizeRecipients(params.recipients);
  if (recipients.length === 0) throw new FollowupDraftError('RECIPIENT_NOT_ALLOWED', 'Choose at least one recipient.');
  if (recipients.length > MAX_DRAFT_RECIPIENTS) throw new FollowupDraftError('TOO_MANY', `Choose at most ${MAX_DRAFT_RECIPIENTS} recipients.`);
  const allowed = new Set((await deps.loadAllowedRecipients({ workspaceId: params.workspaceId, meetingId: params.meetingId })).map((r) => r.email.trim().toLowerCase()));
  const refused = recipients.filter((r) => !allowed.has(r));
  if (refused.length > 0) {
    throw new FollowupDraftError('RECIPIENT_NOT_ALLOWED', `Only meeting participants and contacts of the linked record can receive this follow-up: ${refused.join(', ')}.`);
  }

  // 2. Analysis and version.
  const stored = await readIntelligenceV2(db, params.meetingId, params.workspaceId);
  if (!stored) throw new FollowupDraftError('NOT_FOUND', 'This meeting has no analysis yet.');
  if (params.expectedVersion !== undefined && stored.header.version !== params.expectedVersion) {
    throw new FollowupDraftError('VERSION_CONFLICT', 'The analysis changed since you reviewed it. Review it again.');
  }

  const requestKey = requestKeyOf(params.meetingId, stored.header.version, recipients);
  const slot = await findSlot(db, requestKey, params.workspaceId);
  if ('live' in slot) return { draftId: slot.live.draftId, replayed: true, draft: slot.live };

  // 3. AI use, consent, data policy.
  await assertAnalysable(db, { workspaceId: params.workspaceId, organizationId: params.organizationId, meetingId: params.meetingId, transcriptId: stored.header.transcriptId });

  const items = stored.items.filter((i) => !i.needsReview && i.status === 'valid');
  if (items.length === 0) throw new FollowupDraftError('NOTHING_TO_DRAFT', 'There are no checked outcomes to write a follow-up from.');

  // 4. Model, then citations and other people's addresses.
  const res = await (deps.breaker ?? defaultBreaker).execute(`${deps.model.breakerKey}:followup_draft`, () =>
    withDeadline((signal) => deps.model.draft({
      prompt: buildFollowupDraftPrompt(items, { title: params.meetingTitle ?? 'Meeting' }),
      workspaceId: params.workspaceId,
      organizationId: params.organizationId,
      signal,
    }), deps.deadlineMs ?? SUMMARY_DEADLINE_MS)
  );
  const output = DraftModelOutputSchema.safeParse(res.output);
  if (!output.success) throw new FollowupDraftError('NOTHING_TO_DRAFT', "Couldn't write a follow-up from the checked outcomes. Try again.");

  const known = new Set(items.map((i) => i.itemHash));
  const recipientSet = new Set(recipients);
  const sentences: FollowupDraft['sentences'] = [];
  let dropped = 0;
  for (const raw of output.data.sentences) {
    const s = DraftSentenceSchema.safeParse(raw);
    const ids = s.success ? [...new Set(s.data.itemIds)] : [];
    const foreignEmail = s.success && (s.data.text.match(EMAIL) ?? []).some((e) => !recipientSet.has(e.toLowerCase()));
    if (!s.success || ids.some((id) => !known.has(id)) || foreignEmail) {
      dropped += 1;
      continue;
    }
    sentences.push({ text: s.data.text, itemHashes: ids });
  }
  const kept = sentences.slice(0, MAX_SENTENCES);
  const subject = output.data.subject.replace(EMAIL, '').trim();
  if (kept.length === 0 || !subject) throw new FollowupDraftError('NOTHING_TO_DRAFT', "Couldn't write a follow-up from the checked outcomes. Try again.");
  const body = kept.map((s) => s.text).join(' ');

  // 5. Egress scan.
  const egress = await deps.egress({ subject, body }, { organizationId: params.organizationId, workspaceId: params.workspaceId });
  if (!egress.allowed) {
    throw new FollowupDraftError('EGRESS_BLOCKED', 'This draft contains sensitive data (for example card, account or ID numbers) and was not saved.');
  }

  const draft: FollowupDraft = {
    draftId: slot.freeId,
    requestKey,
    workspaceId: params.workspaceId,
    meetingId: params.meetingId,
    transcriptId: stored.header.transcriptId,
    intelligenceVersion: stored.header.version,
    status: 'draft',
    version: 1,
    recipients,
    subject,
    sentences: kept,
    body,
    sourceItemHashes: [...new Set(kept.flatMap((s) => s.itemHashes))],
    droppedSentences: dropped + (sentences.length - kept.length),
    provider: { modelId: res.modelId, promptVersion: FOLLOWUP_DRAFT_PROMPT_VERSION },
    createdBy: params.actorUid,
    createdAt: new Date(deps.nowMs()).toISOString(),
  };
  const ref = db.collection(FOLLOWUP_DRAFTS).doc(draft.draftId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const existing = snap.exists ? parseDraft(snap.data()) : null;
    // A concurrent identical request won: return its draft.
    if (existing && existing.workspaceId === params.workspaceId && existing.status === 'draft') {
      return { draftId: existing.draftId, replayed: true, draft: existing };
    }
    if (snap.exists) throw new FollowupDraftError('VERSION_CONFLICT', 'This draft changed while it was being written. Try again.');
    tx.set(ref, draft);
    return { draftId: draft.draftId, replayed: false, draft };
  });
}

/** A live draft in this workspace (null when missing, foreign or deleted). */
export async function readFollowupDraft(db: Firestore, workspaceId: string, draftId: string): Promise<FollowupDraft | null> {
  if (!draftId || draftId.includes('/')) return null;
  const snap = await db.collection(FOLLOWUP_DRAFTS).doc(draftId).get();
  const draft = snap.exists ? parseDraft(snap.data()) : null;
  return draft && draft.workspaceId === workspaceId && draft.status === 'draft' ? draft : null;
}

/** Soft delete (kept for audit). Deleting again is a no-op. */
export async function deleteFollowupDraft(
  db: Firestore,
  params: { workspaceId: string; draftId: string; actorUid: string; nowMs: number }
): Promise<{ deleted: boolean }> {
  if (!params.draftId || params.draftId.includes('/')) throw new FollowupDraftError('NOT_FOUND', 'Draft not found.');
  const ref = db.collection(FOLLOWUP_DRAFTS).doc(params.draftId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const draft = snap.exists ? parseDraft(snap.data()) : null;
    if (!draft || draft.workspaceId !== params.workspaceId) throw new FollowupDraftError('NOT_FOUND', 'Draft not found.');
    if (draft.status === 'deleted') return { deleted: false };
    tx.set(ref, { ...draft, status: 'deleted', deletedBy: params.actorUid, deletedAt: new Date(params.nowMs).toISOString() });
    return { deleted: true };
  });
}
