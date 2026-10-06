'use server';

/**
 * @fileOverview Server Actions for the meeting outcomes panel (Phase 11 M2 · T6; plan §4.6, §4.7, §4.12, §13).
 *
 * Reads (meetings view): the stored v2 analysis with what was already done for each item (task,
 * proposal), the live follow-up drafts, the allowed draft recipients and the deals a stage change
 * can target. Reads use the shared read services after `requireMeetingAccess` (M1 · T1 decision:
 * legacy roles have no gateway view scope).
 *
 * Changes (meetings manage) ALWAYS go through the governed capabilities as the signed-in person:
 * `meeting.create_followup_tasks`, `meeting.undo_followup_task`, `meeting.draft_followup`,
 * `meeting.delete_followup_draft`, `meeting.propose_crm_update`. So people get exactly the checks
 * agents get (permissions, versions, consent, egress, approval binding, audit).
 *
 * Every argument is validated here (Server Actions are public endpoints). Errors are returned as
 * plain messages, never thrown to the client.
 */

import { z } from 'zod/v4';
import { adminDb } from '@/lib/firebase-admin';
import type { AuthContext } from '@/lib/auth/require-auth';
import { requireMeetingAccess } from '@/lib/meetings/meeting-auth';
import { readIntelligenceV2 } from '@/lib/meetings/intelligence/intelligence-store';
import { listConversions } from '@/lib/meetings/intelligence/item-conversion';
import { FOLLOWUP_DRAFTS, FollowupDraftSchema } from '@/lib/meetings/intelligence/followup-drafts';
import { loadMeetingRecipients } from '@/lib/meetings/intelligence/followup-recipients';
import { listMeetingProposals, MeetingCrmTargetSchema } from '@/lib/meetings/intelligence/crm-proposals';
import type { MeetingItem } from '@/lib/meetings/intelligence/intelligence-schemas';
import { resolveContact } from '@/lib/contact-adapter';
import { getApproval } from '@/platform/policy/unified-approval-store';
import { executeCapability } from '@/platform/capabilities/execution/execute-capability';
import { createServerActionInvocation } from '@/platform/capabilities/execution/invocation';
import { ensureCapabilitiesRegistered } from '@/platform/capabilities/registry/register-capabilities';
import { resolvePrincipalFromSession } from '@/platform/capabilities/policy/session-principal-resolver';
import type {
  MeetingCreateFollowupTasksOutput,
  MeetingDeleteFollowupDraftOutput,
  MeetingDraftFollowupOutput,
  MeetingProposeCrmUpdateOutput,
  MeetingUndoFollowupTaskOutput,
} from '@/platform/domains/meetings_conversations';

type Result<T> = { success: true; data: T } | { success: false; error: string };

const Id = z.string().trim().min(1).max(300).regex(/^[^/]+$/);
const message = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong. Try again.');

async function runAsMember<T>(ctx: AuthContext, workspaceId: string, capabilityId: string, input: Record<string, unknown>): Promise<Result<T>> {
  ensureCapabilitiesRegistered();
  const principal = await resolvePrincipalFromSession(workspaceId, { authContext: ctx });
  const res = await executeCapability<T>(createServerActionInvocation({ capabilityId, input, principal }));
  return res.success ? { success: true, data: res.data } : { success: false, error: res.error.message };
}

// ── Reads ──────────────────────────────────────────────────────────────────────────

export interface OutcomesView {
  header: {
    version: number;
    runId: string;
    transcriptId: string;
    promptVersion: string;
    modelId?: string;
    generatedAt: string;
    coverage: number;
    truncated: boolean;
    kept: number;
    needsReview: number;
    dropped: number;
    summary: { sentences: Array<{ text: string; itemHashes: string[] }> } | null;
  };
  items: MeetingItem[];
  /** itemHash → task id */
  tasks: Record<string, string>;
  /** itemHash → proposal */
  proposals: Record<string, { proposalId: string; status: string; executable: boolean; kind: string }>;
  drafts: Array<{ draftId: string; subject: string; recipients: string[]; createdAt: string; intelligenceVersion: number }>;
}

export async function getMeetingOutcomesAction(workspaceId: string, meetingId: string): Promise<Result<OutcomesView | null>> {
  try {
    const ws = Id.parse(workspaceId);
    const mid = Id.parse(meetingId);
    const { meeting } = await requireMeetingAccess(ws, mid, 'meetings_view');
    const stored = await readIntelligenceV2(adminDb, mid, ws);
    if (!stored) return { success: true, data: null };

    const [conversions, proposalRows, draftSnap] = await Promise.all([
      listConversions(adminDb, ws, mid),
      listMeetingProposals(adminDb, ws, mid),
      adminDb.collection(FOLLOWUP_DRAFTS).where('workspaceId', '==', ws).where('meetingId', '==', mid).where('status', '==', 'draft').limit(20).get(),
    ]);
    const proposals: OutcomesView['proposals'] = {};
    const organizationId = meeting.organizationId;
    if (organizationId) {
      for (const row of proposalRows.slice(0, 50)) {
        const approval = await getApproval(adminDb, row.approvalId, organizationId);
        if (approval?.kind === 'v2' && approval.record.workspaceId === ws) {
          proposals[row.itemHash] = { proposalId: row.approvalId, status: approval.record.status, executable: approval.record.executable, kind: row.kind };
        }
      }
    }
    const drafts = draftSnap.docs
      .map((d) => FollowupDraftSchema.safeParse(d.data()))
      .filter((d) => d.success)
      .map((d) => d.data)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((d) => ({ draftId: d.draftId, subject: d.subject, recipients: d.recipients, createdAt: d.createdAt, intelligenceVersion: d.intelligenceVersion }));

    const h = stored.header;
    const dropped = Object.values(h.counts.dropped).reduce((n, v) => n + v, 0);
    return {
      success: true,
      data: {
        header: {
          version: h.version, runId: h.runId, transcriptId: h.transcriptId, promptVersion: h.promptVersion,
          ...(h.modelId ? { modelId: h.modelId } : {}),
          generatedAt: h.generatedAt, coverage: h.coverage, truncated: h.truncated,
          kept: h.counts.kept, needsReview: h.counts.needsReview, dropped,
          summary: h.summary ? { sentences: h.summary.sentences } : null,
        },
        items: stored.items,
        tasks: Object.fromEntries(conversions),
        proposals,
        drafts,
      },
    };
  } catch (err) {
    return { success: false, error: message(err) };
  }
}

export async function getFollowupRecipientsAction(workspaceId: string, meetingId: string): Promise<Result<Array<{ email: string; name?: string; source: 'participant' | 'record_contact' }>>> {
  try {
    const ws = Id.parse(workspaceId);
    const mid = Id.parse(meetingId);
    await requireMeetingAccess(ws, mid, 'meetings_view');
    const recipients = await loadMeetingRecipients(adminDb, { workspaceId: ws, meetingId: mid }, {
      resolveContacts: async (entityId, w) => (await resolveContact(entityId, w))?.entityContacts ?? [],
    });
    return { success: true, data: recipients };
  } catch (err) {
    return { success: false, error: message(err) };
  }
}

const DealRowSchema = z.object({
  workspaceId: z.string(),
  name: z.string().catch('Untitled deal'),
  stageId: z.string().catch(''),
  pipelineId: z.string().optional().catch(undefined),
  status: z.string().optional().catch(undefined),
}).loose();
const StageRowSchema = z.object({ name: z.string().catch(''), order: z.number().catch(0) }).loose();

/** Deals of the record this meeting is linked to, with the stages of their pipeline (stage proposals). */
export async function getProposalTargetsAction(workspaceId: string, meetingId: string): Promise<Result<{
  entityId: string | null;
  deals: Array<{ dealId: string; name: string; stageId: string; stages: Array<{ stageId: string; name: string }> }>;
}>> {
  try {
    const ws = Id.parse(workspaceId);
    const mid = Id.parse(meetingId);
    await requireMeetingAccess(ws, mid, 'meetings_view');
    const meetingSnap = await adminDb.collection('meetings').doc(mid).get();
    const entityId = z.object({ entityId: z.string().min(1).optional().catch(undefined) }).loose().safeParse(meetingSnap.data() ?? {});
    const linked = entityId.success ? entityId.data.entityId ?? null : null;
    if (!linked) return { success: true, data: { entityId: null, deals: [] } };

    const dealSnap = await adminDb.collection('deals').where('workspaceId', '==', ws).where('entityId', '==', linked).limit(10).get();
    const deals = [];
    for (const doc of dealSnap.docs) {
      const deal = DealRowSchema.safeParse(doc.data());
      if (!deal.success || deal.data.workspaceId !== ws || (deal.data.status && deal.data.status !== 'open')) continue;
      const stagesSnap = deal.data.pipelineId
        ? await adminDb.collection('onboardingStages').where('pipelineId', '==', deal.data.pipelineId).limit(30).get()
        : null;
      const stages = (stagesSnap?.docs ?? [])
        .map((s) => ({ stageId: s.id, row: StageRowSchema.safeParse(s.data()) }))
        .filter((s) => s.row.success)
        .map((s) => ({ stageId: s.stageId, name: s.row.success ? s.row.data.name : '', order: s.row.success ? s.row.data.order : 0 }))
        .sort((a, b) => a.order - b.order)
        .map(({ stageId, name }) => ({ stageId, name }));
      deals.push({ dealId: doc.id, name: deal.data.name, stageId: deal.data.stageId, stages });
    }
    return { success: true, data: { entityId: linked, deals } };
  } catch (err) {
    return { success: false, error: message(err) };
  }
}

// ── Changes (governed) ─────────────────────────────────────────────────────────────

const Version = z.number().int().min(0);

export async function createFollowupTasksAction(
  workspaceId: string,
  meetingId: string,
  params: { itemHashes?: string[]; expectedVersion: number }
): Promise<Result<MeetingCreateFollowupTasksOutput>> {
  try {
    const ws = Id.parse(workspaceId);
    const mid = Id.parse(meetingId);
    const p = z.object({ itemHashes: z.array(Id).min(1).max(50).optional(), expectedVersion: Version }).parse(params);
    const { ctx } = await requireMeetingAccess(ws, mid, 'meetings_manage');
    return runAsMember(ctx, ws, 'meeting.create_followup_tasks', { workspaceId: ws, meetingId: mid, ...p });
  } catch (err) {
    return { success: false, error: message(err) };
  }
}

export async function undoFollowupTaskAction(workspaceId: string, meetingId: string, itemHash: string): Promise<Result<MeetingUndoFollowupTaskOutput>> {
  try {
    const ws = Id.parse(workspaceId);
    const mid = Id.parse(meetingId);
    const hash = Id.parse(itemHash);
    const { ctx } = await requireMeetingAccess(ws, mid, 'meetings_manage');
    return runAsMember(ctx, ws, 'meeting.undo_followup_task', { workspaceId: ws, meetingId: mid, itemHash: hash });
  } catch (err) {
    return { success: false, error: message(err) };
  }
}

export async function draftFollowupAction(
  workspaceId: string,
  meetingId: string,
  params: { recipients: string[]; expectedVersion: number }
): Promise<Result<MeetingDraftFollowupOutput>> {
  try {
    const ws = Id.parse(workspaceId);
    const mid = Id.parse(meetingId);
    const p = z.object({ recipients: z.array(z.string().trim().email().max(320)).min(1).max(20), expectedVersion: Version }).parse(params);
    const { ctx } = await requireMeetingAccess(ws, mid, 'meetings_manage');
    return runAsMember(ctx, ws, 'meeting.draft_followup', { workspaceId: ws, meetingId: mid, ...p });
  } catch (err) {
    return { success: false, error: message(err) };
  }
}

export async function deleteFollowupDraftAction(workspaceId: string, meetingId: string, draftId: string): Promise<Result<MeetingDeleteFollowupDraftOutput>> {
  try {
    const ws = Id.parse(workspaceId);
    const mid = Id.parse(meetingId);
    const id = Id.parse(draftId);
    const { ctx } = await requireMeetingAccess(ws, mid, 'meetings_manage');
    return runAsMember(ctx, ws, 'meeting.delete_followup_draft', { workspaceId: ws, meetingId: mid, draftId: id });
  } catch (err) {
    return { success: false, error: message(err) };
  }
}

export async function proposeCrmUpdateAction(
  workspaceId: string,
  meetingId: string,
  params: { itemHash: string; target: z.infer<typeof MeetingCrmTargetSchema>; expectedVersion: number }
): Promise<Result<MeetingProposeCrmUpdateOutput>> {
  try {
    const ws = Id.parse(workspaceId);
    const mid = Id.parse(meetingId);
    const p = z.object({ itemHash: Id, target: MeetingCrmTargetSchema, expectedVersion: Version }).parse(params);
    const { ctx } = await requireMeetingAccess(ws, mid, 'meetings_manage');
    return runAsMember(ctx, ws, 'meeting.propose_crm_update', { workspaceId: ws, meetingId: mid, ...p });
  } catch (err) {
    return { success: false, error: message(err) };
  }
}
