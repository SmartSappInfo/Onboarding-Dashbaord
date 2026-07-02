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

export interface LeadIntelligenceSettings {
  googlePlacesApiKey?: string;
  builtwithApiKey?: string;
  hunterApiKey?: string;
  chromeExtensionToken?: string;
}
