import 'server-only';

/**
 * @fileOverview Server-action guard for meeting data (Phase 11 M1 · T0, findings G1–G4).
 *
 * Every meeting server action is a public HTTP endpoint (Next.js Server Functions, Rule 51), so each
 * one must prove, in order:
 *   1. the caller is signed in and belongs to the workspace (`requireWorkspace`);
 *   2. the caller holds the meetings permission for the operation, in THAT workspace;
 *   3. the meeting belongs to that workspace (`assertMeetingInWorkspace`).
 *
 * PERMISSIONS (existing ones only; no role migration, D10):
 * - 'meetings_view'   → reads (recordings list, intelligence, prep brief). Workspace membership is
 *   enough, exactly as today: the legacy permission list has no meetings-view permission, so
 *   requiring one would lock out every legacy-role member (functionality loss).
 * - 'meetings_manage' → mutations (attach/delete recordings, generate intelligence, convert action
 *   items, compliance policy). Everyone who edits meetings today already holds it.
 * System administrators keep their existing bypass (same as `requireWorkspace`).
 *
 * CAUTION: `checkWorkspacePermission` fails closed on lookup errors. Keep it that way.
 *
 * Tests: src/lib/__tests__/meetings/meeting-actions-security.test.ts
 */

import { requireWorkspace, ForbiddenError, type AuthContext } from '@/lib/auth/require-auth';
import { checkWorkspacePermission } from '@/lib/workspace-permissions';
import { assertMeetingInWorkspace, type MeetingScope } from './meeting-access';

export type MeetingPermission = 'meetings_view' | 'meetings_manage';

/** Signed in + member of the workspace + holds `permission` there. */
export async function requireMeetingsPermission(
  workspaceId: string,
  permission: MeetingPermission
): Promise<AuthContext> {
  const ctx = await requireWorkspace(workspaceId);
  if (ctx.isSystemAdmin || permission === 'meetings_view') return ctx;

  const result = await checkWorkspacePermission(ctx.uid, workspaceId, 'meetings_manage');
  if (!result.granted) {
    throw new ForbiddenError('You need permission to manage meetings in this workspace.');
  }
  return ctx;
}

/** `requireMeetingsPermission` plus proof that the meeting belongs to the workspace. */
export async function requireMeetingAccess(
  workspaceId: string,
  meetingId: string,
  permission: MeetingPermission
): Promise<{ ctx: AuthContext; meeting: MeetingScope }> {
  const ctx = await requireMeetingsPermission(workspaceId, permission);
  const meeting = await assertMeetingInWorkspace(meetingId, workspaceId);
  return { ctx, meeting };
}
