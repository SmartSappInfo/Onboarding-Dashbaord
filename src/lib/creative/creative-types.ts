/**
 * ARCHITECTURE:
 * SmartSapp Creative Studio 2.0 Core Domain Types & Data Contracts
 * 
 * Provides strict TypeScript models for Projects, Documents, Elements,
 * Assets, Brand Kits, Versions, Comments, Concepts, and Publications.
 * 
 * CAUTION:
 * All element coordinate models use relative percentages (0-100%) to maintain
 * responsive rendering across viewports and export resolutions.
 * Strict typing is enforced (0% any / any[]).
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/creative-types.test.ts
 */

import type { CanvasElement, ElementShadow, ThumbnailDesign } from '@/lib/thumbnail/thumbnail-types';

export type { ElementShadow, CanvasElement };

export type CreativeProjectType =
  | 'youtube_thumbnail'
  | 'social'
  | 'ad'
  | 'email'
  | 'landing_page'
  | 'presentation'
  | 'podcast'
  | 'event'
  | 'custom';

export type CreativeProjectObjective =
  | 'awareness'
  | 'engagement'
  | 'traffic'
  | 'lead_generation'
  | 'conversion'
  | 'sales'
  | 'education'
  | 'announcement';

export type CreativeProjectStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'archived';

export type SemanticRole =
  | 'headline'
  | 'subtitle'
  | 'body'
  | 'cta'
  | 'subject'
  | 'background'
  | 'brand_logo'
  | 'badge'
  | 'decoration'
  | 'safe_zone';

export interface GradientConfig {
  type: 'linear' | 'radial';
  angle?: number; // In degrees, default 135
  colors: string[]; // Hex or rgba color strings
}

export interface CreativeElement extends CanvasElement {
  semanticRole?: SemanticRole;
  semanticDescription?: string;
  assetId?: string;
  keepAspectRatio?: boolean;
  clipPath?: string;
  frameShape?: 'circle' | 'squircle' | 'pill' | 'phone_mockup' | 'none';
}

export interface CreativeGroup {
  id: string;
  name: string;
  elementIds: string[];
  isLocked?: boolean;
  isHidden?: boolean;
  rotation?: number;
}

export type AlignmentType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributionType = 'horizontal' | 'vertical';

export interface SnapGuideLine {
  orientation: 'horizontal' | 'vertical';
  position: number; // percentage (0 - 100)
  label?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface CanvasFormatConfig {
  type: CreativeProjectType;
  width: number;
  height: number;
  aspectRatio: number; // e.g. 16/9, 1/1, 9/16, 4/5
  platform?: string; // 'youtube' | 'instagram' | 'linkedin' | 'facebook' | 'web'
  label: string;
}

export interface CreativeDocument {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  format: CanvasFormatConfig;
  backgroundColor: string;
  backgroundGradient?: GradientConfig;
  backgroundImage?: string;
  elements: CreativeElement[];
  currentVersionId?: string;
  thumbnailUrl?: string; // Rendered CDN link in Firebase Storage
  status: 'draft' | 'locked' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface CreativeProject {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  type: CreativeProjectType;
  objective: CreativeProjectObjective;
  status: CreativeProjectStatus;
  
  // CRM Linkages
  campaignId?: string;
  campaignName?: string;
  segmentId?: string;
  contentId?: string;
  dealId?: string;
  
  audience?: {
    description?: string;
    segmentIds?: string[];
  };
  
  brandKitId?: string;
  thumbnailUrl?: string;
  documentId?: string; // Primary document ID
  
  // Metadata
  ownerId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandAIRule {
  id: string;
  type: 'color' | 'font' | 'logo' | 'imagery' | 'tone' | 'layout' | 'accessibility';
  rule: string;
  severity: 'required' | 'recommended' | 'optional';
  active: boolean;
}

export interface BrandKit {
  id?: string;
  workspaceId: string;
  name: string;
  logos?: {
    primary?: string;
    secondary?: string;
    monochrome?: string;
    icon?: string;
  };
  colors: {
    primary: string[];
    secondary: string[];
    accent: string[];
    neutral: string[];
  };
  typography: {
    displayFont: string;
    headingFont: string;
    bodyFont: string;
  };
  watermarkUrl?: string;
  aiRules?: BrandAIRule[];
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrandComplianceReport {
  overallScore: number; // 0 - 100
  isCompliant: boolean;
  violations: {
    ruleId?: string;
    ruleType: 'color' | 'font' | 'logo' | 'watermark' | 'layout';
    message: string;
    severity: 'required' | 'recommended' | 'optional';
  }[];
  evaluatedAt: string;
}

export interface CrmCampaignContext {
  campaignId?: string;
  campaignName?: string;
  targetAudience?: string;
  objective?: 'lead_generation' | 'sales_conversion' | 'event_attendance' | 'awareness';
  segmentId?: string;
  segmentName?: string;
  dealId?: string;
}

export interface CrmContactPreview {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  phone?: string;
  avatarUrl?: string;
  customFields?: Record<string, string>;
}

export interface BatchPersonalizationJob {
  id: string;
  projectId: string;
  segmentId: string;
  totalCount: number;
  completedCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  generatedDocumentIds: string[];
  createdAt: string;
}

export interface CreativeComment {
  id: string;
  projectId: string;
  documentId?: string;
  elementId?: string;
  authorId?: string;
  authorName: string;
  authorEmail: string;
  text: string;
  resolved: boolean;
  pinX?: number; // Normalized 0 - 100%
  pinY?: number; // Normalized 0 - 100%
  replies?: {
    id: string;
    authorName: string;
    text: string;
    createdAt: string;
  }[];
  createdAt: string;
  updatedAt?: string;
}

export interface PresenceUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  color: string;
  cursorX?: number; // Normalized 0 - 100%
  cursorY?: number; // Normalized 0 - 100%
  selectedElementId?: string;
  lastActive: string;
}

export interface CreativeApprovalDecision {
  projectId: string;
  status: 'approved' | 'changes_requested' | 'in_review';
  reviewerName: string;
  reviewerEmail: string;
  note?: string;
  decisionAt: string;
}

export type PublishingChannel = 'youtube' | 'facebook' | 'instagram' | 'linkedin' | 'crm_asset';

export interface ConnectedChannel {
  id: string;
  channel: PublishingChannel;
  accountName: string;
  accountAvatarUrl?: string;
  connected: boolean;
  lastSyncedAt: string;
}

export interface PublicationRecord {
  id: string;
  projectId: string;
  documentId: string;
  workspaceId: string;
  channel: PublishingChannel;
  targetIdentifier: string; // e.g. YouTube Video ID, FB Page ID, LinkedIn Post URN
  status: 'published' | 'scheduled' | 'failed';
  publishedAt?: string;
  scheduledFor?: string;
  platformPostUrl?: string;
  authorName: string;
  createdAt: string;
}

export interface PreFlightCheckItem {
  id: string;
  label: string;
  passed: boolean;
  severity: 'error' | 'warning';
  message: string;
}

export interface ExperimentVariant {
  id: string;
  name: string; // "Variant A (Control)", "Variant B (Curiosity Hook)"
  documentId: string;
  trafficWeight: number; // 0 - 100%
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  conversionRate: number;
  isControl: boolean;
  isWinner?: boolean;
}

export interface CreativeExperiment {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  hypothesis: string;
  status: 'draft' | 'running' | 'concluded';
  channel: PublishingChannel;
  variants: ExperimentVariant[];
  winningVariantId?: string;
  confidenceScore?: number; // 0 - 100%
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatisticalResult {
  isSignificant: boolean;
  confidenceLevel: number; // e.g. 96.4%
  pValue: number;
  liftPercentage: number;
  winningVariantId?: string;
  recommendation: string;
}

export interface PerformanceMetrics {
  projectId: string;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  conversionRate: number;
  pipelineValue: number; // $ USD
  revenueGenerated: number; // $ USD
  adSpend: number; // $ USD
  roas: number; // Revenue / Ad Spend
  topChannel: PublishingChannel;
}

export interface CampaignAttributionSummary {
  campaignId: string;
  campaignName: string;
  totalCreatives: number;
  totalImpressions: number;
  totalConversions: number;
  totalRevenue: number;
  bestPerformingProjectId: string;
}

export interface ExportOptions {
  format: 'png' | 'jpeg' | 'webp' | 'svg' | 'pdf';
  scale: 1 | 2 | 4; // 1x Standard, 2x HD, 4x Ultra-HD Print
  quality: number; // 0.8 - 1.0
  transparentBackground: boolean;
}

export interface CreativeVersion {
  id: string;
  projectId: string;
  documentId: string;
  versionNumber: number;
  elements: CreativeElement[];
  backgroundColor: string;
  backgroundGradient?: GradientConfig;
  backgroundImage?: string;
  previewUrl?: string;
  note?: string;
  createdBy: string;
  createdAt: string;
}

export interface CreativeAsset {
  id: string;
  workspaceId: string;
  name: string;
  type: 'image' | 'video' | 'logo' | 'font' | 'icon' | 'illustration' | 'cutout';
  source: 'upload' | 'ai_generated' | 'stock' | 'crm' | 'system';
  storagePath: string;
  previewUrl: string;
  mimeType: string;
  fileSize?: number;
  width?: number;
  height?: number;
  tags?: string[];
  dominantColors?: string[];
  createdBy: string;
  createdAt: string;
}

export interface CreativeTemplate {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'gaming' | 'finance' | 'podcast' | 'education' | 'social' | 'ads' | 'general';
  format: CanvasFormatConfig;
  scope: 'global' | 'workspace';
  workspaceId?: string;
  baselineHealthScore: number;
  backgroundColor: string;
  backgroundGradient?: GradientConfig;
  backgroundImage?: string;
  elements: CreativeElement[];
  previewUrl?: string;
  createdAt: string;
}

export interface CreativeConcept {
  id: string;
  projectId: string;
  workspaceId?: string;
  name: string;
  strategy?: string;
  angle?: 'growth' | 'problem_pain' | 'curiosity' | 'social_proof' | 'urgency';
  emotionalTrigger: string;
  headline: string;
  subtitle?: string;
  visualDirection: string;
  healthScore: number;
  predictedCTRScore?: number;
  colorMood?: string[];
  previewUrl?: string;
  elements?: CreativeElement[];
  backgroundColor?: string;
  backgroundGradient?: GradientConfig;
  documentData?: {
    backgroundColor: string;
    backgroundGradient?: GradientConfig;
    elements: CreativeElement[];
  };
  createdBy: 'user' | 'ai';
  createdAt: string;
}

export interface CopyVariation {
  id: string;
  headline: string;
  hookType: 'curiosity' | 'fear_of_missing_out' | 'data_driven' | 'direct_benefit' | 'contrarian';
  subtitle?: string;
  badge?: string;
  predictedImpact: string;
  characterCount: number;
}

export interface AiCanvasCommandResult {
  explanation: string;
  modifiedElements: CreativeElement[];
  actionSummary: string;
  confidence: number;
  backgroundColor?: string;
  backgroundGradient?: GradientConfig;
}

export interface AiPromptTemplate {
  id: string;
  name: string;
  category: 'concept_generation' | 'canvas_nlp' | 'copy_matrix' | 'visual_audit';
  systemPrompt: string;
  model: 'gemini-2.5-flash' | 'gemini-1.5-pro' | 'gpt-4o';
  temperature: number;
  isActive: boolean;
  updatedAt: string;
}

export interface AiLogEntry {
  id: string;
  workspaceId: string;
  projectId?: string;
  action: string;
  model: string;
  tokensUsed?: number;
  latencyMs: number;
  success: boolean;
  createdAt: string;
}

export type HealthVectorName =
  | 'Attention'
  | 'Readability'
  | 'Contrast'
  | 'Brand'
  | 'Mobile'
  | 'Accessibility'
  | 'Platform';

export interface HealthVectorScore {
  name: HealthVectorName;
  score: number; // 0 - 100
  status: 'optimal' | 'warning' | 'critical';
  description: string;
}

export type HealthIssueFixType =
  | 'enlarge_headline'
  | 'fix_contrast'
  | 'shift_safe_zone'
  | 'apply_brand_font'
  | 'apply_brand_color'
  | 'clean_clutter';

export interface CreativeHealthIssue {
  id: string;
  category: 'readability' | 'contrast' | 'safe_zone' | 'brand' | 'mobile' | 'density';
  severity: 'critical' | 'warning' | 'optimal';
  title: string;
  message: string;
  targetElementId?: string;
  fixActionType?: HealthIssueFixType;
  fixActionLabel?: string;
}

export interface SaliencyHotspot {
  x: number; // 0 - 100 percentage
  y: number; // 0 - 100 percentage
  weight: number; // 0 - 1 intensity
  radius: number; // radius in percentage
}

export interface CreativeHealthReport {
  overallScore: number; // 0 - 100
  status: 'optimal' | 'warning' | 'critical';
  vectors: HealthVectorScore[];
  issues: CreativeHealthIssue[];
  saliencyHotspots: SaliencyHotspot[];
  evaluatedAt: string;
}

export interface CreativePublication {
  id: string;
  projectId: string;
  documentId: string;
  channel: 'youtube' | 'facebook' | 'instagram' | 'linkedin' | 'website' | 'email';
  destinationId?: string; // e.g. YouTube video ID or LinkedIn post ID
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledFor?: string;
  publishedAt?: string;
  error?: string;
  createdAt: string;
}

export const THUMBNAIL_FONT_OPTIONS: string[] = [
  'Inter',
  'Impact',
  'Montserrat',
  'Outfit',
  'Arial Black',
  'Georgia',
  'Playfair Display',
];

export const FORMAT_PRESETS: Record<CreativeProjectType, CanvasFormatConfig> = {
  youtube_thumbnail: {
    type: 'youtube_thumbnail',
    width: 1280,
    height: 720,
    aspectRatio: 16 / 9,
    platform: 'youtube',
    label: 'YouTube Cover (16:9 - 1280×720)',
  },
  social: {
    type: 'social',
    width: 1080,
    height: 1080,
    aspectRatio: 1,
    platform: 'instagram',
    label: 'Social Square (1:1 - 1080×1080)',
  },
  ad: {
    type: 'ad',
    width: 1200,
    height: 628,
    aspectRatio: 1200 / 628,
    platform: 'facebook',
    label: 'Landscape Ad (1200×628)',
  },
  email: {
    type: 'email',
    width: 600,
    height: 300,
    aspectRatio: 2,
    platform: 'email',
    label: 'Email Header (600×300)',
  },
  landing_page: {
    type: 'landing_page',
    width: 1920,
    height: 1080,
    aspectRatio: 16 / 9,
    platform: 'web',
    label: 'Hero Banner (1920×1080)',
  },
  podcast: {
    type: 'podcast',
    width: 3000,
    height: 3000,
    aspectRatio: 1,
    platform: 'podcast',
    label: 'Podcast Artwork (3000×3000)',
  },
  presentation: {
    type: 'presentation',
    width: 1920,
    height: 1080,
    aspectRatio: 16 / 9,
    platform: 'presentation',
    label: 'Slide Deck 16:9 (1920×1080)',
  },
  event: {
    type: 'event',
    width: 1200,
    height: 675,
    aspectRatio: 16 / 9,
    platform: 'event',
    label: 'Event Banner (1200×675)',
  },
  custom: {
    type: 'custom',
    width: 1280,
    height: 720,
    aspectRatio: 16 / 9,
    platform: 'custom',
    label: 'Custom Dimensions',
  },
};

// -------------------------------------------------------------
// Utilities & Compatibility Mappers
// -------------------------------------------------------------

export function makeUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Converts a legacy ThumbnailDesign into a modern CreativeProject & CreativeDocument pair.
 * Ensures 100% backwards compatibility when loading existing thumbnail documents.
 */
export function thumbnailDesignToCreativeProject(design: ThumbnailDesign): {
  project: CreativeProject;
  document: CreativeDocument;
} {
  const projectId = design.id || makeUniqueId();
  const documentId = `doc-${projectId}`;
  const now = new Date().toISOString();

  const creativeElements: CreativeElement[] = (design.elements || []).map((el) => ({
    ...el,
    semanticRole: el.type === 'text' ? 'headline' : el.type === 'image' ? 'subject' : 'decoration',
  }));

  const project: CreativeProject = {
    id: projectId,
    workspaceId: design.workspaceId || 'default-workspace',
    name: design.name || 'Untitled Thumbnail Project',
    type: 'youtube_thumbnail',
    objective: 'traffic',
    status: 'draft',
    thumbnailUrl: design.thumbnailUrl,
    documentId,
    createdBy: 'system',
    createdAt: design.createdAt || now,
    updatedAt: design.updatedAt || now,
  };

  const document: CreativeDocument = {
    id: documentId,
    projectId,
    workspaceId: design.workspaceId || 'default-workspace',
    name: design.name || 'Untitled Thumbnail Project',
    format: FORMAT_PRESETS.youtube_thumbnail,
    backgroundColor: design.backgroundColor || '#0f172a',
    backgroundGradient: design.backgroundGradient,
    backgroundImage: design.backgroundImage,
    elements: creativeElements,
    thumbnailUrl: design.thumbnailUrl,
    status: 'draft',
    createdAt: design.createdAt || now,
    updatedAt: design.updatedAt || now,
  };

  return { project, document };
}

/**
 * Converts a modern CreativeDocument back into a legacy ThumbnailDesign.
 * Ensures full compatibility for legacy thumbnail consumers, export actions, and media selectors.
 */
export function creativeDocumentToThumbnailDesign(
  doc: CreativeDocument,
  elements?: CreativeElement[]
): ThumbnailDesign {
  return {
    id: doc.projectId || doc.id,
    workspaceId: doc.workspaceId,
    name: doc.name,
    backgroundColor: doc.backgroundColor,
    backgroundGradient: doc.backgroundGradient,
    backgroundImage: doc.backgroundImage,
    elements: elements || doc.elements || [],
    thumbnailUrl: doc.thumbnailUrl,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
