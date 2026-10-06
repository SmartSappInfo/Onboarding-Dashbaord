'use server';

/**
 * @fileoverview Server Actions for AI Meeting Intelligence, Action Item Execution, and Pre-Meeting Briefs.
 * Uses Gemini API with structured JSON output and provides full CRM integration.
 *
 * SECURITY (Phase 11 M1 · T0, findings G3/G4): every action now proves meetings permission AND that
 * the meeting belongs to the caller's workspace (`requireMeetingAccess`). Before, a member of one
 * workspace could generate, read or convert another workspace's meeting data by id.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All AI mutations are stored in `meeting_intelligence/{meetingId}`.
 * - Action item conversion is idempotent: a claim on the action item (transaction) guarantees one
 *   task per item even on double-clicks or retries; the task is written by the task domain core
 *   (`createTaskCore`), never by a direct `tasks` write (Rule 69).
 * - Zero 'any' policy strictly enforced.
 */

import { z } from 'zod/v4';
import { adminDb } from '@/lib/firebase-admin';
import type {
  MeetingIntelligence,
  MeetingPrepBrief,
} from '@/lib/meetings/types/intelligence';
import { logMeetingActivity } from '@/lib/meetings/activity-logger';
import { requireMeetingAccess } from '@/lib/meetings/meeting-auth';
import { createTaskCore } from '@/lib/tasks/task-core';
import { executeCapability } from '@/platform/capabilities/execution/execute-capability';
import { createServerActionInvocation } from '@/platform/capabilities/execution/invocation';
import { ensureCapabilitiesRegistered } from '@/platform/capabilities/registry/register-capabilities';
import { resolvePrincipalFromSession } from '@/platform/capabilities/policy/session-principal-resolver';
import type {
  MeetingExtractIntelligenceOutput,
  MeetingGeneratePrepBriefOutput,
} from '@/platform/domains/meetings_conversations';
import { readMeetingAnalysis, type RunProgress } from '@/lib/meetings/intelligence/intelligence-read';
import type { AuthContext } from '@/lib/auth/require-auth';
import { toLegacyIntelligence } from '@/lib/meetings/intelligence/legacy-adapter';
import { convertItemToTask, findV2Item, ItemConversionError, listConversions } from '@/lib/meetings/intelligence/item-conversion';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/** Boundary schema for the parts of `meeting_intelligence` this file mutates (Rule 4). */
const ActionItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  assigneeName: z.string().optional(),
  assigneeEmail: z.string().optional(),
  assigneeUserId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).catch('medium'),
  status: z.enum(['open', 'completed', 'converted_to_crm_task', 'dismissed']).catch('open'),
  crmTaskId: z.string().optional(),
  conversionClaimedAt: z.string().optional(),
}).loose();
type MeetingActionItem = z.infer<typeof ActionItemSchema>;

const IntelligenceActionItemsSchema = z.object({
  workspaceId: z.string(),
  organizationId: z.string().optional(),
  actionItems: z.array(ActionItemSchema).default([]),
});


/** Progress of the analysis for the latest transcript (for the UI's "Analysing…" state). */
export type IntelligenceProgress = RunProgress;

type IntelligenceErrorCode = 'NO_TRANSCRIPT' | 'AI_UNAVAILABLE' | 'NOT_ALLOWED';

async function runAsMember<T>(ctx: AuthContext, workspaceId: string, capabilityId: string, input: Record<string, unknown>) {
  ensureCapabilitiesRegistered();
  const principal = await resolvePrincipalFromSession(workspaceId, { authContext: ctx });
  return executeCapability<T>(createServerActionInvocation({ capabilityId, input, principal }));
}

/**
 * Reads v2 analysis (adapted to the v1 shape the UI renders) plus run progress, through the shared
 * read service. People are authorised by `requireMeetingAccess` before this runs; legacy roles have
 * no gateway view scope (M1 · T1 decision), so UI reads don't go through the gateway.
 */
async function readAnalysis(workspaceId: string, meetingId: string) {
  const { stored, run } = await readMeetingAnalysis(adminDb, workspaceId, meetingId);
  const intelligence = stored ? toLegacyIntelligence(stored.header, stored.items, await listConversions(adminDb, workspaceId, meetingId)) : undefined;
  return { ok: true as const, intelligence, progress: run ?? undefined };
}

/**
 * Starts (or rejoins) the evidence-checked analysis of the meeting's latest transcript.
 *
 * Phase 11 M2 · T3.5 (G13): the direct model call is gone. This runs the governed
 * `meeting.extract_intelligence` capability (consent, AI use, data policy, quota, audit), which
 * queues `meeting_postprocess_v2`. Analysis is asynchronous: the result is `pending` until the run
 * completes; `getMeetingIntelligenceAction` reports progress. When this transcript was already
 * analysed, the stored analysis is returned immediately.
 * FAIL CLOSED (M1 · T7): nothing is invented and nothing is stored when anything is refused.
 */
export async function generateMeetingIntelligenceAction(
  meetingId: string,
  workspaceId: string
): Promise<{
  success: boolean;
  intelligence?: MeetingIntelligence;
  progress?: IntelligenceProgress;
  status?: MeetingExtractIntelligenceOutput['status'];
  error?: string;
  code?: IntelligenceErrorCode;
}> {
  const { ctx } = await requireMeetingAccess(workspaceId, meetingId, 'meetings_manage');
  try {
    const res = await runAsMember<MeetingExtractIntelligenceOutput>(ctx, workspaceId, 'meeting.extract_intelligence', { workspaceId, meetingId });
    if (!res.success) {
      const code: IntelligenceErrorCode | undefined =
        res.error.code === 'NOT_FOUND' ? 'NO_TRANSCRIPT'
          : res.error.code === 'FORBIDDEN' ? 'NOT_ALLOWED'
            : res.error.code === 'PROVIDER_ERROR' ? 'AI_UNAVAILABLE' : undefined;
      return { success: false, error: res.error.message, ...(code ? { code } : {}) };
    }
    if (!res.data.replayed) {
      await logMeetingActivity({
        workspaceId,
        meetingId,
        actorType: 'user',
        actorId: ctx.uid,
        type: 'intelligence_generated',
        description: 'Meeting analysis started',
      });
    }
    const analysis = await readAnalysis(workspaceId, meetingId);
    const done = res.data.status === 'completed' && analysis.intelligence;
    return {
      success: true,
      status: res.data.status,
      ...(done && analysis.intelligence ? { intelligence: analysis.intelligence } : {}),
      ...(analysis.progress ? { progress: analysis.progress } : {}),
    };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/** Boundary schema for a v1 (pre-M2) intelligence document, shown until it is re-analysed. */
const LegacyIntelligenceSchema = z.object({
  workspaceId: z.string(),
  meetingId: z.string(),
  executiveSummary: z.string().catch(''),
  keyTopics: z.array(z.string()).catch([]),
  keyDecisions: z.array(z.string()).catch([]),
  actionItems: z.array(ActionItemSchema).catch([]),
  buyingSignals: z.array(z.object({ topic: z.string(), quote: z.string(), strength: z.enum(['weak', 'moderate', 'strong']).catch('weak') })).catch([]),
  objections: z.array(z.object({
    category: z.enum(['pricing', 'timing', 'feature', 'competitor', 'authority', 'other']).catch('other'),
    statement: z.string(),
    severity: z.enum(['low', 'medium', 'high']).catch('medium'),
    suggestedResponse: z.string().optional(),
  })).catch([]),
  dealRisks: z.array(z.string()).catch([]),
  sentiment: z.object({
    category: z.enum(['positive', 'neutral', 'negative', 'mixed']),
    score: z.number(),
    explanation: z.string(),
  }).optional().catch(undefined),
  modelUsed: z.string().optional(),
  recommendedFollowUp: z.string().catch(''),
  generatedAt: z.string().catch(''),
  updatedAt: z.string().catch(''),
  transcriptId: z.string().optional(),
}).loose();

/**
 * The stored analysis for a meeting: v2 (adapted) when present, else a validated v1 document.
 * Also returns the progress of any analysis in flight.
 */
export async function getMeetingIntelligenceAction(
  meetingId: string,
  workspaceId: string
): Promise<{ success: boolean; intelligence?: MeetingIntelligence; progress?: IntelligenceProgress; error?: string }> {
  await requireMeetingAccess(workspaceId, meetingId, 'meetings_view');
  try {
    const analysis = await readAnalysis(workspaceId, meetingId);
    if (analysis.intelligence) return { success: true, intelligence: analysis.intelligence, ...(analysis.progress ? { progress: analysis.progress } : {}) };

    const doc = await adminDb.collection('meeting_intelligence').doc(meetingId).get();
    const legacy = doc.exists ? LegacyIntelligenceSchema.safeParse(doc.data()) : null;
    if (!legacy?.success || legacy.data.workspaceId !== workspaceId) {
      return { success: true, ...(analysis.progress ? { progress: analysis.progress } : {}) };
    }
    const v1 = legacy.data;
    const intelligence: MeetingIntelligence = {
      id: meetingId,
      workspaceId,
      meetingId,
      ...(v1.transcriptId ? { transcriptId: v1.transcriptId } : {}),
      executiveSummary: v1.executiveSummary,
      keyTopics: v1.keyTopics,
      keyDecisions: v1.keyDecisions,
      actionItems: v1.actionItems.map(({ conversionClaimedAt: _claim, ...item }) => item),
      buyingSignals: v1.buyingSignals,
      objections: v1.objections,
      dealRisks: v1.dealRisks,
      ...(v1.sentiment ? { sentiment: v1.sentiment } : {}),
      recommendedFollowUp: v1.recommendedFollowUp,
      ...(v1.modelUsed ? { modelUsed: v1.modelUsed } : {}),
      status: 'completed',
      generatedAt: v1.generatedAt,
      updatedAt: v1.updatedAt,
    };
    return { success: true, intelligence, ...(analysis.progress ? { progress: analysis.progress } : {}) };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Converts a meeting action item into a workspace CRM Task.
 *
 * Idempotency (Rules 19/20): the action item is claimed in a transaction (`converting` +
 * `conversionClaimedAt`). A second click while converting is refused; a click after success returns
 * the same task id; a stale claim (> 2 min, e.g. a crashed request) can be re-claimed.
 */
const CONVERSION_CLAIM_MS = 2 * 60 * 1000;

type ConversionClaim =
  | { kind: 'done'; crmTaskId: string }
  | { kind: 'claimed'; item: MeetingActionItem; organizationId?: string };

export async function convertActionItemToCrmTaskAction(
  meetingId: string,
  workspaceId: string,
  actionItemId: string
): Promise<{ success: boolean; crmTaskId?: string; error?: string }> {
  const { ctx, meeting } = await requireMeetingAccess(workspaceId, meetingId, 'meetings_manage');

  // v2 analysis (M2 · T3.5): items live in a subcollection; the claim is a separate record keyed by
  // the item hash, so it survives re-analysis (see item-conversion.ts).
  if (await findV2Item(adminDb, workspaceId, meetingId, actionItemId)) {
    try {
      const result = await convertItemToTask(adminDb, {
        nowMs: () => Date.now(),
        createTask: (item) => createTaskCore(
          {
            workspaceId,
            organizationId: meeting.organizationId ?? ctx.profile.organizationId,
            title: item.text,
            description: `From meeting ${meeting.title ?? meetingId}. Owner: ${item.owner?.matched ? item.owner.name : 'Unassigned'}.`,
            priority: 'medium',
            status: 'todo',
            category: 'follow_up',
            // Owner shown, never guessed (plan §4.6): a matched user, else the person converting it.
            assignedTo: item.owner?.matched && item.owner.userId ? item.owner.userId : ctx.uid,
            dueDate: item.dueIso ?? new Date().toISOString(),
            reminders: [],
            reminderSent: false,
            source: 'system',
            relatedEntityType: 'Meeting',
            relatedEntityId: meetingId,
            relatedParentId: item.itemHash,
          },
          { kind: 'user', uid: ctx.uid }
        ),
      }, { workspaceId, meetingId, itemHash: actionItemId, actorUid: ctx.uid });
      if (!result.replayed) {
        await logMeetingActivity({
          workspaceId, meetingId, actorType: 'user', actorId: ctx.uid, type: 'action_item_converted',
          description: 'Converted a meeting action item into a task',
        });
      }
      return { success: true, crmTaskId: result.taskId };
    } catch (err) {
      return { success: false, error: err instanceof ItemConversionError ? err.message : getErrorMessage(err) };
    }
  }

  const docRef = adminDb.collection('meeting_intelligence').doc(meetingId);

  let claim: ConversionClaim;
  try {
    claim = await adminDb.runTransaction(async (tx): Promise<ConversionClaim> => {
      const snap = await tx.get(docRef);
      const parsed = snap.exists ? IntelligenceActionItemsSchema.safeParse(snap.data()) : null;
      // Missing and foreign records look the same (no cross-tenant probing).
      if (!parsed?.success || parsed.data.workspaceId !== workspaceId) {
        throw new Error('Meeting intelligence not found.');
      }
      const items = parsed.data.actionItems;
      const index = items.findIndex(i => i.id === actionItemId);
      if (index === -1) throw new Error('Action item not found in intelligence record.');
      const item = items[index];

      if (item.crmTaskId) return { kind: 'done', crmTaskId: item.crmTaskId };
      const claimedAt = item.conversionClaimedAt ? Date.parse(item.conversionClaimedAt) : Number.NaN;
      if (!Number.isNaN(claimedAt) && Date.now() - claimedAt < CONVERSION_CLAIM_MS) {
        throw new Error('This action item is already being converted. Try again in a moment.');
      }

      const next = [...items];
      next[index] = { ...item, conversionClaimedAt: new Date().toISOString() };
      tx.update(docRef, { actionItems: next });
      return { kind: 'claimed', item, organizationId: parsed.data.organizationId };
    });
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }

  if (claim.kind === 'done') return { success: true, crmTaskId: claim.crmTaskId };

  const { item } = claim;
  const now = new Date().toISOString();
  const result = await createTaskCore(
    {
      workspaceId,
      organizationId: claim.organizationId ?? meeting.organizationId ?? ctx.profile.organizationId,
      title: item.text,
      description: `Action item from meeting ${meeting.title ?? meetingId}. Assignee: ${item.assigneeName || 'Unassigned'}`,
      priority: item.priority || 'medium',
      status: 'todo',
      category: 'follow_up',
      assignedTo: item.assigneeUserId || ctx.uid,
      dueDate: item.dueDate || now,
      reminders: [],
      reminderSent: false,
      source: 'system',
      relatedEntityType: 'Meeting',
      relatedEntityId: meetingId,
      relatedParentId: actionItemId,
    },
    { kind: 'user', uid: ctx.uid }
  );

  // Record the outcome on the item (release the claim on failure so the user can retry).
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const parsed = IntelligenceActionItemsSchema.safeParse(snap.data());
    if (!parsed.success) return;
    const next = parsed.data.actionItems.map(i => {
      if (i.id !== actionItemId) return i;
      const { conversionClaimedAt: _released, ...rest } = i;
      return result.success && result.id
        ? { ...rest, status: 'converted_to_crm_task' as const, crmTaskId: result.id }
        : rest;
    });
    tx.update(docRef, { actionItems: next, updatedAt: now });
  });

  if (!result.success || !result.id) {
    return { success: false, error: result.error || 'Could not create the task. Try again.' };
  }

  await logMeetingActivity({
    workspaceId,
    meetingId,
    actorType: 'user',
    actorId: ctx.uid,
    type: 'action_item_converted',
    description: `Converted action item "${item.text.slice(0, 40)}..." into CRM Task`,
  });

  return { success: true, crmTaskId: result.id };
}

/**
 * Generates an automated Pre-Meeting Prep Briefing summarizing attendee CRM history.
 */
export async function generateMeetingPrepBriefAction(
  meetingId: string,
  workspaceId: string
): Promise<{ success: boolean; brief?: MeetingPrepBrief; error?: string }> {
  const { ctx } = await requireMeetingAccess(workspaceId, meetingId, 'meetings_view');

  // Phase 11 M2 · T2 (F5): the template text is gone. The governed capability builds a brief whose
  // every item cites workspace records, or a labelled facts-only brief when AI is unavailable.
  try {
    ensureCapabilitiesRegistered();
    const principal = await resolvePrincipalFromSession(workspaceId, { authContext: ctx });
    const result = await executeCapability<MeetingGeneratePrepBriefOutput>(
      createServerActionInvocation({ capabilityId: 'meeting.generate_prep_brief', input: { workspaceId, meetingId }, principal })
    );
    return result.success ? { success: true, brief: result.data } : { success: false, error: result.error.message };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
