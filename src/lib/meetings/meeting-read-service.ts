import 'server-only';

/**
 * @fileOverview Shared, workspace-scoped meeting reads (Phase 11 M1 · T1, findings G11/G12).
 *
 * ONE implementation for both the legacy Server Actions (human UI) and the governed `meeting.*`
 * capabilities (agents, MCP). Callers authorize first; this module guarantees tenant scoping,
 * bounded reads (Rule 9) and minimal, schema-validated projections (Rules 4, 31, 48).
 *
 * WHAT IS DELIBERATELY LEFT OUT OF PROJECTIONS
 * - Public-page branding, banner embed code, SEO, registration config: not meeting knowledge.
 * - Participant join-token hashes, phone numbers, notes: secrets or unneeded PII (Rule 32).
 * - Recording URLs in `projectRecordingForAgent`: signed or external media links are credential-like
 *   and never go to agents/MCP (M1 plan §7.2). The human UI uses `toClientRecording`.
 *
 * CAUTION: `searchMeetings` finds meetings through `workspaceIds` (the canonical shared field and
 * the existing composite index). Legacy docs with ONLY a scalar `workspaceId` are reachable by id
 * (`getMeetingDetail`) but not listed; that matches every existing meeting list in the app.
 *
 * Tests: src/platform/__tests__/domains/meetings-conversations.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';
import { assertMeetingInWorkspace } from './meeting-access';
import { MeetingRecordingRecordSchema, recordingStoragePrefix } from './schemas/recording-schemas';

export const MEETING_SEARCH_MAX = 50;
export const MEETING_PARTICIPANTS_MAX = 200;
export const MEETING_RECORDINGS_MAX = 100;

const MeetingStatusSchema = z.enum(['scheduled', 'active', 'ended', 'cancelled']);

const MeetingRecordSchema = z.object({
  title: z.string().optional(),
  meetingTime: z.string().catch(''),
  type: z.object({ name: z.string().optional(), slug: z.string().optional() }).loose().optional().catch(undefined),
  entityId: z.string().nullable().optional(),
  entityName: z.string().nullable().optional(),
  status: MeetingStatusSchema.optional().catch(undefined),
  hostName: z.string().optional(),
  hasRecording: z.boolean().optional(),
  hasTranscript: z.boolean().optional(),
  updatedAt: z.string().optional(),
});

export const MeetingSummarySchema = z.object({
  meetingId: z.string(),
  title: z.string(),
  meetingTime: z.string(),
  typeName: z.string().nullable(),
  entityId: z.string().nullable(),
  entityName: z.string().nullable(),
  status: MeetingStatusSchema.nullable(),
  hasRecording: z.boolean(),
  hasTranscript: z.boolean(),
});
export type MeetingSummary = z.infer<typeof MeetingSummarySchema>;

const ParticipantRecordSchema = z.object({
  name: z.string().catch(''),
  email: z.string().catch(''),
  role: z.string().catch('attendee'),
  rsvpStatus: z.string().catch('pending'),
  attendanceStatus: z.string().catch('not_joined'),
  contactId: z.string().optional(),
});

export const MeetingParticipantSummarySchema = z.object({
  name: z.string(),
  email: z.string(),
  role: z.string(),
  rsvpStatus: z.string(),
  attendanceStatus: z.string(),
  contactId: z.string().nullable(),
});

export const MeetingDetailSchema = MeetingSummarySchema.extend({
  hostName: z.string().nullable(),
  participants: z.array(MeetingParticipantSummarySchema),
  participantsTruncated: z.boolean(),
  resourceVersion: z.string(),
});
export type MeetingDetail = z.infer<typeof MeetingDetailSchema>;

export const AgentRecordingSchema = z.object({
  recordingId: z.string(),
  kind: z.enum(['uploaded', 'external_link']),
  provider: z.string(),
  durationSeconds: z.number(),
  format: z.string().nullable(),
  status: z.string(),
  createdAt: z.string(),
});
export type AgentRecording = z.infer<typeof AgentRecordingSchema>;

function toSummary(meetingId: string, raw: unknown): MeetingSummary | null {
  const parsed = MeetingRecordSchema.safeParse(raw);
  if (!parsed.success) return null;
  const m = parsed.data;
  return {
    meetingId,
    title: m.title?.trim() || 'Untitled meeting',
    meetingTime: m.meetingTime,
    typeName: m.type?.name ?? null,
    entityId: m.entityId ?? null,
    entityName: m.entityName ?? null,
    status: m.status ?? null,
    hasRecording: m.hasRecording === true,
    hasTranscript: m.hasTranscript === true,
  };
}

export interface MeetingSearchParams {
  workspaceId: string;
  /** Case-insensitive match on title or entity name, applied to the bounded page. */
  query?: string;
  /** ISO date-time bounds on `meetingTime` (inclusive). */
  from?: string;
  to?: string;
  entityId?: string;
  limit?: number;
}

/** Newest meetings first, bounded to `MEETING_SEARCH_MAX`. */
export async function searchMeetings(db: Firestore, params: MeetingSearchParams): Promise<{ meetings: MeetingSummary[]; truncated: boolean }> {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), MEETING_SEARCH_MAX);
  let q = db.collection('meetings').where('workspaceIds', 'array-contains', params.workspaceId);
  if (params.from) q = q.where('meetingTime', '>=', params.from);
  if (params.to) q = q.where('meetingTime', '<=', params.to);
  q = q.orderBy('meetingTime', 'desc');

  // Text filtering happens in memory, so over-read a bounded page (never the whole collection).
  const needle = params.query?.trim().toLowerCase();
  const scan = needle || params.entityId ? Math.min(limit * 4, 200) : limit + 1;
  const snap = await q.limit(scan).get();

  const all = snap.docs
    .map((d) => toSummary(d.id, d.data()))
    .filter((m): m is MeetingSummary => m !== null)
    .filter((m) => !params.entityId || m.entityId === params.entityId)
    .filter((m) => !needle || m.title.toLowerCase().includes(needle) || (m.entityName ?? '').toLowerCase().includes(needle));

  return { meetings: all.slice(0, limit), truncated: all.length > limit || snap.docs.length === scan };
}

/**
 * The newest meetings with one record, strictly before `before` (ISO), in this workspace only.
 * A direct indexed query (workspaceIds CONTAINS + entityId + meetingTime DESC), so older meetings
 * with the record are found however busy the workspace is (M2 review R4: the search path scanned
 * only the newest 24 workspace meetings and filtered by record in memory).
 */
export async function listMeetingsWithRecord(
  db: Firestore,
  params: { workspaceId: string; entityId: string; before?: string; limit: number }
): Promise<MeetingSummary[]> {
  const limit = Math.min(Math.max(params.limit, 1), MEETING_SEARCH_MAX);
  let q = db.collection('meetings')
    .where('workspaceIds', 'array-contains', params.workspaceId)
    .where('entityId', '==', params.entityId);
  if (params.before) q = q.where('meetingTime', '<', params.before);
  const snap = await q.orderBy('meetingTime', 'desc').limit(limit).get();
  return snap.docs
    .map((d) => toSummary(d.id, d.data()))
    .filter((m): m is MeetingSummary => m !== null && m.entityId === params.entityId);
}

/** One meeting with its participants. Ownership is proven here (NOT_FOUND when foreign). */
export async function getMeetingDetail(db: Firestore, meetingId: string, workspaceId: string): Promise<MeetingDetail> {
  const scope = await assertMeetingInWorkspace(meetingId, workspaceId, db);
  const [meetingSnap, participantsSnap] = await Promise.all([
    db.collection('meetings').doc(meetingId).get(),
    db.collection('participants').where('meetingId', '==', meetingId).limit(MEETING_PARTICIPANTS_MAX + 1).get(),
  ]);
  const summary = toSummary(meetingId, meetingSnap.data());
  const hostName = MeetingRecordSchema.safeParse(meetingSnap.data());
  const participants = participantsSnap.docs
    .slice(0, MEETING_PARTICIPANTS_MAX)
    .map((d) => ParticipantRecordSchema.safeParse(d.data()))
    .filter((p) => p.success)
    .map((p) => ({ ...p.data, contactId: p.data.contactId ?? null }));

  return {
    ...(summary ?? {
      meetingId, title: 'Untitled meeting', meetingTime: '', typeName: null, entityId: null,
      entityName: null, status: null, hasRecording: false, hasTranscript: false,
    }),
    hostName: hostName.success ? hostName.data.hostName ?? null : null,
    participants,
    participantsTruncated: participantsSnap.docs.length > MEETING_PARTICIPANTS_MAX,
    resourceVersion: scope.resourceVersion,
  };
}

/** Recording metadata for agents/MCP: never any URL (Rule 32). */
export async function listRecordingsForAgent(db: Firestore, meetingId: string, workspaceId: string): Promise<AgentRecording[]> {
  await assertMeetingInWorkspace(meetingId, workspaceId, db);
  const snap = await db
    .collection('meeting_recordings')
    .where('meetingId', '==', meetingId)
    .where('workspaceId', '==', workspaceId)
    .limit(MEETING_RECORDINGS_MAX)
    .get();

  const prefix = recordingStoragePrefix(workspaceId, meetingId);
  return snap.docs.flatMap((d) => {
    const parsed = MeetingRecordingRecordSchema.safeParse(d.data());
    if (!parsed.success || parsed.data.status === 'deleted') return [];
    const r = parsed.data;
    return [{
      recordingId: d.id,
      kind: r.storagePath?.startsWith(prefix) ? 'uploaded' as const : 'external_link' as const,
      provider: r.provider,
      durationSeconds: r.durationSeconds,
      format: r.format ?? null,
      status: r.status,
      createdAt: r.createdAt,
    }];
  });
}
