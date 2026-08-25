/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Experience Platform Domain Models:
 *    Defines strict TypeScript data models for Documents, Versions, Sources, Pages,
 *    Assets, Layers, Viewer Experiences, Access Policies, Distributions, Sessions,
 *    Visitors, Events, and Processing Jobs (PRD Sections 7–24).
 * 2. Strict Typing Enforcement:
 *    The use of `any` or `any[]` is strictly prohibited. All nested objects,
 *    action parameters, and metadata structures must be explicitly and safely typed.
 * 3. Backward Compatibility Anchor:
 *    These interfaces supersede legacy `FlipbookConfig` models while allowing
 *    bidirectional mapping through `DocumentAdapter`.
 * 4. Caution Areas & Testability:
 *    When extending layer types or viewer modes, ensure adapter converters in
 *    `src/lib/documents/document-adapter.ts` and serialization schemas are updated in sync.
 */

export type DocumentStatus = 'draft' | 'processing' | 'ready' | 'published' | 'archived';

export type DocumentType = 
  | 'brochure' 
  | 'report' 
  | 'prospectus' 
  | 'catalogue' 
  | 'manual' 
  | 'presentation' 
  | 'proposal' 
  | 'handbook' 
  | 'flipbook'
  | 'other';

export type DocumentSourceType = 'pdf' | 'docx' | 'pptx' | 'epub' | 'image' | 'image_collection' | 'media';

export type VersionStatus = 'processing' | 'ready' | 'published' | 'superseded' | 'failed';

export type PageProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type TextExtractionStatus = 'none' | 'extracted' | 'ocr_completed' | 'failed';

export type ViewerMode = 'flipbook' | 'single_page' | 'double_page' | 'continuous' | 'presentation' | 'mobile_reader';

export type AnimationType = 'page_flip' | 'slide' | 'fade' | 'cover_flow' | 'none';

export type LayerType = 
  | 'link' 
  | 'button' 
  | 'video' 
  | 'audio' 
  | 'image' 
  | 'embed' 
  | 'form' 
  | 'cta' 
  | 'whatsapp' 
  | 'phone' 
  | 'email' 
  | 'page_navigation' 
  | 'document_navigation' 
  | 'download' 
  | 'calendar' 
  | 'crm_action';

export type AccessVisibility = 'public' | 'private' | 'protected' | 'authenticated' | 'tokenized';

export type DistributionType = 
  | 'public_link' 
  | 'campaign' 
  | 'email' 
  | 'whatsapp' 
  | 'sms' 
  | 'embed' 
  | 'qr' 
  | 'contact_link';

export type ProcessingJobType = 
  | 'validate_source' 
  | 'detect_format' 
  | 'extract_pages' 
  | 'render_pages' 
  | 'generate_thumbnails' 
  | 'extract_text' 
  | 'ocr' 
  | 'generate_preview' 
  | 'index_search' 
  | 'optimize_assets' 
  | 'finalize_document';

export type ProcessingJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type DocumentEventType = 
  | 'document_loaded'
  | 'document_opened'
  | 'document_closed'
  | 'document_completed'
  | 'document_shared'
  | 'document_downloaded'
  | 'document_printed'
  | 'page_entered'
  | 'page_viewed'
  | 'page_exited'
  | 'page_flipped'
  | 'page_jump'
  | 'page_zoomed'
  | 'layer_viewed'
  | 'link_clicked'
  | 'button_clicked'
  | 'video_started'
  | 'video_completed'
  | 'audio_started'
  | 'form_started'
  | 'form_completed'
  | 'cta_clicked'
  | 'viewer_loaded'
  | 'fullscreen_entered'
  | 'fullscreen_exited'
  | 'thumbnail_opened'
  | 'thumbnail_clicked'
  | 'search_opened'
  | 'search_performed'
  | 'lead_gate_shown'
  | 'lead_gate_started'
  | 'lead_gate_submitted'
  | 'contact_identified'
  | 'share_started'
  | 'share_completed'
  | 'qr_opened'
  | 'embed_loaded';

// ── 1. Document Entity ────────────────────────────────────────────────────────
export interface Document {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  slug: string;
  status: DocumentStatus;
  documentType: DocumentType;
  activeVersionId: string;
  defaultViewerMode: ViewerMode;
  coverPageId?: string;
  metadata?: Record<string, string | number | boolean | null>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  viewsCount?: number;
  leadsCount?: number;
  flipsCount?: number;
  likesCount?: number;
  tags?: string[];
}

// ── 2. Document Version Entity ────────────────────────────────────────────────
export interface DocumentVersion {
  id: string;
  documentId: string;
  workspaceId: string;
  versionNumber: number;
  sourceId: string;
  pageCount: number;
  status: VersionStatus;
  checksum?: string;
  createdBy: string;
  createdAt: string;
  publishedAt?: string;
}

// ── 3. Document Source Entity ─────────────────────────────────────────────────
export interface DocumentSource {
  id: string;
  documentId: string;
  versionId: string;
  workspaceId: string;
  fileName: string;
  mimeType: string;
  sourceType: DocumentSourceType;
  storagePath?: string;
  sourceUrl: string;
  fileSize?: number;
  checksum?: string;
  uploadedBy: string;
  uploadedAt: string;
}

// ── 4. Document Page Entity ───────────────────────────────────────────────────
export interface DocumentPage {
  id: string;
  documentId: string;
  versionId: string;
  workspaceId: string;
  pageNumber: number;
  width: number;
  height: number;
  aspectRatio: number;
  sourceAssetId?: string;
  renderedAssetUrl: string;
  thumbnailUrl?: string;
  extractedText?: string;
  textStatus: TextExtractionStatus;
  ocrStatus?: 'none' | 'completed' | 'failed';
  processingStatus: PageProcessingStatus;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
}

// ── 5. Document Asset Entity ──────────────────────────────────────────────────
export interface DocumentAsset {
  id: string;
  workspaceId: string;
  documentId: string;
  versionId?: string;
  pageId?: string;
  assetType: 'source' | 'page' | 'thumbnail' | 'preview' | 'audio' | 'video' | 'image';
  storagePath: string;
  cdnUrl: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  checksum?: string;
  createdAt: string;
}

// ── 6. Interactive Layer & Actions ────────────────────────────────────────────
export interface LayerAction {
  type: 'url' | 'page_jump' | 'document_jump' | 'form' | 'campaign' | 'automation' | 'phone' | 'email' | 'whatsapp' | 'download';
  targetUrl?: string;
  pageNumber?: number;
  targetDocumentId?: string;
  targetFormId?: string;
  targetCampaignId?: string;
  targetAutomationId?: string;
  phoneNumber?: string;
  emailAddress?: string;
  whatsappNumber?: string;
  parameters?: Record<string, string | number | boolean>;
}

export interface DocumentLayer {
  id: string;
  documentId: string;
  versionId: string;
  pageId: string;
  pageNumber: number;
  type: LayerType;
  x: number;          // Left percentage (0 - 100)
  y: number;          // Top percentage (0 - 100)
  width: number;      // Width percentage (0 - 100)
  height: number;     // Height percentage (0 - 100)
  rotation?: number;  // Rotation degrees (0 - 360)
  zIndex?: number;
  visible: boolean;
  title?: string;
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    opacity?: number;
    color?: string;
  };
  behavior?: {
    autoPlay?: boolean;
    loop?: boolean;
    openInNewTab?: boolean;
  };
  content?: {
    text?: string;
    mediaUrl?: string;
    icon?: string;
  };
  action?: LayerAction;
  tracking?: {
    eventName?: string;
    leadScoreDelta?: number;
    applyTag?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ── 7. Viewer Experience Configuration ────────────────────────────────────────
export interface ViewerAnimationConfig {
  type: AnimationType;
  durationMs: number;
  pageCurl: boolean;
  soundEnabled: boolean;
  soundVolume?: number;
  reducedMotionFallback: boolean;
}

export interface ViewerExperience {
  id: string;
  documentId: string;
  workspaceId: string;
  mode: ViewerMode;
  layout: {
    pageStyle: 'magazine' | 'booklet' | 'album' | 'notebook' | 'single';
    hardcover: boolean;
    aspectRatio: number;
  };
  theme: {
    backgroundColor: string;
    bgImageUrl?: string;
    pageShadow: boolean;
    borderRadius?: number;
  };
  navigation: {
    enableThumbnails: boolean;
    enablePageNumbers: boolean;
    enableProgressScrubber: boolean;
    enableKeyboardNav: boolean;
    enableTouchGestures: boolean;
  };
  animation: ViewerAnimationConfig;
  controls: {
    enableDownloadPdf: boolean;
    enablePrint: boolean;
    enableShare: boolean;
    enableSearch: boolean;
    enableFullscreen: boolean;
    enableZoom: boolean;
  };
  branding: {
    logoUrl?: string;
    logoRedirectUrl?: string;
    hidePlatformBranding?: boolean;
    customFaviconUrl?: string;
  };
  leadGate?: {
    enabled: boolean;
    triggerPage: number;
    title: string;
    description: string;
    requireName: boolean;
    requireEmail: boolean;
    requirePhone: boolean;
    ctaText: string;
    tagToApply?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ── 8. Access Policy ──────────────────────────────────────────────────────────
export interface AccessPolicy {
  documentId: string;
  workspaceId: string;
  visibility: AccessVisibility;
  passwordHash?: string;
  salt?: string;
  allowedDomains?: string[];
  allowedContacts?: string[];
  tokenRequired?: boolean;
  tokenExpiration?: string;
  downloadPolicy: 'allowed' | 'authenticated_only' | 'lead_gated' | 'disabled';
  printPolicy: 'allowed' | 'disabled';
  watermarkPolicy?: {
    enabled: boolean;
    text?: string;
    dynamicViewerEmail?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

// ── 9. Document Distribution ──────────────────────────────────────────────────
export interface DocumentDistribution {
  id: string;
  workspaceId: string;
  documentId: string;
  versionId: string;
  type: DistributionType;
  campaignId?: string;
  contactId?: string;
  token?: string;
  trackingParameters?: Record<string, string>;
  expiresAt?: string;
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
}

// ── 10. Viewer Session & Visitor Identity ─────────────────────────────────────
export interface ViewerSession {
  id: string;
  workspaceId: string;
  documentId: string;
  versionId: string;
  visitorId: string;
  contactId?: string;
  distributionId?: string;
  campaignId?: string;
  startedAt: string;
  lastActivityAt: string;
  endedAt?: string;
  device: {
    type: 'mobile' | 'tablet' | 'desktop' | 'unknown';
    userAgent?: string;
    screenResolution?: string;
  };
  browser: string;
  os: string;
  pagesViewed: number[];
  completionPercentage: number;
  totalDwellTimeMs: number;
  engagementScore: number;
}

export interface Visitor {
  id: string;
  workspaceId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  contactId?: string;
  metadata?: Record<string, string | number | boolean>;
}

// ── 11. Document Event Telemetry ──────────────────────────────────────────────
export interface DocumentEvent {
  id: string;
  workspaceId: string;
  documentId: string;
  versionId?: string;
  sessionId: string;
  visitorId: string;
  contactId?: string;
  distributionId?: string;
  campaignId?: string;
  eventType: DocumentEventType;
  occurredAt: string;
  pageNumber?: number;
  previousPage?: number;
  nextPage?: number;
  durationMs?: number;
  elementId?: string;
  metadata?: Record<string, string | number | boolean>;
  device?: string;
  browser?: string;
}

// ── 12. Document Processing Job ───────────────────────────────────────────────
export interface DocumentProcessingJob {
  id: string;
  workspaceId: string;
  documentId: string;
  versionId: string;
  jobType: ProcessingJobType;
  status: ProcessingJobStatus;
  progress: number; // 0 to 100
  stage?: string;
  attempts: number;
  maxAttempts: number;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}
