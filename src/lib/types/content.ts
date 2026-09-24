/**
 * {{Org_name}} Experience Platform — Universal Content Domain Types
 *
 * Single source of truth for all content items (Pages, Articles, Lessons,
 * Resources, Videos, Files, Announcements, Embeds) across the Experience Platform.
 *
 * Rules:
 * - Strictly typed: ZERO `any` or `any[]`.
 * - Multi-workspace scoped with organization tenancy.
 * - Comprehensive revision history and lifecycle tracking.
 */

import type { PageBlock } from '@/lib/types';
import type { PortalVisibility } from './portal';

export type ContentItemType =
  | 'page'
  | 'article'
  | 'lesson'
  | 'resource'
  | 'video'
  | 'file'
  | 'announcement'
  | 'embed';

export type ContentStatus =
  | 'draft'
  | 'review'
  | 'scheduled'
  | 'published'
  | 'archived';

export interface ContentAuthor {
  id: string;
  name: string;
  avatarUrl?: string;
  role?: string;
  bio?: string;
}

export interface ContentMedia {
  videoUrl?: string;
  audioUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number; // In bytes
  duration?: number; // In seconds (for video/audio)
  mimeType?: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
}

export interface ContentSeoConfig {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  noIndex?: boolean;
}

export interface ContentStats {
  viewCount: number;
  readCount: number;
  completionCount: number;
  downloadCount: number;
  likeCount: number;
  shareCount: number;
  lastViewedAt?: string;
}

export type ContentTeaserMode = 'summary' | 'first_block' | 'two_blocks' | 'none';

export interface CustomPaywallConfig {
  title?: string;
  description?: string;
  perks?: string[];
  ctaText?: string;
  upgradePlanSlug?: string;
}

export interface ContentItem {
  id: string;
  organizationId: string;
  portalId: string;
  workspaceIds: string[];
  type: ContentItemType;
  title: string;
  slug: string;
  summary?: string;
  /**
   * Plain-text body cache for search indexing, RSS feeds, and card snippets.
   * When blocks are present, this is automatically synthesized via AST extraction.
   * For legacy content, this contains raw Markdown / plain text.
   */
  content?: string;
  /**
   * Structured block tree for drag-and-drop authoring.
   * Reuses the Page Builder block definitions and schemas.
   */
  blocks?: PageBlock[];
  pageDocumentId?: string; // Link to PageBuilder document when custom designed
  media?: ContentMedia;
  category?: string;
  tags?: string[];
  authors?: ContentAuthor[];
  status: ContentStatus;
  publishedAt?: string;
  scheduledAt?: string;
  visibility: PortalVisibility;
  accessRoles?: string[];
  /**
   * Plan IDs required to access this item when restricted by tier.
   */
  requiredPlanIds?: string[];
  /**
   * Teaser boundary configuration for paywall gating.
   */
  teaserMode?: ContentTeaserMode;
  /**
   * Optional custom paywall copy and perks override.
   */
  customPaywall?: CustomPaywallConfig;
  /**
   * Transient runtime flag set when item is gated by EntitlementService.
   */
  isGated?: boolean;
  /**
   * Transient runtime reason code explaining why access is denied.
   */
  accessDeniedReason?: string;
  seo?: ContentSeoConfig;
  stats?: ContentStats;
  order?: number;
  parentId?: string; // For hierarchical documentation / nested syllabus trees
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export interface ContentItemVersion {
  id: string;
  contentItemId: string;
  version: number;
  title: string;
  summary?: string;
  content?: string;
  blocks?: PageBlock[];
  media?: ContentMedia;
  pageDocumentId?: string;
  createdBy: string;
  createdAt: string;
  changeNote?: string;
}

export interface CreateContentItemInput {
  organizationId: string;
  portalId: string;
  workspaceIds: string[];
  type: ContentItemType;
  title: string;
  slug?: string;
  summary?: string;
  content?: string;
  blocks?: PageBlock[];
  pageDocumentId?: string;
  media?: ContentMedia;
  category?: string;
  tags?: string[];
  authors?: ContentAuthor[];
  status?: ContentStatus;
  scheduledAt?: string;
  visibility?: PortalVisibility;
  accessRoles?: string[];
  requiredPlanIds?: string[];
  teaserMode?: ContentTeaserMode;
  customPaywall?: CustomPaywallConfig;
  seo?: ContentSeoConfig;
  order?: number;
  parentId?: string;
}

export interface UpdateContentItemInput {
  title?: string;
  slug?: string;
  summary?: string;
  content?: string;
  blocks?: PageBlock[];
  pageDocumentId?: string;
  media?: ContentMedia;
  category?: string;
  tags?: string[];
  authors?: ContentAuthor[];
  status?: ContentStatus;
  scheduledAt?: string;
  visibility?: PortalVisibility;
  accessRoles?: string[];
  requiredPlanIds?: string[];
  teaserMode?: ContentTeaserMode;
  customPaywall?: CustomPaywallConfig;
  seo?: ContentSeoConfig;
  order?: number;
  parentId?: string;
  workspaceIds?: string[];
  changeNote?: string;
}

export interface ContentFilterOptions {
  type?: ContentItemType;
  status?: ContentStatus;
  category?: string;
  tag?: string;
  workspaceId?: string;
  parentId?: string | null;
  limitCount?: number;
  startAfterId?: string;
}

export interface ContentSearchResult {
  item: ContentItem;
  matchScore: number;
  matchedFields: string[];
  snippet: string;
}

export interface PortalContentTemplate {
  id: string;
  portalId: string;
  organizationId: string;
  name: string;
  description: string;
  category: 'article' | 'lesson' | 'resource' | 'documentation' | 'custom';
  blocks: PageBlock[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CreatePortalContentTemplateInput {
  portalId: string;
  organizationId: string;
  name: string;
  description: string;
  category?: 'article' | 'lesson' | 'resource' | 'documentation' | 'custom';
  blocks: PageBlock[];
}

/**
 * {{Org_name}} Experience Platform — Content Studio Draft Contract
 *
 * Single source of truth for in-progress autosaved drafts across both
 * local storage (0ms emergency flush) and Cloud Draft snapshots (cross-device sync).
 *
 * Rules:
 * - Strictly typed: Zero `any`, zero `any[]`.
 * - Multi-tenant isolated: scoped by `portalId` and `organizationId`.
 */
export interface ContentStudioDraft {
  id: string;
  portalId: string;
  organizationId: string;
  contentItemId: string | null;
  title: string;
  slug: string;
  type: ContentItemType;
  summary?: string;
  category?: string;
  tags?: string[];
  blocks: PageBlock[];
  visibility: PortalVisibility;
  media?: ContentMedia;
  seo?: ContentSeoConfig;
  authorId: string;
  authorName: string;
  authorEmail?: string;
  savedAt: string;
  updatedAt: string;
  version: number;
}
