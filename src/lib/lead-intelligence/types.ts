/**
 * Core Data Models & Strictly Typed Interfaces for Lead Intelligence 2.0 (Phase 1)
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Strict Typing Protocol: No `any` or `any[]` is permitted in this module.
 * 2. Backward Compatibility: All existing fields on Prospect, WebsiteScanResults, and ProspectScoring are preserved.
 * 3. Identity & Provenance: New fields enable tracking data origins and multi-factor entity deduplication.
 */

export type DiscoverySourceType = 
  | 'google_places' 
  | 'ai_simulation' 
  | 'csv_import' 
  | 'web_crawl' 
  | 'crm_internal';

export interface WebsiteScanResults {
  url?: string;
  scannedAt: string;
  technologies: string[];
  sslValid: boolean;
  sslExpiresAt?: string;
  loadTimeMs?: number;
  metaTitle?: string;
  metaDescription?: string;
  hasFacebook: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
  hasTwitter: boolean;
  hasWhatsApp?: boolean;
  brokenLinks?: string[];
}

export type EmailVerificationStatus = 'verified' | 'risky' | 'invalid' | 'unverified' | 'unknown';

export interface ProspectContact {
  name: string;
  email: string;
  phone?: string;
  role?: string;
  confidence: number; // 0 - 100
  verificationStatus: EmailVerificationStatus;
  deliverabilityScore?: number; // 0 - 100
  mxProvider?: string;
  lastVerifiedAt?: string;
}

export interface ProspectScoring {
  overallScore: number; // 0 - 100
  needScore: number;
  digitalMaturity: number;
  buyingIntent: number;
  budgetProbability: number;
  decisionMakerFound: number;
  engagement: number;
  priorityTier?: 'critical' | 'high' | 'medium' | 'low';
  explainableBreakdown?: ExplainableScoreBreakdown;
}

export interface ObjectionAnswer {
  objection: string;
  counter: string;
}

export interface ProspectAIInsights {
  summary: string;
  problemsFound: string[];
  opportunities: string[];
  suggestedProducts: string[];
  estimatedRevenueOpportunity: number; // annual value in USD
  recommendedPitch: string;
  objectionsAnswered: ObjectionAnswer[];
}

export interface ProvenanceRecord {
  field: string;
  source: DiscoverySourceType | string;
  confidence: number; // 0 - 100
  observedAt: string;
  retrievedAt?: string;
}

export interface Prospect {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  domain: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewsCount?: number;
  claimed?: boolean;
  industry?: string;
  location?: { lat: number; lng: number };
  websiteScan?: WebsiteScanResults;
  contacts: ProspectContact[];
  scoring: ProspectScoring;
  aiInsights?: ProspectAIInsights;
  researchDossier?: AIResearchDossier;
  activeSignalsCount?: number;
  monitoringConfig?: AccountMonitoringConfig;
  provenance?: ProvenanceRecord[];
  source?: DiscoverySourceType;
  listIds?: string[];
  syncStatus: 'unregistered' | 'synced';
  syncedEntityId?: string;
  crmStatus?: CRMMatchStatus;
  crmMatch?: CRMMatchCandidate;
  ownerName?: string;
  stageName?: string;
  lastActivityAt?: string;
  assignedRepId?: string;
  assignedRepName?: string;
  predictiveConversion?: PredictiveConversionLikelihood;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectActivity {
  id: string;
  prospectId: string;
  workspaceId: string;
  type: 'log_call' | 'send_email' | 'add_note' | 'generate_proposal' | 'create_deal';
  userId: string;
  userName: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface SearchFilters {
  country?: string;
  city?: string;
  industry?: string;
  radius?: number;
  technologies?: string[];
  claimed?: boolean;
  ratingMin?: number;
  scoreMin?: number;
  syncedStatus?: 'all' | 'unregistered' | 'synced';
}

export interface DiscoveryQuery {
  organizationId: string;
  workspaceId: string;
  queryText: string;
  filters: SearchFilters;
  sourceType?: DiscoverySourceType;
  limit?: number;
}

export interface SavedSearch {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  filters: SearchFilters;
  prospectsCount: number;
  createdAt: string;
}

export interface LeadList {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  description?: string;
  prospectIds: string[];
  prospectsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface IdentityMatchResult {
  isMatch: boolean;
  confidence: number; // 0.0 to 1.0
  matchReason: string;
  matchedEntityId?: string;
  matchedEntityName?: string;
}

export interface NaturalLanguageQueryResult {
  parsedFilters: SearchFilters;
  extractedKeywords: string;
  confidence: number;
  explanation: string;
}

export interface EnrichmentJob {
  id: string;
  organizationId: string;
  workspaceId: string;
  type: 'search' | 'website_scan' | 'enrich';
  status: 'pending' | 'running' | 'completed' | 'failed';
  params: Record<string, unknown>;
  resultsCount?: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export type JobStatus = 'running' | 'completed' | 'failed' | 'paused';
export type JobType = 'discovery' | 'batch_enrich' | 'batch_sync' | 'csv_import';

export interface IntelligenceJob {
  id: string;
  workspaceId: string;
  type: JobType;
  title: string;
  status: JobStatus;
  progressPercent: number;
  foundCount: number;
  uniqueCount: number;
  duplicateCount: number;
  errorCount: number;
  startedAt: string;
  completedAt?: string;
  errorDetails?: string[];
}

export type TableDensityMode = 'compact' | 'standard' | 'comfortable';

export type DiscoveryViewMode = 'table' | 'cards' | 'map';

export interface ColumnVisibilityConfig {
  company: boolean;
  location: boolean;
  rating: boolean;
  techFootprint: boolean;
  smartScore: boolean;
  crmStatus: boolean;
  contacts: boolean;
  domain: boolean;
  phone: boolean;
}

export interface SavedViewConfig {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  densityMode: TableDensityMode;
  viewMode: DiscoveryViewMode;
  columns: ColumnVisibilityConfig;
  filters: SearchFilters;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentGatewaySignature {
  provider: 'paystack' | 'flutterwave' | 'stripe' | 'hubtel' | 'woocommerce' | 'shopify' | 'magento' | 'mtn_momo' | 'other';
  confidence: number;
  snippet?: string;
}

export interface ScrapedMetadata {
  title?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogImage?: string;
  socialLinks: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
  };
  detectedEmails: string[];
  detectedPhones: string[];
  paymentSignatures: PaymentGatewaySignature[];
  hasOnlinePayment: boolean;
  scannedAt: string;
}

export interface WaterfallStepLog {
  stage: 'email' | 'technographics' | 'firmographics' | 'ai_synthesis';
  provider: 'hunter' | 'apollo' | 'builtwith' | 'dom_scraper' | 'gemini_genkit' | 'claude_fallback';
  status: 'hit' | 'miss' | 'timeout' | 'error';
  latencyMs: number;
  matchCount: number;
  error?: string;
}

export interface WaterfallEnrichmentResult {
  prospect: Prospect;
  steps: WaterfallStepLog[];
  totalCreditsUsed: number;
  totalDurationMs: number;
}

export interface LeadIntelligenceSettings {
  googlePlacesApiKey?: string;
  builtwithApiKey?: string;
  hunterApiKey?: string;
  apolloApiKey?: string;
  clearbitApiKey?: string;
  chromeExtensionToken?: string;
  waterfallEnabled?: boolean;
  autoMergeConfidenceThreshold?: number; // Defaults to 0.95
}

// =============================================================================
// PHASE 3: IDENTITY RESOLUTION & MERGE STUDIO INTERFACES (Strict Typing)
// =============================================================================

export type CollisionStatus = 'pending_review' | 'merged' | 'kept_separate' | 'dismissed';
export type MergeFieldChoice = 'record_a' | 'record_b' | 'custom';
export type MergeArrayStrategy = 'combine' | 'record_a_only' | 'record_b_only';

export interface MergeFieldSelection {
  nameChoice: MergeFieldChoice;
  customName?: string;
  domainChoice: MergeFieldChoice;
  customDomain?: string;
  phoneChoice: MergeFieldChoice;
  customPhone?: string;
  addressChoice: MergeFieldChoice;
  customAddress?: string;
  technologiesStrategy: MergeArrayStrategy;
  contactsStrategy: MergeArrayStrategy;
  selectedContactEmails?: string[];
}

export interface IdentityCollisionRecord {
  id: string;
  workspaceId: string;
  prospectId: string;
  prospect: Prospect;
  entityId: string;
  existingEntityName: string;
  existingEntityDomain?: string;
  existingEntityPhone?: string;
  existingEntityLocation?: string;
  existingEntityContactsCount: number;
  matchConfidence: number;
  matchReasons: string[];
  matchType: 'exact_domain' | 'exact_phone' | 'fuzzy_name' | 'composite';
  status: CollisionStatus;
  detectedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface CanonicalMergePayload {
  collisionId: string;
  prospectId: string;
  entityId: string;
  fieldSelection: MergeFieldSelection;
  notes?: string;
}

export interface MergeExecutionResult {
  success: boolean;
  entityId: string;
  mergedContactsCount: number;
  mergedTechnologiesCount: number;
  message?: string;
  error?: string;
}

// =============================================================================
// PHASE 4: DEEP TECHNOGRAPHICS & ENRICHMENT PANELS (Strict Typing)
// =============================================================================

export type TechnographicCategory = 
  | 'cms' 
  | 'payment' 
  | 'portal' 
  | 'communication' 
  | 'analytics' 
  | 'hosting' 
  | 'framework' 
  | 'other';

export interface TechnographicSignature {
  name: string;
  category: TechnographicCategory;
  confidence: number;
  iconKey?: string;
  description?: string;
}

export interface SubdomainProbeResult {
  subdomain: string;
  fullUrl: string;
  status: 'online' | 'unreachable' | 'redirect' | 'auth_required';
  httpStatus?: number;
  title?: string;
  portalType?: 'student_portal' | 'admissions' | 'lms_moodle' | 'fee_payment' | 'generic_login';
  latencyMs: number;
  detectedAt: string;
}

export interface CategorizedTechStack {
  cms: string[];
  payments: string[];
  portals: SubdomainProbeResult[];
  communication: string[];
  analytics: string[];
  paymentGapDetected: boolean;
  missingPortalDetected: boolean;
}

export interface EnrichmentDimensionScore {
  companyScore: number; // 0 - 100
  techScore: number; // 0 - 100
  contactsScore: number; // 0 - 100
  verificationScore: number; // 0 - 100
  overallEnrichmentPercent: number; // 0 - 100
}

// =============================================================================
// PHASE 5: REAL-TIME EMAIL & DELIVERABILITY VERIFICATION (Strict Typing)
// =============================================================================

export type MXProviderType = 
  | 'google_workspace' 
  | 'microsoft_365' 
  | 'zoho' 
  | 'protonmail' 
  | 'cpanel_custom' 
  | 'unknown';

export interface VerificationStageResult {
  stage: 'syntax' | 'disposable' | 'dns_mx' | 'smtp_handshake' | 'catch_all';
  passed: boolean;
  details: string;
  latencyMs?: number;
}

export interface EmailDeliverabilityResult {
  email: string;
  status: EmailVerificationStatus;
  deliverabilityScore: number; // 0 - 100
  isRoleBased: boolean;
  isDisposable: boolean;
  hasMxRecord: boolean;
  primaryMxHost?: string;
  mxProvider: MXProviderType;
  smtpHandshakeCode?: number;
  isCatchAll: boolean;
  stages: VerificationStageResult[];
  verifiedAt: string;
  recommendation: string;
}

// =============================================================================
// PHASE 6: AI RESEARCH DOSSIER, DEEP BRIEFS & EVIDENCE LAYER (Strict Typing)
// =============================================================================

export interface CommercialPackaging {
  recommendedTier: string;
  estimatedAnnualValue: number; // in USD
  urgency: 'critical' | 'high' | 'medium' | 'low';
  targetProductModules: string[];
  pricingRationale: string;
}

export interface PainPointAnalysisItem {
  problem: string;
  businessImpact: string;
  smartSappSolution: string;
  evidenceCitation: string;
}

export interface OutreachPlaybookItem {
  channel: 'email' | 'whatsapp' | 'phone_script';
  headline: string;
  scriptOrMessage: string;
  targetContactName?: string;
  keyTalkingPoints: string[];
}

export interface EvidenceGroundingItem {
  claim: string;
  observedSource: string;
  observedAt: string;
  confidencePercent: number; // 0 - 100
  sourceUrl?: string;
  sourceType: 'website_scan' | 'subdomain_probe' | 'builtwith' | 'email_verifier' | 'places_api';
}

export interface AIResearchDossier {
  prospectId: string;
  prospectName: string;
  domain: string;
  executiveSummary: string;
  icpFitScore: number; // 0 - 100 (UI Spec Section 26)
  intentScore: number; // 0 - 100
  priorityScore: number; // 0 - 100
  digitalMaturityScore: number; // 0 - 100
  commercialPackaging: CommercialPackaging;
  painPoints: PainPointAnalysisItem[];
  outreachPlaybook: OutreachPlaybookItem[];
  evidenceGrounding: EvidenceGroundingItem[];
  researchedAt: string;
  modelEngine: string;
}

// =============================================================================
// PHASE 7: LIVE CONTINUOUS SIGNALS & DELTA MONITORING (Strict Typing)
// =============================================================================

export type LeadSignalType =
  | 'payment_gap_detected'
  | 'payment_gateway_added'
  | 'payment_gateway_removed'
  | 'subdomain_portal_detected'
  | 'subdomain_portal_removed'
  | 'cms_changed'
  | 'ssl_expiring'
  | 'ssl_renewed'
  | 'new_decision_maker'
  | 'contact_email_verified'
  | 'contact_email_invalid'
  | 'review_spike_negative'
  | 'high_intent_surge'
  | 'crm_interaction';

export type LeadSignalCategory =
  | 'intent'
  | 'technographic'
  | 'firmographic'
  | 'leadership'
  | 'compliance'
  | 'engagement';

export type LeadSignalStrength = 'critical' | 'high' | 'medium' | 'low';

export interface LeadSignal {
  id: string;
  workspaceId: string;
  prospectId: string;
  prospectName: string;
  prospectDomain: string;
  type: LeadSignalType;
  category: LeadSignalCategory;
  title: string;
  headline: string;
  description: string;
  strength: LeadSignalStrength;
  confidence: number; // 0 - 100
  scoreImpact: number; // -25 to +35
  previousValue?: string;
  currentValue?: string;
  potentialImplication: string;
  recommendedAction: string;
  detectedAt: string;
  source: string;
  isRead?: boolean;
  isDismissed?: boolean;
}

export interface AccountMonitoringConfig {
  prospectId: string;
  workspaceId: string;
  status: 'healthy' | 'warning' | 'paused';
  frequency: 'daily' | 'weekly' | 'monthly';
  monitorWebsite: boolean;
  monitorTechnology: boolean;
  monitorDecisionMakers: boolean;
  monitorBusinessChanges: boolean;
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifyWhatsApp: boolean;
  lastScannedAt?: string;
  changesDetectedCount: number;
  activeAlertsCount: number;
  updatedAt: string;
}

// --- Phase 8: Explainable Scoring & Simulation Models ---

export interface ScoringDimensionWeightConfig {
  icpFitWeight: number; // e.g. 30 (%)
  intentWeight: number; // e.g. 25 (%)
  needWeight: number; // e.g. 20 (%)
  engagementWeight: number; // e.g. 15 (%)
  similarityWeight: number; // e.g. 10 (%)
}

export interface ExplainableScoreBreakdown {
  overallScore: number; // 0 - 100
  priorityTier: 'critical' | 'high' | 'medium' | 'low';
  icpFitPoints: number; // e.g. +24
  needPoints: number; // e.g. +21
  intentPoints: number; // e.g. +18
  engagementPoints: number; // e.g. +12
  similarityPoints: number; // e.g. +10
  recencyPoints: number; // e.g. +6
  topPositiveDrivers: string[];
  topNegativeDrivers: string[];
  harmonicPriority: number; // 0 - 100
  calculatedAt: string;
}

export interface ScoreMovementEvent {
  id: string;
  prospectId: string;
  workspaceId: string;
  timestamp: string;
  oldScore: number;
  newScore: number;
  change: number; // e.g. +15, -10
  category: LeadSignalCategory | 'firmographic' | 'verification' | 'manual';
  reason: string;
  sourceSignalId?: string;
}

export interface ScoringModelConfig {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  isDefault: boolean;
  weights: ScoringDimensionWeightConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ScoringSimulationResult {
  prospectId: string;
  prospectName: string;
  domain: string;
  baselineScore: number;
  simulatedScore: number;
  deltaScore: number;
  baselineTier: 'critical' | 'high' | 'medium' | 'low';
  simulatedTier: 'critical' | 'high' | 'medium' | 'low';
  breakdown: ExplainableScoreBreakdown;
}

// --- Phase 9: CRM Intelligence, Match Studio & Unified Activity Timeline ---

export type CRMMatchStatus = 'not_in_crm' | 'synced' | 'match_candidate';

export interface CRMMatchCandidate {
  entityId: string;
  entityName: string;
  entityType: string;
  matchScore: number; // 0 - 100
  matchedBy: 'domain' | 'name' | 'phone' | 'email';
  matchReason: string;
  ownerName?: string;
  ownerEmail?: string;
  stageName?: string;
  stageColor?: string;
  lastActivityAt?: string;
  contactsCount: number;
  entityUrl: string;
}

export interface CRMEnrichmentMergePayload {
  prospectId: string;
  targetEntityId: string;
  mergeContacts: boolean;
  mergeTechnographics: boolean;
  updateScore: boolean;
  tagsToAdd?: string[];
}

export interface UnifiedActivityItem {
  id: string;
  timestamp: string;
  source: 'intelligence' | 'crm' | 'signals' | 'ai' | 'deals' | 'messaging';
  type: string;
  title: string;
  description: string;
  actorName?: string;
  iconType: 'flame' | 'sparkles' | 'globe' | 'mail' | 'briefcase' | 'user_plus' | 'activity' | 'phone' | 'check';
  metadata?: Record<string, string | number | boolean>;
}

// =============================================================================
// PHASE 10: DYNAMIC LISTS, VISUAL SEGMENTS & PROSPECTING CAMPAIGNS (Strict Typing)
// =============================================================================

export type SegmentPredicateField =
  | 'overallScore'
  | 'needScore'
  | 'buyingIntent'
  | 'icpFitScore'
  | 'crmStatus'
  | 'industry'
  | 'city'
  | 'country'
  | 'hasVerifiedContact'
  | 'technologies'
  | 'signals';

export type SegmentOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'is_true'
  | 'is_false';

export interface SegmentRule {
  id: string;
  field: SegmentPredicateField;
  operator: SegmentOperator;
  value: string | number | boolean | string[];
}

export interface SegmentRuleGroup {
  id: string;
  combinator: 'AND' | 'OR';
  rules: Array<SegmentRule | SegmentRuleGroup>;
}

export interface DynamicSegment {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  description: string;
  icon?: string;
  ruleGroup: SegmentRuleGroup;
  cachedCount?: number;
  isTemplate?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectingCampaignTargetCriteria {
  region?: string;
  industry?: string;
  minRating?: number;
  sourceType: 'places' | 'list' | 'all_discovered';
  sourceListId?: string;
}

export interface ProspectingCampaignEnrichmentOptions {
  runWebScan: boolean;
  extractDecisionMakers: boolean;
  verifyEmails: boolean;
  generateAIDossier: boolean;
}

export interface ProspectingCampaignActivationOptions {
  createDeals: boolean;
  pipelineId?: string;
  stageId?: string;
  enrollInCadence: boolean;
  channel: 'email' | 'whatsapp' | 'call_script';
}

export interface ProspectingCampaignStats {
  totalProspects: number;
  enrichedCount: number;
  verifiedCount: number;
  qualifiedCount: number;
  dealsCreated: number;
  outreachSent: number;
}

export interface ProspectingCampaign {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  status: 'draft' | 'running' | 'completed' | 'paused';
  targetCriteria: ProspectingCampaignTargetCriteria;
  enrichmentOptions: ProspectingCampaignEnrichmentOptions;
  qualificationThreshold: number; // minimum priority score (e.g. 75)
  assignment: {
    type: 'round_robin' | 'specific_rep' | 'unassigned';
    repIds: string[];
  };
  activation: ProspectingCampaignActivationOptions;
  stats: ProspectingCampaignStats;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// PHASE 11: REVENUE ATTRIBUTION, CONVERSION VELOCITY & REPORTING (Strict Typing)
// =============================================================================

export interface ExecutiveAttributionSummary {
  pipelineGenerated: number;
  qualifiedLeads: number;
  opportunitiesCount: number;
  wonDealsCount: number;
  totalRevenue: number;
  avgSalesCycleDays: number;
  currency: string;
  winRatePercent: number;
}

export interface SourcePerformanceMetric {
  source: DiscoverySourceType;
  sourceLabel: string;
  leadsCount: number;
  qualifiedCount: number;
  oppsCount: number;
  wonCount: number;
  revenue: number;
  conversionRate: number; // in percent (0 - 100)
}

export interface ProviderPerformanceMetric {
  providerName: string;
  totalRequests: number;
  successfulRequests: number;
  successRate: number; // in percent (0 - 100)
  creditsUsed: number;
  costPerValidContact: number;
  avgLatencyMs: number;
}

export interface DataQualityRemediationSuggestion {
  id: string;
  type: 'verify_emails' | 'enrich_stale' | 'resolve_collisions';
  title: string;
  description: string;
  actionLabel: string;
  affectedCount: number;
}

export interface DataQualityAudit {
  completenessScore: number; // 0 - 100
  accuracyScore: number;
  freshnessScore: number;
  uniquenessScore: number;
  verificationScore: number;
  overallScore: number;
  remediationSuggestions: DataQualityRemediationSuggestion[];
}

export interface TerritoryIntelligenceMetric {
  region: string;
  prospectsCount: number;
  qualifiedCount: number;
  highIntentCount: number;
  penetrationRate: number; // in percent (0 - 100)
}

export interface RevenueAttributionReport {
  summary: ExecutiveAttributionSummary;
  sources: SourcePerformanceMetric[];
  providers: ProviderPerformanceMetric[];
  dataQuality: DataQualityAudit;
  territories: TerritoryIntelligenceMetric[];
  generatedAt: string;
}

// =============================================================================
// PHASE 12: AUTONOMOUS AI SDR & MULTI-CHANNEL ACTIVATION (Strict Typing)
// =============================================================================

export type ActivationActionType = 
  | 'create_task' 
  | 'create_deal' 
  | 'send_email' 
  | 'enroll_whatsapp' 
  | 'book_followup';

export interface ActivationRecommendationItem {
  id: string;
  type: ActivationActionType;
  title: string;
  description: string;
  rationale: string;
  isRecommended: boolean;
  enabled: boolean;
}

export interface DailyRepBriefing {
  repId: string;
  repName: string;
  date: string;
  totalNeedingAttention: number;
  highIntentCount: number;
  scoreIncreasedCount: number;
  followupsDueCount: number;
  winnerLookalikeCount: number;
  priorityProspectIds: string[];
}

export interface PriorityQueueItem {
  prospect: Prospect;
  whyNowReason: string;
  recommendedPlaybook: OutreachPlaybookItem | null;
  suggestedChannel: 'email' | 'whatsapp' | 'phone';
  urgencyScore: number;
}

export interface AIOutreachDraft {
  channel: 'email' | 'whatsapp' | 'phone_script';
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  subject?: string;
  body: string;
  whatsappUrl?: string;
  mailtoUrl?: string;
  groundingPoints: string[];
  status: 'draft' | 'approved' | 'sent';
}

// =============================================================================
// PHASE 13: PREDICTIVE CONVERSION PROBABILITY & OPERATIONAL INBOX (Strict Typing)
// =============================================================================

export interface PredictiveConversionLikelihood {
  meetingProbability: number; // 0 - 100
  opportunityProbability: number; // 0 - 100
  closeProbability: number; // 0 - 100
  expectedACV: number;
  currency: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  topDrivers: string[];
  calculatedAt: string;
}

export type IntelligenceInboxCategory = 
  | 'all' 
  | 'high_intent' 
  | 'score_changes' 
  | 'new_decision_makers' 
  | 'duplicates' 
  | 'verification_issues' 
  | 'crm_matches' 
  | 'ai_recommendations';

export interface IntelligenceInboxItem {
  id: string;
  workspaceId: string;
  prospectId: string;
  prospectName: string;
  domain: string;
  category: IntelligenceInboxCategory;
  title: string;
  description: string;
  timestamp: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  isRead: boolean;
  isDismissed: boolean;
  actionType?: 'activate' | 'review_collision' | 'resolve_crm' | 'verify_email' | 'view_signals';
  metadata?: Record<string, unknown>;
}

export interface InboxSummaryStats {
  totalUnread: number;
  highIntentCount: number;
  scoreChangeCount: number;
  decisionMakerCount: number;
  collisionCount: number;
  verificationIssueCount: number;
  crmMatchCount: number;
  aiRecommendationCount: number;
}

// =============================================================================
// PHASE 14: ENTERPRISE GOVERNANCE, TERRITORY & HEALTH MONITORS (Strict Typing)
// =============================================================================

export type ProviderId = 'google_places' | 'hunter' | 'builtwith' | 'email_verifier' | 'gemini_dossier';

export interface ProviderHealthRecord {
  providerId: ProviderId;
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'disconnected';
  connected: boolean;
  latencyMs: number;
  successRate: number; // 0 - 100
  monthlyQuota: number;
  monthlyUsed: number;
  costPerCall: number; // Credits
  lastError?: string;
  lastCheckedAt: string;
}

export interface ProviderRoutingRule {
  channel: 'email' | 'technographics' | 'firmographics';
  priorityProviders: ProviderId[];
  fallbackEnabled: boolean;
  maxCreditsPerRecord: number;
}

export interface TerritoryRule {
  id: string;
  name: string;
  region: string;
  assignedRepIds: string[];
  autoAssign: boolean;
  minScore: number;
  targetIndustry?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseGovernanceConfig {
  workspaceId: string;
  organizationId: string;
  discovery: {
    defaultRadiusKm: number;
    defaultCity: string;
    rateLimitRps: number;
  };
  enrichment: {
    cacheTtlDays: number;
    routingRules: ProviderRoutingRule[];
  };
  verification: {
    enforceDisposableBlock: boolean;
    smtpTimeoutMs: number;
    catchAllRiskThreshold: number;
  };
  scoring: {
    autoRescoreOnSignal: boolean;
    defaultModelId: string;
  };
  credits: {
    monthlyBudget: number;
    warningThresholdPercent: number;
    enforceHardCap: boolean;
  };
  territoryRules: TerritoryRule[];
  compliance: {
    retentionDays: number;
    dpaConsentRequired: boolean;
    autoAnonymizeUnclaimed: boolean;
  };
  updatedAt: string;
  updatedBy?: string;
}

export interface CreditLedgerSummary {
  totalAllocated: number;
  used: number;
  remaining: number;
  discoveryUsed: number;
  enrichmentUsed: number;
  aiUsed: number;
  verificationUsed: number;
  warningTriggered: boolean;
  resetDate: string;
}

export interface DataImportColumnMapping {
  name: string;
  domain?: string;
  phone?: string;
  address?: string;
  industry?: string;
  contactName?: string;
  contactEmail?: string;
  contactRole?: string;
}

export interface DataImportValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  errors: { row: number; field: string; message: string }[];
}






