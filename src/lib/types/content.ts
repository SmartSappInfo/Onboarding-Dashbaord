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

export interface ContentItem {
  id: string;
  organizationId: string;
  portalId: string;
  workspaceIds: string[];
  type: ContentItemType;
  title: string;
  slug: string;
  summary?: string;
  content?: string; // Rich text / Markdown / HTML body
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
  pageDocumentId?: string;
  media?: ContentMedia;
  category?: string;
  tags?: string[];
  authors?: ContentAuthor[];
  status?: ContentStatus;
  scheduledAt?: string;
  visibility?: PortalVisibility;
  accessRoles?: string[];
  seo?: ContentSeoConfig;
  order?: number;
  parentId?: string;
}

export interface UpdateContentItemInput {
  title?: string;
  slug?: string;
  summary?: string;
  content?: string;
  pageDocumentId?: string;
  media?: ContentMedia;
  category?: string;
  tags?: string[];
  authors?: ContentAuthor[];
  status?: ContentStatus;
  scheduledAt?: string;
  visibility?: PortalVisibility;
  accessRoles?: string[];
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
