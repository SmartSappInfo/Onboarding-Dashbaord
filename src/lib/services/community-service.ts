/**
 * {{Org_name}} Experience Platform — Community Domain Service
 *
 * Server-side domain operations for Spaces, Posts, Comments, Polls,
 * Reactions, and Moderation Reports. Zero `any` or `any[]` typing.
 */

import { adminDb } from '@/lib/firebase-admin';
import { PortalMembershipService } from '@/lib/services/portal-membership-service';
import type {
  CommunitySpace,
  CommunityPost,
  CommunityComment,
  CommunityPoll,
  PollVote,
  CommunityReaction,
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

export class CommunityService {
  /**
   * Helper to clean slugs
   */
  public static sanitizeSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ── Space Operations ───────────────────────────────────────────────────────

  public static async createSpace(input: CreateSpaceInput): Promise<CommunitySpace> {
    const slug = input.slug?.trim() ? CommunityService.sanitizeSlug(input.slug) : CommunityService.sanitizeSlug(input.name);
    const now = new Date().toISOString();
    const docRef = adminDb.collection('community_spaces').doc();

    const space: CommunitySpace = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      workspaceIds: input.workspaceIds || ['onboarding'],
      name: input.name.trim(),
      slug,
      description: input.description?.trim(),
      icon: input.icon || 'MessageSquare',
      bannerUrl: input.bannerUrl,
      visibility: input.visibility || 'members_only',
      allowedPlanIds: input.allowedPlanIds || [],
      order: input.order ?? 1,
      postCount: 0,
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(space);
    return space;
  }

  public static async updateSpace(spaceId: string, updates: UpdateSpaceInput): Promise<CommunitySpace> {
    const docRef = adminDb.collection('community_spaces').doc(spaceId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Space ${spaceId} not found.`);

    const current = snap.data() as CommunitySpace;
    const now = new Date().toISOString();

    const updated: CommunitySpace = {
      ...current,
      ...updates,
      name: updates.name !== undefined ? updates.name.trim() : current.name,
      slug: updates.slug ? CommunityService.sanitizeSlug(updates.slug) : current.slug,
      updatedAt: now,
    };

    await docRef.set(updated, { merge: true });
    return updated;
  }

  public static async deleteSpace(spaceId: string): Promise<void> {
    const batch = adminDb.batch();
    batch.delete(adminDb.collection('community_spaces').doc(spaceId));

    // Delete child posts
    const postsSnap = await adminDb.collection('community_posts').where('spaceId', '==', spaceId).get();
    postsSnap.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();
  }

  public static async getSpaceById(spaceId: string): Promise<CommunitySpace | null> {
    const snap = await adminDb.collection('community_spaces').doc(spaceId).get();
    if (!snap.exists) return null;
    return snap.data() as CommunitySpace;
  }

  public static async getSpaceBySlug(portalId: string, slug: string): Promise<CommunitySpace | null> {
    const snap = await adminDb
      .collection('community_spaces')
      .where('portalId', '==', portalId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as CommunitySpace;
  }

  public static async listPortalSpaces(portalId: string): Promise<CommunitySpace[]> {
    const snap = await adminDb
      .collection('community_spaces')
      .where('portalId', '==', portalId)
      .orderBy('order', 'asc')
      .get();

    return snap.docs.map(d => d.data() as CommunitySpace);
  }

  // ── Post Operations ────────────────────────────────────────────────────────

  public static async createPost(input: CreatePostInput): Promise<CommunityPost> {
    const slug = input.slug?.trim() ? CommunityService.sanitizeSlug(input.slug) : CommunityService.sanitizeSlug(input.title);
    const now = new Date().toISOString();
    const docRef = adminDb.collection('community_posts').doc();

    let pollId: string | undefined = undefined;

    // Create attached poll if specified
    if (input.type === 'poll' && input.pollQuestion?.trim() && input.pollOptions?.length) {
      const pollRef = adminDb.collection('community_polls').doc();
      pollId = pollRef.id;

      const pollDoc: CommunityPoll = {
        id: pollRef.id,
        organizationId: input.organizationId,
        portalId: input.portalId,
        postId: docRef.id,
        question: input.pollQuestion.trim(),
        allowMultiple: input.pollAllowMultiple ?? false,
        options: input.pollOptions.map((optText, idx) => ({
          id: `opt_${idx + 1}`,
          text: optText.trim(),
          voteCount: 0,
        })),
        totalVotes: 0,
        createdAt: now,
        updatedAt: now,
      };

      await pollRef.set(pollDoc);
    }

    const post: CommunityPost = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      spaceId: input.spaceId,
      workspaceIds: input.workspaceIds || ['onboarding'],
      authorId: input.authorId,
      authorName: input.authorName || 'Community Member',
      authorAvatarUrl: input.authorAvatarUrl,
      authorRole: input.authorRole || 'member',
      type: input.type || 'discussion',
      title: input.title.trim(),
      slug,
      content: input.content || '',
      mediaUrls: input.mediaUrls || [],
      tags: input.tags || [],
      pollId,
      isPinned: false,
      isLocked: false,
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      reactionCounts: { like: 0, heart: 0, fire: 0, celebrate: 0, insightful: 0 },
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(post);

    // Increment space postCount
    const spaceSnap = await adminDb.collection('community_spaces').doc(input.spaceId).get();
    if (spaceSnap.exists) {
      const currentCount = (spaceSnap.data()?.postCount || 0) + 1;
      await spaceSnap.ref.set({ postCount: currentCount, updatedAt: now }, { merge: true });
    }

    // Award Gamification Points (+5 pts for community post)
    const membershipSnap = await adminDb
      .collection('portal_memberships')
      .where('portalId', '==', input.portalId)
      .where('userId', '==', input.authorId)
      .limit(1)
      .get();

    if (!membershipSnap.empty) {
      await PortalMembershipService.awardPoints(
        membershipSnap.docs[0].id,
        5,
        `Created Community Post: ${post.title}`
      );
    }

    return post;
  }

  public static async updatePost(postId: string, updates: UpdatePostInput): Promise<CommunityPost> {
    const docRef = adminDb.collection('community_posts').doc(postId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Post ${postId} not found.`);

    const current = snap.data() as CommunityPost;
    const now = new Date().toISOString();

    const updated: CommunityPost = {
      ...current,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : current.title,
      updatedAt: now,
    };

    await docRef.set(updated, { merge: true });
    return updated;
  }

  public static async deletePost(postId: string): Promise<void> {
    const docRef = adminDb.collection('community_posts').doc(postId);
    const snap = await docRef.get();
    if (!snap.exists) return;

    const postData = snap.data() as CommunityPost;
    const batch = adminDb.batch();

    // 1. Delete post
    batch.delete(docRef);

    // 2. Delete attached comments
    const commentsSnap = await adminDb.collection('community_comments').where('postId', '==', postId).get();
    commentsSnap.docs.forEach(d => batch.delete(d.ref));

    // 3. Delete attached poll
    if (postData.pollId) {
      batch.delete(adminDb.collection('community_polls').doc(postData.pollId));
    }

    await batch.commit();

    // Decrement space postCount
    const spaceSnap = await adminDb.collection('community_spaces').doc(postData.spaceId).get();
    if (spaceSnap.exists) {
      const currentCount = Math.max(0, (spaceSnap.data()?.postCount || 1) - 1);
      await spaceSnap.ref.set({ postCount: currentCount, updatedAt: new Date().toISOString() }, { merge: true });
    }
  }

  public static async togglePinPost(postId: string): Promise<boolean> {
    const docRef = adminDb.collection('community_posts').doc(postId);
    const snap = await docRef.get();
    if (!snap.exists) return false;

    const currentPin = Boolean(snap.data()?.isPinned);
    await docRef.set({ isPinned: !currentPin, updatedAt: new Date().toISOString() }, { merge: true });
    return !currentPin;
  }

  public static async getPostBySlug(spaceId: string, slug: string): Promise<CommunityPost | null> {
    const snap = await adminDb
      .collection('community_posts')
      .where('spaceId', '==', spaceId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snap.empty) return null;
    const post = snap.docs[0].data() as CommunityPost;

    // If post has poll, fetch poll data
    if (post.pollId) {
      const pollSnap = await adminDb.collection('community_polls').doc(post.pollId).get();
      if (pollSnap.exists) {
        post.pollData = pollSnap.data() as CommunityPoll;
      }
    }

    return post;
  }

  public static async listSpacePosts(
    portalId: string,
    spaceId?: string,
    limitCount = 20
  ): Promise<CommunityPost[]> {
    let q = adminDb.collection('community_posts').where('portalId', '==', portalId);

    if (spaceId) {
      q = q.where('spaceId', '==', spaceId);
    }

    const snap = await q.orderBy('isPinned', 'desc').orderBy('createdAt', 'desc').limit(limitCount).get();
    const posts = snap.docs.map(d => d.data() as CommunityPost);

    // Populate poll data for polls
    for (const post of posts) {
      if (post.pollId) {
        const pollSnap = await adminDb.collection('community_polls').doc(post.pollId).get();
        if (pollSnap.exists) {
          post.pollData = pollSnap.data() as CommunityPoll;
        }
      }
    }

    return posts;
  }

  // ── Comment Operations ─────────────────────────────────────────────────────

  public static async createComment(input: CreateCommentInput): Promise<CommunityComment> {
    const now = new Date().toISOString();
    const docRef = adminDb.collection('community_comments').doc();

    const comment: CommunityComment = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      spaceId: input.spaceId,
      postId: input.postId,
      parentCommentId: input.parentCommentId,
      authorId: input.authorId,
      authorName: input.authorName || 'Community Member',
      authorAvatarUrl: input.authorAvatarUrl,
      authorRole: input.authorRole || 'member',
      content: input.content.trim(),
      likeCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(comment);

    // Increment post commentCount
    const postSnap = await adminDb.collection('community_posts').doc(input.postId).get();
    if (postSnap.exists) {
      const currentComments = (postSnap.data()?.commentCount || 0) + 1;
      await postSnap.ref.set({ commentCount: currentComments, updatedAt: now }, { merge: true });
    }

    // Award Gamification Points (+2 pts for comment)
    const membershipSnap = await adminDb
      .collection('portal_memberships')
      .where('portalId', '==', input.portalId)
      .where('userId', '==', input.authorId)
      .limit(1)
      .get();

    if (!membershipSnap.empty) {
      await PortalMembershipService.awardPoints(
        membershipSnap.docs[0].id,
        2,
        'Participated in Community Discussion'
      );
    }

    return comment;
  }

  public static async deleteComment(commentId: string): Promise<void> {
    const docRef = adminDb.collection('community_comments').doc(commentId);
    const snap = await docRef.get();
    if (!snap.exists) return;

    const data = snap.data() as CommunityComment;
    await docRef.delete();

    // Decrement post commentCount
    const postSnap = await adminDb.collection('community_posts').doc(data.postId).get();
    if (postSnap.exists) {
      const currentComments = Math.max(0, (postSnap.data()?.commentCount || 1) - 1);
      await postSnap.ref.set({ commentCount: currentComments, updatedAt: new Date().toISOString() }, { merge: true });
    }
  }

  public static async listPostComments(postId: string): Promise<CommunityComment[]> {
    const snap = await adminDb
      .collection('community_comments')
      .where('postId', '==', postId)
      .orderBy('createdAt', 'asc')
      .get();

    return snap.docs.map(d => d.data() as CommunityComment);
  }

  // ── Poll Operations ────────────────────────────────────────────────────────

  public static async castPollVote(input: CastPollVoteInput): Promise<CommunityPoll> {
    const voteId = `vote_${input.pollId}_${input.userId}`;
    const voteRef = adminDb.collection('poll_votes').doc(voteId);
    const pollRef = adminDb.collection('community_polls').doc(input.pollId);

    const now = new Date().toISOString();

    return await adminDb.runTransaction(async t => {
      const voteSnap = await t.get(voteRef);
      if (voteSnap.exists) {
        throw new Error('You have already voted on this poll.');
      }

      const pollSnap = await t.get(pollRef);
      if (!pollSnap.exists) {
        throw new Error(`Poll ${input.pollId} not found.`);
      }

      const pollData = pollSnap.data() as CommunityPoll;
      const updatedOptions = pollData.options.map(opt => {
        if (input.selectedOptionIds.includes(opt.id)) {
          return { ...opt, voteCount: opt.voteCount + 1 };
        }
        return opt;
      });

      const updatedPoll: CommunityPoll = {
        ...pollData,
        options: updatedOptions,
        totalVotes: pollData.totalVotes + 1,
        updatedAt: now,
      };

      const voteDoc: PollVote = {
        id: voteId,
        pollId: input.pollId,
        postId: input.postId,
        portalId: input.portalId,
        userId: input.userId,
        selectedOptionIds: input.selectedOptionIds,
        votedAt: now,
      };

      t.set(voteRef, voteDoc);
      t.set(pollRef, updatedPoll);

      return updatedPoll;
    });
  }

  // ── Reaction Operations ────────────────────────────────────────────────────

  public static async toggleReaction(
    input: ToggleReactionInput
  ): Promise<{ reacted: boolean; type: ReactionType; count: number }> {
    const reactionId = `react_${input.targetId}_${input.userId}`;
    const reactRef = adminDb.collection('community_reactions').doc(reactionId);
    const postRef =
      input.targetType === 'post'
        ? adminDb.collection('community_posts').doc(input.targetId)
        : null;

    const snap = await reactRef.get();

    if (snap.exists) {
      // Remove reaction
      const currentReaction = snap.data() as CommunityReaction;
      await reactRef.delete();

      if (postRef) {
        const postSnap = await postRef.get();
        if (postSnap.exists) {
          const postData = postSnap.data() as CommunityPost;
          const currentLikeCount = Math.max(0, (postData.likeCount || 1) - 1);
          const currentReactionCounts = { ...(postData.reactionCounts || { like: 0, heart: 0, fire: 0, celebrate: 0, insightful: 0 }) };
          currentReactionCounts[currentReaction.type] = Math.max(0, (currentReactionCounts[currentReaction.type] || 1) - 1);

          await postRef.set(
            { likeCount: currentLikeCount, reactionCounts: currentReactionCounts },
            { merge: true }
          );
          return { reacted: false, type: input.type, count: currentLikeCount };
        }
      }
      return { reacted: false, type: input.type, count: 0 };
    } else {
      // Add reaction
      const now = new Date().toISOString();
      const reaction: CommunityReaction = {
        id: reactionId,
        organizationId: input.organizationId,
        portalId: input.portalId,
        targetType: input.targetType,
        targetId: input.targetId,
        userId: input.userId,
        type: input.type,
        createdAt: now,
      };

      await reactRef.set(reaction);

      if (postRef) {
        const postSnap = await postRef.get();
        if (postSnap.exists) {
          const postData = postSnap.data() as CommunityPost;
          const currentLikeCount = (postData.likeCount || 0) + 1;
          const currentReactionCounts = { ...(postData.reactionCounts || { like: 0, heart: 0, fire: 0, celebrate: 0, insightful: 0 }) };
          currentReactionCounts[input.type] = (currentReactionCounts[input.type] || 0) + 1;

          await postRef.set(
            { likeCount: currentLikeCount, reactionCounts: currentReactionCounts },
            { merge: true }
          );
          return { reacted: true, type: input.type, count: currentLikeCount };
        }
      }
      return { reacted: true, type: input.type, count: 1 };
    }
  }

  // ── Moderation Operations ──────────────────────────────────────────────────

  public static async reportContent(input: ReportContentInput): Promise<ModerationReport> {
    const docRef = adminDb.collection('moderation_reports').doc();
    const now = new Date().toISOString();

    const report: ModerationReport = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      targetType: input.targetType,
      targetId: input.targetId,
      targetAuthorId: input.targetAuthorId,
      reporterUserId: input.reporterUserId,
      reason: input.reason,
      details: input.details,
      status: 'pending',
      createdAt: now,
    };

    await docRef.set(report);
    return report;
  }

  public static async listModerationReports(portalId: string): Promise<ModerationReport[]> {
    const snap = await adminDb
      .collection('moderation_reports')
      .where('portalId', '==', portalId)
      .orderBy('createdAt', 'desc')
      .get();

    return snap.docs.map(d => d.data() as ModerationReport);
  }
}
