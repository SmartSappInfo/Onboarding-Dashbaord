/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Media 2.0 Domain Model:
 *    Defines the canonical TypeScript domain entities for Media 2.0:
 *    - `MediaVersion`: Versioning model preserving full asset upload history.
 *    - `MediaCollection`: Flexible grouping model supporting Folders, Campaigns, Topics, and Smart Collections.
 *    - `MediaPackage`: Grouping related assets into a cohesive experience (e.g., Sales Kits).
 *    - `MediaExperience`: Presentation layer decoupling content from branding, themes, and controls.
 *    - `MediaLink`: First-class distribution object (dynamic short links, expiration, tracking policies).
 *    - `MediaProcessingJob`: Ingestion, thumbnail generation, OCR, and STT job tracking.
 *    - `MediaGovernanceConfig`: Backoffice governance rules for storage quotas and retention policies.
 * 2. Strict Typing Standard:
 *    Zero use of `any` or `any[]`. All properties are explicitly typed.
 */

import type { MediaAsset } from '../types';

export type MediaLifecycleState = 'draft' | 'active' | 'archived' | 'deprecated';

export type CollectionType = 'folder' | 'campaign' | 'topic' | 'smart';

export type ExperienceTemplate = 'minimal' | 'showcase' | 'conversion' | 'package';

export type ProcessingJobType = 'thumbnail' | 'transcode' | 'ocr' | 'stt' | 'compression';

export type ProcessingJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface MediaVersion {
  id: string;
  assetId: string;
  versionNumber: number;
  url: string;
  storagePath?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  duration?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  checksum?: string;
  createdById: string;
  changeLog?: string;
  createdAt: string;
}

export interface MediaCollection {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  type: CollectionType;
  iconName?: string;
  colorHex?: string;
  assetIds: string[];
  smartCriteria?: {
    tags?: string[];
    mediaTypes?: MediaAsset['type'][];
    searchQuery?: string;
  };
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaPackageItem {
  assetId: string;
  versionId?: string;
  order: number;
  titleOverride?: string;
  isRequired?: boolean;
}

export interface MediaPackage {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  items: MediaPackageItem[];
  defaultCtaId?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExperienceTheme {
  primaryColorHex: string;
  backgroundColorHex: string;
  textColorHex: string;
  logoUrl?: string;
  fontFamily?: string;
  customCss?: string;
}

export interface PlayerControlsConfig {
  autoplay: boolean;
  showPlaybackSpeed: boolean;
  showQualitySelector: boolean;
  allowDownload: boolean;
  loop: boolean;
  showCaptions: boolean;
}

export interface MediaExperience {
  id: string;
  workspaceId: string;
  assetId: string;
  title: string;
  description?: string;
  template: ExperienceTemplate;
  theme: ExperienceTheme;
  playerControls: PlayerControlsConfig;
  ctaGateId?: string;
  customHeaderTitle?: string;
  customHeaderSubtitle?: string;
  socialSharingTitle?: string;
  socialSharingDescription?: string;
  socialSharingImageUrl?: string;
  isDefault?: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaLink {
  id: string;
  workspaceId: string;
  assetId: string;
  experienceId?: string;
  packageId?: string;
  shortSlug: string;
  contactId?: string;
  dealId?: string;
  campaignId?: string;
  expiresAt?: string;
  passwordHash?: string;
  clickCount: number;
  lastClickedAt?: string;
  createdById: string;
  createdAt: string;
}

export interface EmbedConfig {
  experienceId: string;
  width: string;
  height: string;
  allowFullscreen: boolean;
  responsiveRatio: '16:9' | '4:3' | '1:1' | 'auto';
  themeColor?: string;
}

export interface MediaProcessingJob {
  id: string;
  workspaceId: string;
  assetId: string;
  versionId?: string;
  type: ProcessingJobType;
  status: ProcessingJobStatus;
  progressPercent: number;
  errorMessage?: string;
  outputPayload?: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface MediaGovernanceConfig {
  maxVersionsPerAsset: number;
  allowedFileTypes: string[];
  maxFileSizeBytes: number;
  autoArchivingDays: number;
  requireApprovalForPublishing: boolean;
  defaultCollectionTemplates: string[];
  allowedEmbedDomains: string[];
  defaultExperienceTemplate: ExperienceTemplate;
}

export interface MediaAsset2 extends MediaAsset {
  currentVersionId?: string;
  versionCount?: number;
  collectionIds?: string[];
  packageIds?: string[];
  lifecycleState?: MediaLifecycleState;
  defaultExperienceId?: string;
  technicalMetadata?: {
    codec?: string;
    bitrateKbps?: number;
    dpi?: number;
    pageCount?: number;
  };
  aiMetadata?: {
    summary?: string;
    keywords?: string[];
    topics?: string[];
    transcriptUrl?: string;
  };
}
