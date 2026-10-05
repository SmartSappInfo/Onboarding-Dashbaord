import 'server-only';

/**
 * @fileOverview One meeting-ownership check for every server path (Phase 11 M1 · T0, finding G12).
 *
 * WHY
 * Meetings are shared across workspaces (`workspaceIds[]`, see feature_meetings.md) and newer code
 * also writes a scalar `workspaceId`. Ownership checks were ad hoc, and several actions skipped
 * them entirely (G1, G3, G4), so a member of workspace A could read or change workspace B's meeting
 * data just by passing B's meeting id with A's workspace id.
 *
 * CONTRACT
 * - A meeting belongs to a workspace when `workspaceIds` contains it OR `workspaceId` equals it.
 * - A missing meeting and a foreign meeting produce the SAME error, so callers can't probe which
 *   meeting ids exist in other tenants (Rule 8).
 * - Returns the scope the gateway needs (`resolveResourceScope`, step 07) and the version token
 *   used for TOCTOU checks (Rule 18).
 *
 * CAUTION: call `requireWorkspace(workspaceId)` (or the gateway) BEFORE this. This helper proves
 * the meeting is in the workspace; it does not prove the caller is in the workspace.
 *
 * Tests: src/lib/meetings/__tests__/meeting-access.test.ts
 */

import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod/v4';

export class MeetingNotFoundError extends Error {
  readonly status = 404;
  readonly code = 'NOT_FOUND';
  constructor() {
    super('Meeting not found.');
    this.name = 'MeetingNotFoundError';
  }
}

/** Only the fields ownership needs; everything else on the meeting is ignored (Rule 4). */
const MeetingOwnershipSchema = z.object({
  workspaceIds: z.array(z.string()).optional(),
  workspaceId: z.string().optional(),
  organizationId: z.string().optional(),
  updatedAt: z.string().optional(),
  title: z.string().optional(),
});

export interface MeetingScope {
  meetingId: string;
  workspaceId: string;
  organizationId?: string;
  /** Version token for optimistic concurrency (falls back to '' for legacy docs without one). */
  resourceVersion: string;
  title?: string;
}

/** Pure ownership rule, exported for reuse (e.g. bulk paths that already loaded the meeting). */
export function meetingBelongsToWorkspace(
  meeting: { workspaceIds?: readonly string[]; workspaceId?: string },
  workspaceId: string
): boolean {
  if (!workspaceId) return false;
  if (meeting.workspaceId === workspaceId) return true;
  return Array.isArray(meeting.workspaceIds) && meeting.workspaceIds.includes(workspaceId);
}

async function defaultDb(): Promise<Firestore> {
  const { adminDb } = await import('@/lib/firebase-admin');
  return adminDb;
}

/**
 * Loads the meeting and proves it belongs to `workspaceId`.
 * @throws {MeetingNotFoundError} when the meeting is missing, malformed or in another workspace.
 */
export async function assertMeetingInWorkspace(
  meetingId: string,
  workspaceId: string,
  db?: Firestore
): Promise<MeetingScope> {
  if (!meetingId || !workspaceId || meetingId.includes('/')) {
    throw new MeetingNotFoundError();
  }
  const firestore = db ?? (await defaultDb());
  const snap = await firestore.collection('meetings').doc(meetingId).get();
  if (!snap.exists) throw new MeetingNotFoundError();

  const parsed = MeetingOwnershipSchema.safeParse(snap.data());
  if (!parsed.success || !meetingBelongsToWorkspace(parsed.data, workspaceId)) {
    throw new MeetingNotFoundError();
  }

  return {
    meetingId,
    workspaceId,
    organizationId: parsed.data.organizationId,
    resourceVersion: parsed.data.updatedAt ?? '',
    title: parsed.data.title,
  };
}
