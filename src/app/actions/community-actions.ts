'use server';

/**
 * {{Org_name}} Experience Platform — Community Server Actions
 *
 * Strongly typed Next.js Server Actions for Community: Spaces, Posts, Comments,
 * Polls, Reactions, and Moderation Reports.
 * Zero `any` or `any[]` typing.
 *
 * SECURITY (auth hotfix, agents_mcp Phase 1 §1.1a / audit F2): public endpoints.
 * - Space management, moderation, pinning, seeding: staff via `requirePortalAdmin`.
 * - Posting, commenting, voting, reacting, reporting: Firebase ID token → `requirePortalMember`.
 *   The author / voter / reporter is ALWAYS the verified uid; caller-supplied ids are overwritten.
 * - Editing or deleting a post or comment: its author, or portal staff.
 * - `getMemberPublicProfileAction` stays public (a public projection by design).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { CommunityService } from '@/lib/services/community-service';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import {
  assertRecordInPortal,
  ForbiddenError,
  portalAuthErrorMessage,
  requirePortalAdmin,
  requirePortalMember,
  type PortalMemberContext,
} from '@/lib/auth/require-portal-access';
import type {
  CommunitySpace,
  CommunityPost,
  CommunityComment,
  CommunityPoll,
  ModerationReport,
  ReactionType,
  CreateSpaceInput,
  UpdateSpaceInput,
  CreatePostInput,
  UpdatePostInput,
  CreateCommentInput,
  CastPollVoteInput,
  ToggleReactionInput,
  ReportContentInput,
  ResolveModerationInput,
  CommunityLeaderboardEntry,
  MemberPublicProfile,
} from '@/lib/types/community';

export type ActionResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

function failure(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: portalAuthErrorMessage(err) ?? toClientErrorMessage('actions.community-actions', err, undefined, fallback) };
}

const AuthoredDocSchema = z.object({ portalId: z.string(), authorId: z.string().optional() });

/** Loads a post/comment's owning portal and author so ownership can be checked server-side. */
async function authoredRecord(collection: 'community_posts' | 'community_comments', id: string): Promise<{ portalId: string; authorId: string | null }> {
  const snap = await adminDb.collection(collection).doc(id).get();
  const parsed = AuthoredDocSchema.safeParse(snap.data());
  if (!snap.exists || !parsed.success) throw new ForbiddenError('Record not found.');
  return { portalId: parsed.data.portalId, authorId: parsed.data.authorId ?? null };
}

/** The verified caller must be the record's author or portal staff. */
async function requireAuthorOrStaff(
  idToken: string,
  collection: 'community_posts' | 'community_comments',
  id: string
): Promise<{ portalId: string; isPortalStaff: boolean }> {
  const record = await authoredRecord(collection, id);
  const member = await requirePortalMember(idToken, record.portalId);
  if (!member.isPortalStaff && member.uid !== record.authorId) {
    throw new ForbiddenError('Only the author or portal staff can change this.');
  }
  return { portalId: record.portalId, isPortalStaff: member.isPortalStaff };
}

// ── Participation integrity (Round 4 item 3) ─────────────────────────────────

const SpaceDocSchema = z.object({
  portalId: z.string(),
  visibility: z.enum(['public', 'members_only', 'plan_gated', 'private_cohort']),
  allowedPlanIds: z.array(z.string()).optional(),
  allowedRoleIds: z.array(z.string()).optional(),
});
const SpacedRecordSchema = z.object({ portalId: z.string(), spaceId: z.string() });

/** The stored space of a post/comment in this portal (never the caller's claim). */
async function spaceOfRecord(collection: 'community_posts' | 'community_comments', id: string, portalId: string): Promise<string> {
  const snap = await adminDb.collection(collection).doc(id).get();
  const parsed = SpacedRecordSchema.safeParse(snap.data());
  if (!snap.exists || !parsed.success || parsed.data.portalId !== portalId) throw new ForbiddenError('Record not found in this portal.');
  return parsed.data.spaceId;
}

/** Refuses unless the space is in this portal and the member may participate in it. */
async function requireSpaceParticipation(member: PortalMemberContext, portalId: string, spaceId: string): Promise<void> {
  const snap = await adminDb.collection('community_spaces').doc(spaceId).get();
  const space = SpaceDocSchema.safeParse(snap.data());
  if (!snap.exists || !space.success || space.data.portalId !== portalId) throw new ForbiddenError('Record not found in this portal.');
  const allowed = await CommunityService.canParticipateInSpace(
    { id: spaceId, ...space.data },
    {
      uid: member.uid,
      planId: member.membership?.planId,
      role: member.membership?.role,
      isPortalStaff: member.isPortalStaff,
    }
  );
  if (!allowed) throw new ForbiddenError('You do not have access to post in this space.');
}

/** Author display fields are server-derived: portal profile for members, "admin" for portal staff. */
function authorOf(member: PortalMemberContext): { authorName: string; authorAvatarUrl?: string; authorRole: string } {
  if (member.membership) {
    return {
      authorName: member.membership.displayName || member.email?.split('@')[0] || 'Member',
      authorAvatarUrl: member.membership.avatarUrl,
      authorRole: member.membership.role,
    };
  }
  return { authorName: member.email?.split('@')[0] || 'Staff', authorRole: 'admin' };
}

type ServerDerivedAuthorFields = 'authorId' | 'organizationId' | 'authorName' | 'authorAvatarUrl' | 'authorRole';

/**
 * Fields a post's author may change. `isPinned` / `isLocked` are moderation decisions (staff only).
 * Built field-by-field because `CommunityService.updatePost` spreads what it is given into the stored
 * document: any other runtime key (authorId, portalId, counters, …) must never reach it.
 */
function editablePostFields(updates: UpdatePostInput, isPortalStaff: boolean): UpdatePostInput {
  return {
    ...(updates.title !== undefined && { title: updates.title }),
    ...(updates.content !== undefined && { content: updates.content }),
    ...(updates.type !== undefined && { type: updates.type }),
    ...(updates.mediaUrls !== undefined && { mediaUrls: updates.mediaUrls }),
    ...(updates.tags !== undefined && { tags: updates.tags }),
    ...(updates.lessonId !== undefined && { lessonId: updates.lessonId }),
    ...(updates.courseId !== undefined && { courseId: updates.courseId }),
    ...(updates.blocks !== undefined && { blocks: updates.blocks }),
    ...(isPortalStaff && updates.isPinned !== undefined && { isPinned: updates.isPinned }),
    ...(isPortalStaff && updates.isLocked !== undefined && { isLocked: updates.isLocked }),
  };
}

// ── Space Actions (staff) ────────────────────────────────────────────────────

export async function createSpaceAction(
  input: CreateSpaceInput,
  portalSlug?: string
): Promise<ActionResponse<CommunitySpace>> {
  try {
    const { portal } = await requirePortalAdmin(input.portalId);
    const space = await CommunityService.createSpace({ ...input, organizationId: portal.organizationId });
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/community`);
    return { success: true, data: space };
  } catch (err: unknown) {
    return failure(err, 'Failed to create space.');
  }
}

export async function updateSpaceAction(
  spaceId: string,
  updates: UpdateSpaceInput,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<CommunitySpace>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('community_spaces', spaceId, portalId);
    const space = await CommunityService.updateSpace(spaceId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/community`);
    return { success: true, data: space };
  } catch (err: unknown) {
    return failure(err, 'Failed to update space.');
  }
}

export async function deleteSpaceAction(
  spaceId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('community_spaces', spaceId, portalId);
    await CommunityService.deleteSpace(spaceId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/community`);
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to delete space.');
  }
}

export async function listSpacesByPortalAction(
  portalId: string
): Promise<ActionResponse<CommunitySpace[]>> {
  try {
    await requirePortalAdmin(portalId);
    const spaces = await CommunityService.listPortalSpaces(portalId);
    return { success: true, data: spaces };
  } catch (err: unknown) {
    return failure(err, 'Failed to list spaces.');
  }
}

// ── Post Actions ─────────────────────────────────────────────────────────────

export async function createPostAction(
  idToken: string,
  input: Omit<CreatePostInput, ServerDerivedAuthorFields>,
  portalSlug?: string
): Promise<ActionResponse<CommunityPost>> {
  try {
    const member = await requirePortalMember(idToken, input.portalId);
    await requireSpaceParticipation(member, input.portalId, input.spaceId);
    const { portal } = await portalOf(input.portalId);
    const post = await CommunityService.createPost({
      ...input,
      ...authorOf(member),
      authorId: member.uid,
      organizationId: portal.organizationId,
    });
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/community`);
      revalidatePath(`/portal/${portalSlug}/community/${input.spaceId}`);
    }
    return { success: true, data: post };
  } catch (err: unknown) {
    return failure(err, 'Failed to create post.');
  }
}

export async function updatePostAction(
  idToken: string,
  postId: string,
  updates: UpdatePostInput,
  portalSlug?: string,
  spaceId?: string
): Promise<ActionResponse<CommunityPost>> {
  try {
    const { isPortalStaff } = await requireAuthorOrStaff(idToken, 'community_posts', postId);
    const post = await CommunityService.updatePost(postId, editablePostFields(updates, isPortalStaff));
    if (portalSlug && spaceId) {
      revalidatePath(`/portal/${portalSlug}/community/${spaceId}`);
    }
    return { success: true, data: post };
  } catch (err: unknown) {
    return failure(err, 'Failed to update post.');
  }
}

export async function deletePostAction(
  idToken: string,
  postId: string,
  portalSlug?: string,
  spaceId?: string
): Promise<ActionResponse<boolean>> {
  try {
    await requireAuthorOrStaff(idToken, 'community_posts', postId);
    await CommunityService.deletePost(postId);
    if (portalSlug && spaceId) {
      revalidatePath(`/portal/${portalSlug}/community/${spaceId}`);
    }
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to delete post.');
  }
}

/** Pinning is a moderation decision: portal staff only. */
export async function togglePinPostAction(
  postId: string,
  portalSlug?: string,
  spaceId?: string
): Promise<ActionResponse<boolean>> {
  try {
    const { portalId } = await authoredRecord('community_posts', postId);
    await requirePortalAdmin(portalId);
    const isPinned = await CommunityService.togglePinPost(postId);
    if (portalSlug && spaceId) {
      revalidatePath(`/portal/${portalSlug}/community/${spaceId}`);
    }
    return { success: true, data: isPinned };
  } catch (err: unknown) {
    return failure(err, 'Failed to toggle pin.');
  }
}

// ── Comment Actions ──────────────────────────────────────────────────────────

export async function createCommentAction(
  idToken: string,
  input: Omit<CreateCommentInput, ServerDerivedAuthorFields>,
  portalSlug?: string
): Promise<ActionResponse<CommunityComment>> {
  try {
    const member = await requirePortalMember(idToken, input.portalId);
    // The comment lives in the POST's stored space; a mismatched claim is refused.
    const spaceId = await spaceOfRecord('community_posts', input.postId, input.portalId);
    if (spaceId !== input.spaceId) throw new ForbiddenError('Record not found in this portal.');
    await requireSpaceParticipation(member, input.portalId, spaceId);
    const { portal } = await portalOf(input.portalId);
    const comment = await CommunityService.createComment({
      ...input,
      ...authorOf(member),
      authorId: member.uid,
      organizationId: portal.organizationId,
    });
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/community/${input.spaceId}/${input.postId}`);
    }
    return { success: true, data: comment };
  } catch (err: unknown) {
    return failure(err, 'Failed to post comment.');
  }
}

export async function deleteCommentAction(
  idToken: string,
  commentId: string,
  portalSlug?: string,
  spaceId?: string,
  postId?: string
): Promise<ActionResponse<boolean>> {
  try {
    await requireAuthorOrStaff(idToken, 'community_comments', commentId);
    await CommunityService.deleteComment(commentId);
    if (portalSlug && spaceId && postId) {
      revalidatePath(`/portal/${portalSlug}/community/${spaceId}/${postId}`);
    }
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to delete comment.');
  }
}

// ── Poll & Reaction Actions ──────────────────────────────────────────────────

export async function castPollVoteAction(
  idToken: string,
  input: Omit<CastPollVoteInput, 'userId'>,
  portalSlug?: string,
  spaceId?: string
): Promise<ActionResponse<CommunityPoll>> {
  try {
    const member = await requirePortalMember(idToken, input.portalId);
    await requireSpaceParticipation(member, input.portalId, await spaceOfRecord('community_posts', input.postId, input.portalId));
    const poll = await CommunityService.castPollVote({ ...input, userId: member.uid });
    if (portalSlug && spaceId) {
      revalidatePath(`/portal/${portalSlug}/community/${spaceId}`);
      revalidatePath(`/portal/${portalSlug}/community/${spaceId}/${input.postId}`);
    }
    return { success: true, data: poll };
  } catch (err: unknown) {
    return failure(err, 'Failed to vote on poll.');
  }
}

export async function toggleReactionAction(
  idToken: string,
  input: Omit<ToggleReactionInput, 'userId' | 'organizationId'>
): Promise<ActionResponse<{ reacted: boolean; type: ReactionType; count: number }>> {
  try {
    const member = await requirePortalMember(idToken, input.portalId);
    const target = input.targetType === 'post' ? 'community_posts' : 'community_comments';
    await requireSpaceParticipation(member, input.portalId, await spaceOfRecord(target, input.targetId, input.portalId));
    const { portal } = await portalOf(input.portalId);
    const res = await CommunityService.toggleReaction({ ...input, userId: member.uid, organizationId: portal.organizationId });
    return { success: true, data: res };
  } catch (err: unknown) {
    return failure(err, 'Failed to toggle reaction.');
  }
}

// ── Moderation Actions ───────────────────────────────────────────────────────

export async function reportContentAction(
  idToken: string,
  input: Omit<ReportContentInput, 'reporterUserId' | 'organizationId'>
): Promise<ActionResponse<ModerationReport>> {
  try {
    const { uid } = await requirePortalMember(idToken, input.portalId);
    const { portal } = await portalOf(input.portalId);
    const report = await CommunityService.reportContent({ ...input, reporterUserId: uid, organizationId: portal.organizationId });
    return { success: true, data: report };
  } catch (err: unknown) {
    return failure(err, 'Failed to submit report.');
  }
}

export async function listModerationReportsAction(
  portalId: string
): Promise<ActionResponse<ModerationReport[]>> {
  try {
    await requirePortalAdmin(portalId);
    const reports = await CommunityService.listModerationReports(portalId);
    return { success: true, data: reports };
  } catch (err: unknown) {
    return failure(err, 'Failed to list moderation reports.');
  }
}

export async function resolveModerationReportAction(
  input: Omit<ResolveModerationInput, 'reviewedBy'>
): Promise<ActionResponse<{ success: boolean; action: string }>> {
  try {
    const { auth } = await requirePortalAdmin(input.portalId);
    await assertRecordInPortal('moderation_reports', input.reportId, input.portalId);
    const res = await CommunityService.resolveModerationReport({ ...input, reviewedBy: auth.uid });
    revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: res };
  } catch (err: unknown) {
    return failure(err, 'Failed to resolve report.');
  }
}

export async function listLessonPostsAction(
  idToken: string,
  portalId: string,
  lessonId: string
): Promise<ActionResponse<CommunityPost[]>> {
  try {
    await requirePortalMember(idToken, portalId);
    const posts = await CommunityService.listLessonPosts(portalId, lessonId);
    return { success: true, data: posts };
  } catch (err: unknown) {
    return failure(err, 'Failed to list lesson discussions.');
  }
}

export async function getCommunityLeaderboardAction(
  idToken: string,
  portalId: string,
  limitCount = 10
): Promise<ActionResponse<CommunityLeaderboardEntry[]>> {
  try {
    await requirePortalMember(idToken, portalId);
    const leaderboard = await CommunityService.getCommunityLeaderboard(portalId, Math.min(Math.max(limitCount, 1), 50));
    return { success: true, data: leaderboard };
  } catch (err: unknown) {
    return failure(err, 'Failed to load leaderboard.');
  }
}

export async function seedCommunitySpacesAction(
  portalId: string,
  _organizationId: string,
  portalSlug?: string
): Promise<ActionResponse<CommunitySpace[]>> {
  try {
    // The organization comes from the portal, never from the caller.
    const { portal } = await requirePortalAdmin(portalId);
    const spaces = await CommunityService.seedCommunitySpaces(portalId, portal.organizationId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/community`);
    return { success: true, data: spaces };
  } catch (err: unknown) {
    return failure(err, 'Failed to seed starter channels.');
  }
}

export async function getMemberPublicProfileAction(
  portalId: string,
  userId: string
): Promise<ActionResponse<MemberPublicProfile | null>> {
  try {
    const profile = await CommunityService.getMemberPublicProfile(portalId, userId);
    return { success: true, data: profile };
  } catch (err: unknown) {
    return failure(err, 'Failed to load member profile.');
  }
}

async function portalOf(portalId: string) {
  const { PortalService } = await import('@/lib/services/portal-service');
  const portal = await PortalService.getPortalById(portalId);
  if (!portal) throw new ForbiddenError('Portal not found.');
  return { portal };
}
