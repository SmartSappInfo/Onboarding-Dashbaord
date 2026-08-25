/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Document Adapter Protocol:
 *    Provides bidirectional mapping between legacy Flipbook structures (`FlipbookConfig`, `FlipbookPage`, `FlipbookHotspot`)
 *    and enterprise Document Platform aggregates (`Document`, `DocumentVersion`, `DocumentPage`, `DocumentLayer`, `ViewerExperience`, `AccessPolicy`).
 * 2. Zero-Downtime Migration Support:
 *    Ensures legacy `/admin/flipbooks` and `/f/[slug]` endpoints can read and write Document domain
 *    entities interchangeably without breaking existing active sessions or database indexes.
 * 3. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted. All properties, fallbacks, and action targets are strictly mapped.
 * 4. Caution Areas:
 *    When adding new layer types or experience properties, update both conversion directions to ensure idempotent round-tripping.
 */

import type { 
  FlipbookConfig, 
  FlipbookPage, 
  FlipbookHotspot, 
  HotspotType 
} from '@/lib/types/flipbook-types';
import type { 
  Document, 
  DocumentVersion, 
  DocumentSource, 
  DocumentPage, 
  DocumentLayer, 
  ViewerExperience, 
  AccessPolicy, 
  LayerType,
  ViewerMode,
  DocumentSourceType
} from '@/lib/types/document-types';

/**
 * Maps a legacy HotspotType string to a valid Document LayerType.
 */
export function mapHotspotTypeToLayerType(type: HotspotType): LayerType {
  switch (type) {
    case 'link': return 'link';
    case 'video': return 'video';
    case 'audio': return 'audio';
    case 'image': return 'image';
    case 'web': return 'embed';
    default: return 'link';
  }
}

/**
 * Maps a Document LayerType back to a legacy HotspotType.
 */
export function mapLayerTypeToHotspotType(type: LayerType): HotspotType {
  switch (type) {
    case 'link': return 'link';
    case 'video': return 'video';
    case 'audio': return 'audio';
    case 'image': return 'image';
    case 'embed': return 'web';
    case 'form': return 'web';
    case 'cta': return 'link';
    case 'whatsapp': return 'link';
    case 'phone': return 'link';
    case 'email': return 'link';
    case 'page_navigation': return 'link';
    case 'document_navigation': return 'link';
    case 'download': return 'link';
    case 'calendar': return 'web';
    case 'crm_action': return 'link';
    default: return 'link';
  }
}

/**
 * Converts a legacy FlipbookHotspot to a DocumentLayer.
 */
export function mapHotspotToLayer(hotspot: FlipbookHotspot, documentId: string, versionId: string, pageId?: string): DocumentLayer {
  const layerType = mapHotspotTypeToLayerType(hotspot.type);
  const now = new Date().toISOString();

  return {
    id: hotspot.id,
    documentId,
    versionId,
    pageId: pageId || `${documentId}_page_${hotspot.pageNumber}`,
    pageNumber: hotspot.pageNumber,
    type: layerType,
    x: hotspot.x,
    y: hotspot.y,
    width: hotspot.width,
    height: hotspot.height,
    visible: true,
    title: hotspot.title || '',
    behavior: {
      autoPlay: hotspot.autoPlay ?? false,
      openInNewTab: true,
    },
    content: {
      mediaUrl: hotspot.targetUrl,
      icon: hotspot.icon,
    },
    action: hotspot.pageTarget ? {
      type: 'page_jump',
      pageNumber: hotspot.pageTarget,
    } : {
      type: 'url',
      targetUrl: hotspot.targetUrl,
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Converts a DocumentLayer back to a legacy FlipbookHotspot.
 */
export function mapLayerToHotspot(layer: DocumentLayer): FlipbookHotspot {
  return {
    id: layer.id,
    pageNumber: layer.pageNumber,
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    type: mapLayerTypeToHotspotType(layer.type),
    title: layer.title,
    targetUrl: layer.action?.targetUrl || layer.content?.mediaUrl,
    pageTarget: layer.action?.pageNumber,
    autoPlay: layer.behavior?.autoPlay,
    icon: layer.content?.icon,
  };
}

/**
 * Converts a legacy FlipbookPage to a DocumentPage.
 */
export function flipbookPageToDocumentPage(page: FlipbookPage, versionId: string, workspaceId: string): DocumentPage {
  const now = new Date().toISOString();
  return {
    id: page.id,
    documentId: page.flipbookId,
    versionId,
    workspaceId,
    pageNumber: page.pageNumber,
    width: page.width || 800,
    height: page.height || 1130,
    aspectRatio: page.width && page.height ? page.width / page.height : 0.707,
    renderedAssetUrl: page.imageUrl,
    thumbnailUrl: page.thumbnailUrl || page.imageUrl,
    extractedText: page.extractedText || '',
    textStatus: page.extractedText ? 'extracted' : 'none',
    processingStatus: 'completed',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Converts a DocumentPage back to a legacy FlipbookPage.
 */
export function documentPageToFlipbookPage(page: DocumentPage): FlipbookPage {
  return {
    id: page.id,
    flipbookId: page.documentId,
    pageNumber: page.pageNumber,
    imageUrl: page.renderedAssetUrl,
    thumbnailUrl: page.thumbnailUrl || page.renderedAssetUrl,
    width: page.width,
    height: page.height,
    extractedText: page.extractedText,
  };
}

/**
 * Transforms a legacy FlipbookConfig into the full set of Document entities.
 */
export function flipbookToDocumentAggregate(flipbook: FlipbookConfig): {
  document: Document;
  version: DocumentVersion;
  source: DocumentSource;
  experience: ViewerExperience;
  accessPolicy: AccessPolicy;
  layers: DocumentLayer[];
} {
  const versionId = `${flipbook.id}_v1`;
  const sourceId = `${flipbook.id}_source`;
  const now = flipbook.updatedAt || flipbook.createdAt || new Date().toISOString();

  const sourceTypeMap: Record<string, DocumentSourceType> = {
    pdf: 'pdf',
    docx: 'docx',
    epub: 'epub',
    media: 'media',
  };
  const sourceType = sourceTypeMap[flipbook.sourceFileType] || 'pdf';

  const document: Document = {
    id: flipbook.id,
    workspaceId: flipbook.workspaceId,
    title: flipbook.title,
    description: flipbook.description,
    slug: flipbook.slug,
    status: flipbook.status === 'published' ? 'published' : 'draft',
    documentType: 'flipbook',
    activeVersionId: versionId,
    defaultViewerMode: 'flipbook' as ViewerMode,
    createdBy: flipbook.createdBy || 'system',
    createdAt: flipbook.createdAt || now,
    updatedAt: flipbook.updatedAt || now,
    viewsCount: flipbook.viewsCount || 0,
    leadsCount: flipbook.leadsCount || 0,
    flipsCount: flipbook.flipsCount || 0,
    likesCount: flipbook.likesCount || 0,
  };

  const version: DocumentVersion = {
    id: versionId,
    documentId: flipbook.id,
    workspaceId: flipbook.workspaceId,
    versionNumber: 1,
    sourceId,
    pageCount: flipbook.pageCount || 1,
    status: flipbook.status === 'published' ? 'published' : 'ready',
    createdBy: flipbook.createdBy || 'system',
    createdAt: flipbook.createdAt || now,
    publishedAt: flipbook.status === 'published' ? now : undefined,
  };

  const source: DocumentSource = {
    id: sourceId,
    documentId: flipbook.id,
    versionId,
    workspaceId: flipbook.workspaceId,
    fileName: flipbook.sourceFileName || 'document.pdf',
    mimeType: flipbook.sourceFileType === 'pdf' ? 'application/pdf' : 'application/octet-stream',
    sourceType,
    sourceUrl: flipbook.sourceFileUrl,
    uploadedBy: flipbook.createdBy || 'system',
    uploadedAt: flipbook.createdAt || now,
  };

  const experience: ViewerExperience = {
    id: `${flipbook.id}_experience`,
    documentId: flipbook.id,
    workspaceId: flipbook.workspaceId,
    mode: 'flipbook',
    layout: {
      pageStyle: flipbook.style?.pageStyle || 'magazine',
      hardcover: flipbook.style?.hardcover ?? false,
      aspectRatio: flipbook.aspectRatio || 1.414,
    },
    theme: {
      backgroundColor: flipbook.style?.backgroundColor || '#f1f5f9',
      bgImageUrl: flipbook.style?.bgImageUrl,
      pageShadow: true,
    },
    navigation: {
      enableThumbnails: flipbook.style?.enableThumbnails ?? true,
      enablePageNumbers: true,
      enableProgressScrubber: true,
      enableKeyboardNav: true,
      enableTouchGestures: true,
    },
    animation: {
      type: 'page_flip',
      durationMs: 600,
      pageCurl: true,
      soundEnabled: flipbook.style?.soundEnabled ?? true,
      reducedMotionFallback: true,
    },
    controls: {
      enableDownloadPdf: flipbook.style?.enableDownloadPdf ?? true,
      enablePrint: flipbook.style?.enablePrint ?? true,
      enableShare: flipbook.style?.enableShare ?? true,
      enableSearch: flipbook.style?.enableSearch ?? true,
      enableFullscreen: true,
      enableZoom: true,
    },
    branding: {
      logoUrl: flipbook.style?.logoUrl,
      logoRedirectUrl: flipbook.style?.logoRedirectUrl,
    },
    leadGate: flipbook.leadGate ? {
      enabled: flipbook.leadGate.enabled,
      triggerPage: flipbook.leadGate.triggerPage,
      title: flipbook.leadGate.title,
      description: flipbook.leadGate.description,
      requireName: flipbook.leadGate.requireName,
      requireEmail: flipbook.leadGate.requireEmail,
      requirePhone: flipbook.leadGate.requirePhone,
      ctaText: flipbook.leadGate.ctaText,
      tagToApply: flipbook.leadGate.tagToApply,
    } : undefined,
    createdAt: now,
    updatedAt: now,
  };

  const accessPolicy: AccessPolicy = {
    documentId: flipbook.id,
    workspaceId: flipbook.workspaceId,
    visibility: flipbook.password ? 'protected' : 'public',
    downloadPolicy: flipbook.style?.enableDownloadPdf ? 'allowed' : 'disabled',
    printPolicy: flipbook.style?.enablePrint ? 'allowed' : 'disabled',
    createdAt: now,
    updatedAt: now,
  };

  const layers = (flipbook.hotspots || []).map((h) => mapHotspotToLayer(h, flipbook.id, versionId));

  return {
    document,
    version,
    source,
    experience,
    accessPolicy,
    layers,
  };
}

/**
 * Reconstructs a legacy FlipbookConfig object from Document entities for backward compatibility.
 */
export function documentAggregateToFlipbook(
  doc: Document,
  source?: DocumentSource | null,
  experience?: ViewerExperience | null,
  layers?: DocumentLayer[] | null,
  accessPolicy?: AccessPolicy | null,
  pageCount?: number
): FlipbookConfig {
  const hotspots: FlipbookHotspot[] = (layers || []).map(mapLayerToHotspot);

  return {
    id: doc.id,
    workspaceId: doc.workspaceId,
    title: doc.title,
    description: doc.description,
    slug: doc.slug,
    status: doc.status === 'published' ? 'published' : 'draft',
    sourceFileUrl: source?.sourceUrl || '',
    sourceFileType: (source?.sourceType === 'docx' || source?.sourceType === 'epub' || source?.sourceType === 'media') 
      ? source.sourceType 
      : 'pdf',
    sourceFileName: source?.fileName || 'document.pdf',
    pageCount: pageCount || 1,
    aspectRatio: experience?.layout?.aspectRatio || 1.414,
    style: {
      pageStyle: experience?.layout?.pageStyle || 'magazine',
      soundEnabled: experience?.animation?.soundEnabled ?? true,
      hardcover: experience?.layout?.hardcover ?? false,
      backgroundColor: experience?.theme?.backgroundColor || '#f1f5f9',
      bgImageUrl: experience?.theme?.bgImageUrl,
      logoUrl: experience?.branding?.logoUrl,
      logoRedirectUrl: experience?.branding?.logoRedirectUrl,
      enableDownloadPdf: experience?.controls?.enableDownloadPdf ?? true,
      enablePrint: experience?.controls?.enablePrint ?? true,
      enableShare: experience?.controls?.enableShare ?? true,
      enableSearch: experience?.controls?.enableSearch ?? true,
      enableThumbnails: experience?.navigation?.enableThumbnails ?? true,
    },
    hotspots,
    leadGate: experience?.leadGate ? {
      enabled: experience.leadGate.enabled,
      triggerPage: experience.leadGate.triggerPage,
      title: experience.leadGate.title,
      description: experience.leadGate.description,
      requireName: experience.leadGate.requireName,
      requireEmail: experience.leadGate.requireEmail,
      requirePhone: experience.leadGate.requirePhone,
      ctaText: experience.leadGate.ctaText,
      tagToApply: experience.leadGate.tagToApply,
    } : {
      enabled: false,
      triggerPage: 0,
      title: 'Unlock Full Access',
      description: 'Enter your contact details to continue reading.',
      requireName: true,
      requireEmail: true,
      requirePhone: false,
      ctaText: 'Unlock Reader',
    },
    password: accessPolicy?.passwordHash ? '***' : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    createdBy: doc.createdBy,
    viewsCount: doc.viewsCount || 0,
    leadsCount: doc.leadsCount || 0,
    flipsCount: doc.flipsCount || 0,
    likesCount: doc.likesCount || 0,
  };
}
