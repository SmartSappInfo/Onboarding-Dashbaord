/**
 * @fileOverview CRM update proposals from meeting outcomes (Phase 11 M2 · T4.3; plan §4.11, §4.12, D17; Rules 18–22, 27).
 *
 * A person (or the Meeting Analyst for them) proposes ONE CRM change backed by ONE checked meeting
 * item. The proposal goes through the CRM proposal bridge, so it is the same unified approval record
 * as every other change: approved by someone else (never the proposer), executed for real behind
 * `FF_CRM_PROPOSAL_EXECUTION`, verified, and reversible where a governed inverse exists.
 *
 * Allowed targets (D17), never amounts or owners:
 * - `deal_stage`   → UPDATE_STAGE (`deal.advance_stage`): executable, rollback restores the stage.
 * - `entity_tags`  → APPLY_TAGS: recommendation only (approvable guidance, never executed) until the
 *                    tag capabilities fail closed (they currently report success on failure).
 * - `entity_note`  → ADD_NOTE: recommendation only, same reason.
 * Next step and expected close date have no governed capability yet (plan deviation X5).
 *
 * Binding: the approval evidence carries meeting, item, transcript, run and analysis version; the
 * bridge refuses to execute once the meeting was re-analysed (other run) or the item is gone. The
 * preview shows the item's quotes. Proposals expire after 24 h.
 *
 * Idempotency: `mtg_crm_{meetingId}_{targetId}_{fieldHash}` (claim record, like task conversion).
 * A retry returns the same proposal while it is still pending/approved for the same analysis run;
 * after a rejection, expiry or re-analysis a new proposal is made.
 *
 * Tests: src/platform/__tests__/agents/crm/meeting-crm-proposals.test.ts
 */

import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import type { CrmActionType, CrmProposedAction } from '@/platform/agents/crm/actions/crm-action-types';
import type { ProposeCrmActionInput } from '@/platform/agents/crm/actions/crm-proposal-bridge';
import { readIntelligenceV2 } from './intelligence-store';

export const MEETING_CRM_PROPOSALS = 'meeting_crm_proposals';
const CLAIM_MS = 2 * 60 * 1000;
const PROPOSAL_TTL_SECONDS = 24 * 3600;

const Id = z.string().trim().min(1).max(200).regex(/^[^/]+$/, 'Invalid id.');

/** D17: the only things a meeting may propose. Amounts and owners are not representable. */
export const MeetingCrmTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('deal_stage'), dealId: Id, stageId: Id }),
  z.object({ kind: z.literal('entity_tags'), entityId: Id, tagIds: z.array(Id).min(1).max(10) }),
  z.object({ kind: z.literal('entity_note'), entityId: Id, content: z.string().trim().min(1).max(2000) }),
]);
export type MeetingCrmTarget = z.infer<typeof MeetingCrmTargetSchema>;

export type MeetingCrmProposalErrorCode = 'NOT_FOUND' | 'VERSION_CONFLICT' | 'ITEM_NEEDS_REVIEW' | 'IN_PROGRESS';

export class MeetingCrmProposalError extends Error {
  constructor(readonly code: MeetingCrmProposalErrorCode, message: string) {
    super(message);
    this.name = 'MeetingCrmProposalError';
  }
}

export interface MeetingCrmProposalDeps {
  propose: (input: ProposeCrmActionInput) => Promise<{ proposalId: string }>;
  approvalState: (approvalId: string, organizationId: string) => Promise<{ status: string; executable: boolean } | null>;
  nowMs: () => number;
}

const ClaimSchema = z.object({
  workspaceId: z.string(),
  meetingId: z.string(),
  approvalId: z.string().optional(),
  runId: z.string().optional(),
  claimedAt: z.string().optional(),
});

const LIVE_STATUSES = new Set(['pending', 'approved', 'bound']);

function actionFor(target: MeetingCrmTarget): { actionType: CrmActionType; targetId: string; targetCapabilityId: string; payload: Record<string, unknown>; what: string; reversible: boolean } {
  switch (target.kind) {
    case 'deal_stage':
      return { actionType: 'UPDATE_STAGE', targetId: target.dealId, targetCapabilityId: 'deal.advance_stage', payload: { dealId: target.dealId, targetStage: target.stageId }, what: `Move the deal to stage "${target.stageId}"`, reversible: true };
    case 'entity_tags':
      return { actionType: 'APPLY_TAGS', targetId: target.entityId, targetCapabilityId: 'crm.entity.add_tag', payload: { entityId: target.entityId, tagIds: target.tagIds }, what: `Add ${target.tagIds.length} tag(s) to the record`, reversible: true };
    case 'entity_note':
      return { actionType: 'ADD_NOTE', targetId: target.entityId, targetCapabilityId: 'crm.note.create', payload: { entityId: target.entityId, content: target.content }, what: 'Add a note to the record', reversible: false };
  }
}

export async function proposeMeetingCrmUpdate(
  db: Firestore,
  deps: MeetingCrmProposalDeps,
  params: {
    workspaceId: string;
    organizationId: string;
    meetingId: string;
    meetingTitle?: string;
    itemHash: string;
    target: MeetingCrmTarget;
    actorUid: string;
    expectedVersion?: number;
  }
): Promise<{ proposalId: string; replayed: boolean; executable: boolean }> {
  const target = MeetingCrmTargetSchema.parse(params.target);
  const stored = await readIntelligenceV2(db, params.meetingId, params.workspaceId);
  if (!stored) throw new MeetingCrmProposalError('NOT_FOUND', 'This meeting has no analysis yet.');
  if (params.expectedVersion !== undefined && stored.header.version !== params.expectedVersion) {
    throw new MeetingCrmProposalError('VERSION_CONFLICT', 'The analysis changed since you reviewed it. Review it again.');
  }
  const item = stored.items.find((i) => i.itemHash === params.itemHash);
  if (!item || item.status !== 'valid') throw new MeetingCrmProposalError('NOT_FOUND', 'Meeting outcome not found.');
  if (item.needsReview) throw new MeetingCrmProposalError('ITEM_NEEDS_REVIEW', 'Review this outcome before proposing a change from it.');

  const action = actionFor(target);
  const fieldHash = createHash('sha256').update(JSON.stringify(target)).digest('hex').slice(0, 16);
  const key = `mtg_crm_${params.meetingId}_${action.targetId}_${fieldHash}`;
  const claimRef = db.collection(MEETING_CRM_PROPOSALS).doc(`${params.workspaceId}__${key}`);
  const nowIso = () => new Date(deps.nowMs()).toISOString();

  // Claim (one proposal per key at a time); reuse a live proposal of the same analysis run.
  const existing = await db.runTransaction(async (tx) => {
    const snap = await tx.get(claimRef);
    const claim = snap.exists ? ClaimSchema.safeParse(snap.data()) : null;
    if (claim?.success && claim.data.approvalId && claim.data.runId === stored.header.runId) {
      return { approvalId: claim.data.approvalId };
    }
    const claimedAt = claim?.success && claim.data.claimedAt && !claim.data.approvalId ? Date.parse(claim.data.claimedAt) : Number.NaN;
    if (!Number.isNaN(claimedAt) && deps.nowMs() - claimedAt < CLAIM_MS) {
      throw new MeetingCrmProposalError('IN_PROGRESS', 'This change is already being proposed. Try again in a moment.');
    }
    tx.set(claimRef, { workspaceId: params.workspaceId, meetingId: params.meetingId, claimedAt: nowIso() });
    return null;
  });
  if (existing) {
    const state = await deps.approvalState(existing.approvalId, params.organizationId);
    if (state && LIVE_STATUSES.has(state.status)) return { proposalId: existing.approvalId, replayed: true, executable: state.executable };
    await claimRef.set({ workspaceId: params.workspaceId, meetingId: params.meetingId, claimedAt: nowIso() });
  }

  const quotes = item.evidence.map((e) => `"${e.quote}"`).join(' · ');
  const proposedAction: CrmProposedAction = {
    id: key,
    entityId: action.targetId,
    workspaceId: params.workspaceId,
    actionType: action.actionType,
    priority: 'MEDIUM',
    riskLevel: 'L2_STATE_MUTATION',
    explainability: {
      what: action.what,
      why: `From the meeting "${params.meetingTitle ?? params.meetingId}": ${item.text}. Said: ${quotes}`,
      impact: 'Keeps the CRM in line with what was agreed in the meeting.',
      blastRadius: { affectedRecordsCount: 1, financialExposureUsd: 0, isReversible: action.reversible },
    },
    idempotencyKey: key,
    targetCapabilityId: action.targetCapabilityId,
    payload: action.payload,
    requiresApproval: true,
    createdAt: nowIso(),
  };

  let proposalId: string;
  try {
    ({ proposalId } = await deps.propose({
      organizationId: params.organizationId,
      workspaceId: params.workspaceId,
      callerId: params.actorUid,
      action: proposedAction,
      origin: {
        origin: 'meeting',
        meetingId: params.meetingId,
        itemHash: item.itemHash,
        transcriptId: stored.header.transcriptId,
        runId: stored.header.runId,
        intelligenceVersion: stored.header.version,
      },
      ttlSeconds: PROPOSAL_TTL_SECONDS,
    }));
  } catch (err) {
    // Release the claim so the person can retry.
    await claimRef.set({ workspaceId: params.workspaceId, meetingId: params.meetingId });
    throw err;
  }
  await claimRef.set({ workspaceId: params.workspaceId, meetingId: params.meetingId, approvalId: proposalId, runId: stored.header.runId });
  const state = await deps.approvalState(proposalId, params.organizationId);
  return { proposalId, replayed: false, executable: state?.executable ?? false };
}
