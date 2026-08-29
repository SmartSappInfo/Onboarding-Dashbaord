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
  brokenLinks?: string[];
}

export interface ProspectContact {
  name: string;
  email: string;
  phone?: string;
  role?: string;
  confidence: number; // 0 - 100
  verificationStatus: 'verified' | 'unverified' | 'unknown';
}

export interface ProspectScoring {
  overallScore: number; // 0 - 100
  needScore: number;
  digitalMaturity: number;
  buyingIntent: number;
  budgetProbability: number;
  decisionMakerFound: number;
  engagement: number;
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
  provenance?: ProvenanceRecord[];
  source?: DiscoverySourceType;
  listIds?: string[];
  syncStatus: 'unregistered' | 'synced';
  syncedEntityId?: string;
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
}
