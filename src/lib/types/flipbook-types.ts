/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Backward Compatibility & Adapter Anchor for Flipbook Models:
 *    Maintains legacy schemas for Flipbook Studio (v1) while re-exporting
 *    all enterprise Document Experience Platform (v2) domain types from `./document-types`.
 * 2. Strict Typing Standard:
 *    No `any` or `any[]` types are permitted. All properties must be explicitly typed.
 * 3. Caution Areas:
 *    Code migrating to Document domain models should import directly from `@/lib/types/document-types`.
 */

export * from './document-types';

export type FlipbookPageStyle = 'magazine' | 'booklet' | 'album' | 'notebook' | 'single';

export type HotspotType = 'link' | 'video' | 'audio' | 'image' | 'web';

export interface FlipbookHotspot {
  id: string;
  pageNumber: number;
  x: number; // Percentage offset from left (0 to 100)
  y: number; // Percentage offset from top (0 to 100)
  width: number; // Percentage width (0 to 100)
  height: number; // Percentage height (0 to 100)
  type: HotspotType;
  title?: string;
  targetUrl?: string;
  pageTarget?: number;
  autoPlay?: boolean;
  icon?: string;
}

export interface FlipbookLeadGate {
  enabled: boolean;
  triggerPage: number; // Page number where lead capture modal appears (0 = before page 1)
  title: string;
  description: string;
  requireName: boolean;
  requireEmail: boolean;
  requirePhone: boolean;
  ctaText: string;
  tagToApply?: string;
}

export interface FlipbookStyleConfig {
  pageStyle: FlipbookPageStyle;
  soundEnabled: boolean;
  hardcover: boolean;
  backgroundColor: string;
  bgImageUrl?: string;
  logoUrl?: string;
  logoRedirectUrl?: string;
  enableDownloadPdf: boolean;
  enablePrint: boolean;
  enableShare: boolean;
  enableSearch: boolean;
  enableThumbnails: boolean;
}

export interface FlipbookPage {
  id: string;
  flipbookId: string;
  pageNumber: number;
  imageUrl: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  extractedText?: string;
}

export interface InteractionGatePolicy {
  requireLeadForLike?: boolean;
  requireLeadForShare?: boolean;
  requireLeadForDownload?: boolean;
  leadCaptureType?: 'survey' | 'form' | 'pdf' | 'custom';
  leadCaptureResourceId?: string;
  applySameGateToCta?: boolean;
}

export interface FlipbookConfig {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  slug: string;
  status: 'draft' | 'published';
  sourceFileUrl: string;
  sourceFileType: 'pdf' | 'docx' | 'epub' | 'media';
  sourceFileName: string;
  pageCount: number;
  aspectRatio: number; // width / height
  style: FlipbookStyleConfig;
  hotspots: FlipbookHotspot[];
  leadGate: FlipbookLeadGate;
  interactionPolicy?: InteractionGatePolicy;
  password?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  viewsCount?: number;
  leadsCount?: number;
  flipsCount?: number;
  likesCount?: number;
}

export interface FlipbookLeadSubmission {
  id: string;
  flipbookId: string;
  workspaceId: string;
  name?: string;
  email: string;
  phone?: string;
  submittedAt: string;
  contactId?: string;
}

export interface FlipbookAnalyticsEvent {
  id: string;
  flipbookId: string;
  workspaceId: string;
  eventType: 'view' | 'flip' | 'hotspot_click' | 'lead_captured' | 'download';
  pageNumber?: number;
  hotspotId?: string;
  timestamp: string;
  sessionId?: string;
}
