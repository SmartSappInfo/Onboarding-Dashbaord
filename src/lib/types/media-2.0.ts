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
 *    - `MediaTranscript`: Timestamped Speech-to-Text cue lines and speaker labels.
 *    - `MediaChapter`: Segmented video/audio timeline chapters and summaries.
 *    - `MediaContentIntelligence`: AI-extracted summaries, key takeaways, topics, entities, and Qdrant vector point IDs.
 *    - `SemanticSearchHit`: Ranked search hit with exact matching transcript excerpt and jump timestamp.
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

export type RuleConditionOperator = 'gte' | 'lte' | 'eq' | 'neq' | 'contains' | 'in';

export type RuleConditionType = 'watch_progress' | 'contact_score' | 'deal_stage' | 'chapter_viewed' | 'contact_tag';

export interface RuleCondition {
  id: string;
  type: RuleConditionType;
  operator: RuleConditionOperator;
  value: string | number;
}

export interface RuleAction {
  ctaTitle: string;
  ctaButtonText: string;
  targetUrl: string;
  ctaType: 'survey' | 'form' | 'pdf' | 'meeting' | 'external';
  ctaMode: 'modal' | 'redirect' | 'replace';
  unlockGate: 'immediate' | 'quarter' | 'half' | 'threequarters' | 'complete';
}

export interface DynamicCtaRule {
  id: string;
  name: string;
  priority: number;
  conditions: RuleCondition[];
  action: RuleAction;
  isActive: boolean;
}

export interface PersonalizationConfig {
  enabled: boolean;
  headlineTemplate: string;
  descriptionTemplate: string;
  fallbackHeadline: string;
  fallbackDescription: string;
}

export interface ContentRecommendation {
  enabled: boolean;
  strategy: 'collection' | 'package' | 'format_preference' | 'ai_curated';
  targetCollectionId?: string;
  targetPackageId?: string;
  maxRecommendations: number;
}

export interface ABExperimentMetrics {
  variantAViews: number;
  variantAClicks: number;
  variantBViews: number;
  variantBClicks: number;
}

export interface ABExperimentVariantOverrides {
  headline?: string;
  buttonText?: string;
  targetUrl?: string;
  gating?: 'immediate' | 'quarter' | 'half' | 'threequarters' | 'complete';
}

export interface ABExperimentConfig {
  id: string;
  name: string;
  enabled: boolean;
  trafficSplitPercent: number; // 0 to 100 (% directed to Variant A, remainder to Variant B)
  variantA: ABExperimentVariantOverrides;
  variantB: ABExperimentVariantOverrides;
  metrics: ABExperimentMetrics;
}

export interface PersonaPreviewContext {
  personaType: 'anonymous' | 'decision_maker' | 'high_intent_lead' | 'customer';
  contactName: string;
  contactEmail: string;
  companyName: string;
  engagementScore: number;
  dealStage: string;
  watchedChapterIds: string[];
  contactTagIds: string[];
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
  dynamicCtaRules?: DynamicCtaRule[];
  personalization?: PersonalizationConfig;
  recommendations?: ContentRecommendation;
  abExperiment?: ABExperimentConfig;
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

export interface TranscriptCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
}

export interface MediaTranscript {
  id: string;
  assetId: string;
  versionId?: string;
  language: string;
  cues: TranscriptCue[];
  fullText: string;
  confidenceScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediaChapter {
  id: string;
  assetId: string;
  title: string;
  startTime: number;
  endTime: number;
  summary?: string;
  thumbnailUrl?: string;
  order: number;
}

export interface MediaContentIntelligence {
  id: string;
  workspaceId: string;
  assetId: string;
  summary: string;
  keyTakeaways: string[];
  topics: string[];
  entities: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  vectorIndexed: boolean;
  qdrantPointId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SemanticSearchHit {
  assetId: string;
  assetName: string;
  mediaType: MediaAsset['type'];
  cueText: string;
  startTime: number;
  relevanceScore: number;
  jumpUrl: string;
}

export interface IntelligenceGovernanceConfig {
  sttProvider: 'gemini' | 'whisper' | 'local';
  autoTranscribeUploads: boolean;
  minConfidenceThreshold: number;
  autoExtractChapters: boolean;
  autoVectorIndex: boolean;
  qdrantCollectionName: string;
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
  intelligenceConfig?: IntelligenceGovernanceConfig;
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
    transcriptId?: string;
    hasChapters?: boolean;
    vectorPointId?: string;
  };
}

export interface MediaActivitySummary {
  shareId: string;
  assetId: string;
  assetTitle: string;
  mediaType: MediaAsset['type'];
  viewCount: number;
  totalDurationSeconds: number;
  watchedDurationSeconds: number;
  maxCompletionPercent: number;
  ctaClickedCount: number;
  downloadCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface MediaEngagementMetrics {
  totalViews: number;
  totalSessions: number;
  totalTimeSeconds: number;
  avgCompletionPercent: number;
  totalCtaClicks: number;
  totalDownloads: number;
  overallScore: number; // 0 - 100 engagement score
}

export interface ContactMediaProfile {
  contactId: string;
  workspaceId: string;
  metrics: MediaEngagementMetrics;
  activities: MediaActivitySummary[];
  preferredFormat: MediaAsset['type'] | 'balanced';
  highIntentSignalsCount: number;
  lastActiveAt?: string;
}

export interface DealMediaSignals {
  dealId: string;
  workspaceId: string;
  combinedEngagementScore: number;
  associatedContactsCount: number;
  stakeholdersWithActivityCount: number;
  topEngagedAssetTitle?: string;
  hasHighIntentProposalViews: boolean;
  hasCompletedVideoViews: boolean;
  hasCtaInteractions: boolean;
  suggestedHealthMultiplier: number; // e.g. 1.25 multiplier for deal score
  lastActivityAt?: string;
}

// ==========================================
// PHASE 6: ANALYTICS & ATTRIBUTION DOMAIN MODELS
// ==========================================

export type AttributionType = 
  | 'TOUCHED'
  | 'ENGAGED'
  | 'ASSISTED'
  | 'INFLUENCED'
  | 'CONVERTED_AFTER_EXPOSURE';

export type AttributionModelType = 
  | 'FIRST_TOUCH'
  | 'LAST_TOUCH'
  | 'LINEAR'
  | 'TIME_DECAY'
  | 'POSITION_BASED';

export interface EvidenceReference {
  eventId?: string;
  sessionId?: string;
  timestamp: string;
  type: string;
  progressPercent?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface MediaAttribution {
  id: string;
  workspaceId: string;
  assetId: string;
  assetTitle?: string;
  assetType?: MediaAsset['type'];
  experienceId?: string;
  linkId?: string;
  contactId?: string;
  contactName?: string;
  dealId?: string;
  dealTitle?: string;
  dealAmount?: number;
  dealCurrency?: string;
  dealStage?: string;
  isClosedWon?: boolean;
  campaignId?: string;
  attributionType: AttributionType;
  model: AttributionModelType;
  weight: number; // 0.0 to 1.0 (Sum of weights for a deal strictly = 1.0)
  attributedRevenue: number; // weight * dealAmount
  evidence: EvidenceReference[];
  createdAt: string;
  updatedAt: string;
}

export interface TopInfluencingAsset {
  assetId: string;
  title: string;
  type: MediaAsset['type'];
  viewsCount: number;
  completionRate: number;
  influencedDealsCount: number;
  attributedRevenue: number;
  topAttributionType: AttributionType;
}

export interface MediaFunnelMetrics {
  views: number;
  plays: number;
  halfway: number;
  completions: number;
  ctaClicks: number;
  dealsCreated: number;
  dealsWon: number;
}

export interface MediaInfluenceSummary {
  workspaceId: string;
  totalAssetsCount: number;
  totalExperiencesCount: number;
  totalViewsCount: number;
  totalUniqueContactsCount: number;
  avgEngagementRate: number; // e.g. 67.4%
  avgCtaConversionRate: number; // e.g. 14.2%
  totalPipelineInfluenced: number; // sum of open deals touched
  totalInfluencedRevenue: number; // sum of closed won deals touched
  influencedDealsCount: number;
  totalDealsCount: number;
  avgDealAccelerationDays: number; // days saved compared to deals without media
  attributionModel: AttributionModelType;
  lookbackDays: number;
  currencySymbol: string;
  funnel: MediaFunnelMetrics;
  topInfluencingAssets: TopInfluencingAsset[];
}

export interface DealAttributionAssetItem {
  assetId: string;
  title: string;
  type: MediaAsset['type'];
  weight: number; // e.g. 0.31 (31%)
  attributedAmount: number;
  attributionType: AttributionType;
  firstTouchAt: string;
  lastTouchAt: string;
}

export interface DealAttributionBreakdown {
  dealId: string;
  dealTitle: string;
  dealAmount: number;
  currencySymbol: string;
  isClosedWon: boolean;
  totalInfluencedAssetsCount: number;
  items: DealAttributionAssetItem[];
}

export interface AttributionGovernanceConfig {
  workspaceId: string;
  defaultModel: AttributionModelType;
  defaultLookbackDays: number; // 14, 30, 60, 90, 180
  minEngagementProgressPercent: number; // default 50%
  enableDealAccelerationMetrics: boolean;
  currencySymbol: string; // e.g. "GH₵" or "$"
  updatedAt: string;
}

// ==========================================
// PHASE 7: MEDIA COPILOT & AI REPURPOSING DOMAIN MODELS
// ==========================================

export type CopilotPersonaType = 
  | 'LIBRARIAN'
  | 'ANALYST'
  | 'STRATEGIST'
  | 'REPURPOSER'
  | 'CRM_INTELLIGENCE'
  | 'OPTIMIZER';

export type DerivativeType = 
  | 'SUMMARY'
  | 'FAQ'
  | 'EMAIL_OUTREACH'
  | 'SOCIAL_SNIPPETS'
  | 'SHORT_CLIPS'
  | 'QUOTE_CARDS'
  | 'SALES_BRIEF';

export interface MediaDerivative {
  id: string;
  workspaceId: string;
  sourceAssetId: string;
  sourceVersionId?: string;
  sourceTitle: string;
  sourceType: MediaAsset['type'];
  type: DerivativeType;
  title: string;
  content: string; // Markdown or formatted text
  structuredPayload?: Record<string, string | number | boolean | string[] | Array<{ question: string; answer: string }> | Array<{ startSeconds: number; endSeconds: number; hook: string }>>;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CopilotSuggestedAction {
  label: string;
  action: string;
  payload?: Record<string, string | number>;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  persona: CopilotPersonaType;
  content: string;
  timestamp: string;
  suggestedActions?: CopilotSuggestedAction[];
  referencedAssetIds?: string[];
  referencedDealIds?: string[];
  referencedContactIds?: string[];
}

export interface CopilotSession {
  id: string;
  workspaceId: string;
  contextType: 'global' | 'asset' | 'deal' | 'contact' | 'analytics';
  contextId?: string;
  activePersona: CopilotPersonaType;
  messages: CopilotMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface CopilotGovernanceConfig {
  workspaceId: string;
  enabledPersonas: CopilotPersonaType[];
  maxTokensPerPrompt: number;
  defaultPersona: CopilotPersonaType;
  repurposingEnabled: boolean;
  temperature: number;
  allowedDerivativeTypes: DerivativeType[];
  updatedAt: string;
}

// --- Phase 8: Predictive Optimization & Autonomous Experiments ---

export type ExperimentType =
  | 'AB_TEST'
  | 'MULTI_ARMED_BANDIT'
  | 'TITLE_OPTIMIZATION'
  | 'GATE_THRESHOLD'
  | 'THUMBNAIL_TEST';

export type BanditAlgorithm =
  | 'EPSILON_GREEDY'
  | 'THOMPSON_SAMPLING'
  | 'STATIC_SPLIT';

export type ExperimentStatus =
  | 'DRAFT'
  | 'RUNNING'
  | 'PAUSED'
  | 'CONCLUDED'
  | 'AUTO_PROMOTED';

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number; // 0 to 100 (% of traffic)
  overrides: ABExperimentVariantOverrides;
  impressions: number;
  conversions: number;
  conversionRate: number; // conversions / impressions
  valueSum: number; // Total revenue or value generated by variant
  isControl: boolean;
  isWinner: boolean;
}

export interface MediaExperiment {
  id: string;
  workspaceId: string;
  experienceId: string;
  assetId: string;
  name: string;
  type: ExperimentType;
  algorithm: BanditAlgorithm;
  status: ExperimentStatus;
  variants: ExperimentVariant[];
  winnerVariantId?: string;
  confidenceScore: number; // 0.0 to 100.0%
  pValue: number; // e.g. 0.024
  minSampleSize: number; // minimum impressions before evaluating winner (e.g. 100)
  autoPromoteWinner: boolean;
  createdAt: string;
  updatedAt: string;
  concludedAt?: string;
}

export interface PredictiveEngagementScore {
  assetId: string;
  predictedCompletionRate: number; // e.g. 68.5%
  predictedDropOffSecond: number; // e.g. 142s
  conversionLikelihoodPercent: number; // e.g. 24.1%
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  churnRisk: 'LOW' | 'MODERATE' | 'CRITICAL';
  recommendedAction: string;
}

export interface PredictiveDealForecast {
  dealId: string;
  currentCloseProbability: number; // e.g. 35%
  projectedCloseProbabilityWithMedia: number; // e.g. 62%
  winProbabilityBoostPercent: number; // e.g. +27%
  velocityAccelerationDays: number; // e.g. 11 days faster
  recommendedNextAssetIds: string[];
  stakeholderCoveragePercent: number; // e.g. 66% (2 of 3 stakeholders engaged)
}

export interface ContentDecayMetric {
  assetId: string;
  title: string;
  type: MediaAsset['type'];
  currentVelocity30d: number; // views in last 30d
  priorVelocity30d: number; // views in prior 30d (day 31-60)
  decayRatePercent: number; // e.g. -35%
  healthStatus: 'HEALTHY' | 'STABLE' | 'DECAYING' | 'SUNSET_RECOMMENDED';
  lastActiveDate: string;
  refreshActionRecommendation: string;
}

export interface ContentRecommendationItem {
  assetId: string;
  title: string;
  type: MediaAsset['type'];
  previewImageUrl?: string;
  matchScore: number; // 0 to 100%
  rationale: string;
  stageRelevance?: string;
}

export interface OptimizationGovernanceConfig {
  workspaceId: string;
  autoExperimentPromotion: boolean;
  minConfidenceThreshold: number; // e.g. 0.95 (95%)
  decayDetectionThresholdPercent: number; // e.g. 25 (%)
  banditExplorationRate: number; // e.g. 0.10 (10% epsilon)
  nextBestContentLimit: number; // default 4
  updatedAt: string;
}



