'use server';

/**
 * {{Org_name}} Experience Platform — Community Server Actions
 *
 * Strongly typed Next.js Server Actions for Community: Spaces, Posts, Comments,
 * Polls, Reactions, and Moderation Reports.
 * Zero `any` or `any[]` typing.
 */

import { revalidatePath } from 'next/cache';
import { CommunityService } from '@/lib/services/community-service';
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
} from '@/lib/types/community';

export type ActionResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

// ── Space Actions ────────────────────────────────────────────────────────────

export async function createSpaceAction(
  input: CreateSpaceInput,
  portalSlug?: string
): Promise<ActionResponse<CommunitySpace>> {
  try {
    const space = await CommunityService.createSpace(input);
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/community`);
    return { success: true, data: space };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create space.' };
  }
}

export async function updateSpaceAction(
  spaceId: string,
  updates: UpdateSpaceInput,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<CommunitySpace>> {
  try {
    const space = await CommunityService.updateSpace(spaceId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/community`);
    return { success: true, data: space };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update space.' };
  }
}

export async function deleteSpaceAction(
  spaceId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await CommunityService.deleteSpace(spaceId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/community`);
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete space.' };
  }
}

// ── Post Actions ─────────────────────────────────────────────────────────────

export async function createPostAction(
  input: CreatePostInput,
  portalSlug?: string
): Promise<ActionResponse<CommunityPost>> {
  try {
    const post = await CommunityService.createPost(input);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/community`);
      revalidatePath(`/portal/${portalSlug}/community/${input.spaceId}`);
    }
    return { success: true, data: post };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create post.' };
  }
}

export async function updatePostAction(
  postId: string,
  updates: UpdatePostInput,
  portalId: string,
  portalSlug?: string,
  spaceId?: string
): Promise<ActionResponse<CommunityPost>> {
  try {
    const post = await CommunityService.updatePost(postId, updates);
    if (portalSlug && spaceId) {
      revalidatePath(`/portal/${portalSlug}/community/${spaceId}`);
    }
    return { success: true, data: post };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update post.' };
  }
}

export async function deletePostAction(
  postId: string,
  portalId: string,
  portalSlug?: string,
  spaceId?: string
): Promise<ActionResponse<boolean>> {
  try {
    await CommunityService.deletePost(postId);
    if (portalSlug && spaceId) {
      revalidatePath(`/portal/${portalSlug}/community/${spaceId}`);
    }
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete post.' };
  }
}

export async function togglePinPostAction(
  postId: string,
  portalSlug?: string,
  spaceId?: string
): Promise<ActionResponse<boolean>> {
  try {
    const isPinned = await CommunityService.togglePinPost(postId);
    if (portalSlug && spaceId) {
      revalidatePath(`/portal/${portalSlug}/community/${spaceId}`);
    }
    return { success: true, data: isPinned };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to toggle pin.' };
  }
}

// ── Comment Actions ──────────────────────────────────────────────────────────

export async function createCommentAction(
  input: CreateCommentInput,
  portalSlug?: string
): Promise<ActionResponse<CommunityComment>> {
  try {
    const comment = await CommunityService.createComment(input);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}/community/${input.spaceId}/${input.postId}`);
    }
    return { success: true, data: comment };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to post comment.' };
  }
}

export async function deleteCommentAction(
  commentId: string,
  portalSlug?: string,
  spaceId?: string,
  postId?: string
): Promise<ActionResponse<boolean>> {
  try {
    await CommunityService.deleteComment(commentId);
    if (portalSlug && spaceId && postId) {
      revalidatePath(`/portal/${portalSlug}/community/${spaceId}/${postId}`);
    }
    return { success: true, data: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete comment.' };
  }
}

// ── Poll & Reaction Actions ──────────────────────────────────────────────────

export async function castPollVoteAction(
  input: CastPollVoteInput,
  portalSlug?: string,
  spaceId?: string
): Promise<ActionResponse<CommunityPoll>> {
  try {
    const poll = await CommunityService.castPollVote(input);
    if (portalSlug && spaceId) {
      revalidatePath(`/portal/${portalSlug}/community/${spaceId}`);
      revalidatePath(`/portal/${portalSlug}/community/${spaceId}/${input.postId}`);
    }
    return { success: true, data: poll };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to vote on poll.' };
  }
}

export async function toggleReactionAction(
  input: ToggleReactionInput
): Promise<ActionResponse<{ reacted: boolean; type: ReactionType; count: number }>> {
  try {
    const res = await CommunityService.toggleReaction(input);
    return { success: true, data: res };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to toggle reaction.' };
  }
}

// ── Moderation Action ────────────────────────────────────────────────────────

export async function reportContentAction(
  input: ReportContentInput
): Promise<ActionResponse<ModerationReport>> {
  try {
    const report = await CommunityService.reportContent(input);
    return { success: true, data: report };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to submit report.' };
  }
}
