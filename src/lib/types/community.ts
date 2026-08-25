/**
 * {{Org_name}} Experience Platform — Community Domain Types
 *
 * Strict TypeScript definitions for Spaces, Posts, Comments, Polls,
 * Reactions, and Moderation Reports. Zero `any` or `any[]` typing.
 */

// ── Status & Enum Types ──────────────────────────────────────────────────────

export type SpaceVisibility = 'public' | 'members_only' | 'plan_gated' | 'private_cohort';

export type PostType =
  | 'discussion'
  | 'question'
  | 'announcement'
  | 'resource'
  | 'showcase'
  | 'poll';

export type ReactionType = 'like' | 'heart' | 'fire' | 'celebrate' | 'insightful';

export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'action_taken';

export type ReportTargetType = 'post' | 'comment' | 'member';

// ── Sub-Entities ─────────────────────────────────────────────────────────────

export interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

export interface PollVote {
  id: string;
  pollId: string;
  postId: string;
  portalId: string;
  userId: string;
  selectedOptionIds: string[];
  votedAt: string;
}

// ── Core Aggregates ──────────────────────────────────────────────────────────

/**
 * Community Space Entity
 * Channel/Category grouping related community discussions.
 */
export interface CommunitySpace {
  id: string;
  organizationId: string;
  portalId: string;
  workspaceIds: string[];

  name: string;
  slug: string;
  description?: string;
  icon?: string; // Lucide icon name or emoji e.g. "MessageSquare" or "🎉"
  bannerUrl?: string;

  visibility: SpaceVisibility;
  allowedPlanIds?: string[]; // Gated membership tier IDs
  allowedRoleIds?: string[]; // Gated role IDs

  order: number;
  postCount: number;
  isDefault?: boolean;

  createdAt: string;
  updatedAt: string;
}

/**
 * Community Post Entity
 * Individual feed entry with Markdown text, media attachments, or interactive polls.
 */
export interface CommunityPost {
  id: string;
  organizationId: string;
  portalId: string;
  spaceId: string;
  workspaceIds: string[];

  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  authorRole: string;

  type: PostType;
  title: string;
  slug: string;
  content: string; // Rich Markdown text
  mediaUrls?: string[];
  tags?: string[];

  pollId?: string;
  pollData?: CommunityPoll;

  isPinned: boolean;
  isLocked: boolean;

  likeCount: number;
  commentCount: number;
  viewCount: number;
  reactionCounts?: Record<ReactionType, number>;

  createdAt: string;
  updatedAt: string;
}

/**
 * Threaded Comment Entity
 */
export interface CommunityComment {
  id: string;
  organizationId: string;
  portalId: string;
  spaceId: string;
  postId: string;
  parentCommentId?: string; // Direct reply parent

  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  authorRole: string;

  content: string;
  likeCount: number;

  createdAt: string;
  updatedAt: string;
}

/**
 * Interactive Poll Entity
 */
export interface CommunityPoll {
  id: string;
  organizationId: string;
  portalId: string;
  postId: string;

  question: string;
  allowMultiple: boolean;
  options: PollOption[];
  totalVotes: number;

  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Reaction Entity
 */
export interface CommunityReaction {
  id: string;
  organizationId: string;
  portalId: string;
  targetType: 'post' | 'comment';
  targetId: string;
  userId: string;
  type: ReactionType;
  createdAt: string;
}

/**
 * Moderation Report Entity
 */
export interface ModerationReport {
  id: string;
  organizationId: string;
  portalId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetAuthorId?: string;
  reporterUserId: string;

  reason: string;
  details?: string;
  status: ReportStatus;

  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

// ── Input DTOs ───────────────────────────────────────────────────────────────

export interface CreateSpaceInput {
  organizationId: string;
  portalId: string;
  workspaceIds?: string[];
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  bannerUrl?: string;
  visibility?: SpaceVisibility;
  allowedPlanIds?: string[];
  order?: number;
  isDefault?: boolean;
}

export interface UpdateSpaceInput {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  bannerUrl?: string;
  visibility?: SpaceVisibility;
  allowedPlanIds?: string[];
  order?: number;
  isDefault?: boolean;
}

export interface CreatePostInput {
  organizationId: string;
  portalId: string;
  spaceId: string;
  workspaceIds?: string[];
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  authorRole?: string;
  type?: PostType;
  title: string;
  slug?: string;
  content: string;
  mediaUrls?: string[];
  tags?: string[];
  pollQuestion?: string;
  pollOptions?: string[];
  pollAllowMultiple?: boolean;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
  type?: PostType;
  mediaUrls?: string[];
  tags?: string[];
  isPinned?: boolean;
  isLocked?: boolean;
}

export interface CreateCommentInput {
  organizationId: string;
  portalId: string;
  spaceId: string;
  postId: string;
  parentCommentId?: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  authorRole?: string;
  content: string;
}

export interface CastPollVoteInput {
  pollId: string;
  postId: string;
  portalId: string;
  userId: string;
  selectedOptionIds: string[];
}

export interface ToggleReactionInput {
  organizationId: string;
  portalId: string;
  targetType: 'post' | 'comment';
  targetId: string;
  userId: string;
  type: ReactionType;
}

export interface ReportContentInput {
  organizationId: string;
  portalId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetAuthorId?: string;
  reporterUserId: string;
  reason: string;
  details?: string;
}
