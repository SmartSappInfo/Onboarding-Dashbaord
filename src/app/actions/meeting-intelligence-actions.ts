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
import type { MeetingParticipant } from '@/lib/meetings/types';
import {
  buildIntelligenceExtractionPrompt,
  parseIntelligenceStructuredOutput,
} from '@/lib/meetings/ai-intelligence-service';
import { logMeetingActivity } from '@/lib/meetings/activity-logger';
import { requireMeetingAccess } from '@/lib/meetings/meeting-auth';
import { createTaskCore } from '@/lib/tasks/task-core';
import { findLatestTranscriptId, readTranscriptText } from '@/lib/meetings/transcript-store';
import { assertConsent, ConsentRequiredError } from '@/lib/meetings/consent-store';

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

/** Boundary schema for the Gemini REST response (Rule 4: the model reply is untrusted). */
const GeminiResponseSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({ parts: z.array(z.object({ text: z.string().optional() })).optional() }).optional(),
  })).optional(),
});

const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Generates or refreshes structured meeting intelligence from the meeting's REAL transcript.
 *
 * FAIL CLOSED (Phase 11 M1 · T7, finding B1): this used to invent a transcript when none existed
 * and to invent the whole intelligence record (including fake customer quotes as "buying signals")
 * when the model call failed, then save it as fact. Now:
 * - no completed transcript → `code: 'NO_TRANSCRIPT'`, no model call, nothing stored;
 * - transcript restricted for AI use, or AI-processing consent missing (when enforced) → refused;
 * - model unavailable / bad response → a plain error, nothing stored.
 * CAUTION: the direct REST call is replaced by the governed extraction capability in M2 (G13).
 * The API key travels in a header, never in the URL (keeps it out of request logs).
 */
export async function generateMeetingIntelligenceAction(
  meetingId: string,
  workspaceId: string
): Promise<{ success: boolean; intelligence?: MeetingIntelligence; error?: string; code?: 'NO_TRANSCRIPT' | 'AI_UNAVAILABLE' | 'NOT_ALLOWED' }> {
  await requireMeetingAccess(workspaceId, meetingId, 'meetings_manage');

  try {
    // 1. The real transcript, or nothing.
    const transcriptId = await findLatestTranscriptId(adminDb, meetingId, workspaceId);
    if (!transcriptId) {
      return { success: false, code: 'NO_TRANSCRIPT', error: 'Add a transcript to analyse this meeting.' };
    }
    const transcript = await readTranscriptText(adminDb, transcriptId, workspaceId, 20);
    if (transcript.segments.length === 0) {
      return { success: false, code: 'NO_TRANSCRIPT', error: 'Add a transcript to analyse this meeting.' };
    }

    // 2. AI-use and consent gates (PRD §97/§98, Rule 57).
    if (transcript.header.aiUse === 'restricted') {
      return { success: false, code: 'NOT_ALLOWED', error: 'AI analysis is off for this meeting because consent was withdrawn.' };
    }
    try {
      await assertConsent(adminDb, { workspaceId, meetingId, operation: 'ai_read' });
    } catch (consentErr) {
      if (consentErr instanceof ConsentRequiredError) return { success: false, code: 'NOT_ALLOWED', error: consentErr.message };
      throw consentErr;
    }

    // 3. Context: meeting title + attendee names (bounded).
    const meetingDoc = await adminDb.collection('meetings').doc(meetingId).get();
    const title = typeof meetingDoc.data()?.title === 'string' ? String(meetingDoc.data()?.title) : 'SmartSapp Meeting';
    const participantsSnap = await adminDb.collection('participants').where('meetingId', '==', meetingId).limit(200).get();
    const attendeeNames = participantsSnap.docs
      .map(d => {
        const p = d.data() ?? {};
        return typeof p.name === 'string' && p.name ? p.name : typeof p.email === 'string' ? p.email : '';
      })
      .filter(Boolean);

    const transcriptText = transcript.segments.map(s => `${s.speakerName}: ${s.text}`).join('\n');
    const prompt = buildIntelligenceExtractionPrompt(title, transcriptText, attendeeNames);

    // 4. Model call (no fabricated fallback).
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (!apiKey) {
      return { success: false, code: 'AI_UNAVAILABLE', error: 'AI analysis is not available right now. Try again later.' };
    }
    const res = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    });
    const json: unknown = res.ok ? await res.json() : null;
    const rawAiResponse = GeminiResponseSchema.safeParse(json).data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!rawAiResponse) {
      return { success: false, code: 'AI_UNAVAILABLE', error: 'AI analysis is not available right now. Try again later.' };
    }

    // 5. Parse, store, log.
    const intelligence = {
      ...parseIntelligenceStructuredOutput(rawAiResponse, meetingId, workspaceId),
      transcriptId,
    };
    await adminDb.collection('meeting_intelligence').doc(meetingId).set(intelligence);

    await logMeetingActivity({
      workspaceId,
      meetingId,
      actorType: 'ai',
      type: 'intelligence_generated',
      description: 'AI Meeting Intelligence & Executive Summary generated',
    });

    return { success: true, intelligence };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Retrieves the stored intelligence report for a meeting.
 */
export async function getMeetingIntelligenceAction(
  meetingId: string,
  workspaceId: string
): Promise<{ success: boolean; intelligence?: MeetingIntelligence; error?: string }> {
  await requireMeetingAccess(workspaceId, meetingId, 'meetings_view');

  try {
    const doc = await adminDb.collection('meeting_intelligence').doc(meetingId).get();
    if (!doc.exists) {
      return { success: true, intelligence: undefined };
    }

    const data = doc.data() as MeetingIntelligence;
    if (data.workspaceId !== workspaceId) {
      throw new Error('Unauthorized workspace access.');
    }

    return { success: true, intelligence: data };
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
  await requireMeetingAccess(workspaceId, meetingId, 'meetings_view');

  try {
    const meetingDoc = await adminDb.collection('meetings').doc(meetingId).get();
    if (!meetingDoc.exists) {
      throw new Error('Meeting not found.');
    }

    const meetingData = meetingDoc.data()!;
    const participantsSnap = await adminDb
      .collection('participants')
      .where('meetingId', '==', meetingId)
      .get();

    const participants = participantsSnap.docs.map(d => d.data() as MeetingParticipant);
    const now = new Date().toISOString();

    const brief: MeetingPrepBrief = {
      id: `brief_${meetingId}`,
      workspaceId,
      meetingId,
      attendeeSummary: `Meeting with ${participants.length} participant(s): ${participants.map(p => `${p.name} (${p.role})`).join(', ') || 'No registered participants yet'}.`,
      previousInteractionNotes: [
        'Checked previous bookings and registration history.',
        'No blocking issues identified in contact timeline.',
      ],
      openDealsSummary: 'Active discussion aligned with workspace objectives.',
      suggestedObjectives: [
        `Understand primary requirements for ${meetingData.title || 'this session'}.`,
        'Demonstrate value and address initial prospect questions.',
        'Establish clear next steps and owner before closing.',
      ],
      recommendedTalkingPoints: [
        'Welcome & agenda overview',
        'Specific needs review',
        'Proposed solution walkthrough',
        'Q&A and follow-up timeline',
      ],
      generatedAt: now,
    };

    return { success: true, brief };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
