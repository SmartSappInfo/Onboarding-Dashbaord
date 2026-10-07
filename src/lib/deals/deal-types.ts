/**
 * @fileoverview Deals Platform 2.0 Type Definitions
 *
 * ARCHITECTURAL POINTER (Deals 2.0 Domain Expansion):
 * Extends the platform's core revenue opportunities domain with:
 * - Line Items & Product associations (recurring vs one-time, taxes, discounts)
 * - Stage History & Velocity intervals (duration, enteredAt, exitedAt)
 * - Deterministic Health Status ('healthy' | 'at_risk' | 'stalled' | 'closed')
 * - Forecast Categories ('pipeline' | 'best_case' | 'commit' | 'closed' | 'omitted')
 * - Semantic DealStage alias maintaining 100% backward compatibility with OnboardingStage
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All types must remain strictly typed with zero 'any' or 'any[]'.
 * - Fields must remain optional or provide safe defaults for legacy Deal documents.
 * - Double-brace variable resolution must route through FieldsVariablesService.
 *
 * TESTABILITY POINTER:
 * Covered by unit tests in `src/lib/deals/__tests__/deal-types.test.ts`.
 */

import type { 
  OnboardingStage, 
  DealFocalContact, 
  DealContact, 
  Deal, 
  Pipeline, 
  PipelineType, 
  StageTerminalType, 
  StageRequiredField 
} from '../types';

export type { 
  OnboardingStage, 
  Deal, 
  Pipeline, 
  PipelineType, 
  StageTerminalType, 
  StageRequiredField 
};

/**
 * Semantic type alias for deal stages to align CRM terminology
 * while maintaining 100% compatibility with the underlying Firestore collection.
 */
export type DealStage = OnboardingStage;

/**
 * Result payload returned when validating stage movement against entry/exit criteria
 */
export interface StageValidationResult {
  valid: boolean;
  missingFields: StageRequiredField[];
  missingFieldLabels: string[];
  message?: string;
}

/**
 * Deterministic Health Status of a Deal opportunity
 */
export type DealHealthStatus = 'healthy' | 'at_risk' | 'stalled' | 'closed';

/**
 * Standard CRM Revenue Forecast Category
 */
export type ForecastCategory = 'pipeline' | 'best_case' | 'commit' | 'closed' | 'omitted';

/**
 * Individual product or service line item associated with a Deal
 */
export interface DealLineItem {
  id: string;
  productId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // Flat discount amount
  discountPercent?: number; // Discount percentage (0-100)
  taxRate?: number; // Tax percentage (e.g., 15 for 15%)
  total: number; // Calculated net total for this line item
  isRecurring?: boolean;
  billingInterval?: 'monthly' | 'quarterly' | 'annual' | 'one_time';
  createdAt?: string;
}

/**
 * Reusable Product or Service in the Catalog (Phase 4)
 */
export interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  unitPrice: number;
  currency: string;
  isRecurring: boolean;
  billingInterval: 'monthly' | 'quarterly' | 'annual' | 'one_time';
  taxRate?: number;
  isActive: boolean;
  workspaceId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Organizational Product / Service Category (Phase 4)
 */
export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  order: number;
  workspaceId: string;
  organizationId: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Price Book for Tiered & Currency-Specific Pricing (Phase 4)
 */
export interface PriceBook {
  id: string;
  name: string;
  description?: string;
  currency: string;
  isStandard: boolean;
  isActive: boolean;
  workspaceId: string;
  organizationId: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Specific Product Price Override inside a Price Book (Phase 4)
 */
export interface PriceBookItem {
  id: string;
  priceBookId: string;
  productId: string;
  productName: string;
  customUnitPrice: number;
  currency: string;
  minQuantity?: number;
  maxDiscountPercent?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Comprehensive Revenue Breakdown & Projections (Phase 4)
 */
export interface DealRecurringRevenue {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  mrr: number;
  arr: number;
  oneTimeValue: number;
  recurringValue: number;
  acv: number;
  tcv: number;
  contractTermMonths: number;
}

/**
 * Historical record of a deal's progression through a specific stage
 */
export interface DealStageHistory {
  stageId: string;
  stageName: string;
  enteredAt: string; // ISO 8601 string
  exitedAt?: string | null; // ISO 8601 string or null if currently in this stage
  durationSeconds?: number | null; // Elapsed duration in seconds
  changedByUserId: string; // User ID who initiated stage transition
  notes?: string;
}

/**
 * Next planned activity for a Deal
 */
export interface DealNextStep {
  type: 'task' | 'meeting' | 'call' | 'follow_up';
  title: string;
  dueDate: string; // ISO 8601 string
  assigneeName?: string;
  isCompleted?: boolean;
}

/**
 * Commercial Quote generated from Deal Line Items
 */
export interface DealQuote {
  id: string;
  quoteNumber: string;
  dealId: string;
  workspaceId: string;
  organizationId: string;
  entityId: string;
  entityName: string;
  recipientEmail?: string;
  recipientName?: string;
  lineItems: DealLineItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  grandTotal: number;
  currency: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
  validUntil: string;
  notes?: string;
  terms?: string;
  token?: string; // Public view access token
  createdAt: string;
  updatedAt: string;
}

/**
 * Full Deals 2.0 Revenue Opportunity Record
 */
export interface Deal2 {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // Link to Unified Entity (WorkspaceEntity / School)
  pipelineId: string;
  stageId: string;
  stageName?: string;
  name: string; // e.g. "Acme Corp - Enterprise Rollout"
  value: number; // Monetary total value (synced with lineItems or manual entry)
  currency?: string; // ISO Currency Code (e.g. "USD", "GHS", "EUR")
  status: 'open' | 'won' | 'lost';
  lostReason?: string | null;
  
  // Contacts & Relationships
  contacts?: DealContact[]; // Secondary contacts from other entities
  focalContacts?: DealFocalContact[]; // Focal stakeholders from this entity
  assignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  } | null;

  // Velocity, SLAs & Stage Tracking
  stageEnteredAt?: string; // When the deal entered its current stage
  stageHistory?: DealStageHistory[]; // Chronological transition log
  daysInCurrentStage?: number; // Derived velocity metric

  // Revenue, Commercials & Line Items
  lineItems?: DealLineItem[];
  probability?: number; // Win probability percentage (0-100)
  forecastCategory?: ForecastCategory; // CRM Forecast Category
  weightedValue?: number; // Derived value * (probability / 100)

  // Health, Urgency & Next Step
  healthStatus?: DealHealthStatus;
  stalledReason?: string | null;
  nextStep?: DealNextStep | null;
  expectedCloseDate?: string | null;

  // Attribution & Source
  source?: 'manual' | 'bulk_import' | 'automation' | 'marketing_campaign' | 'call_centre' | 'lead_conversion';
  campaignId?: string;
  leadId?: string;
  isBulkImport?: boolean;

  // Metadata & Custom Attributes
  description?: string | null;
  customFields?: Record<string, string | number | boolean | null>;
  tags?: string[];
  
  // Lifecycle & Soft-Archival (Phase 1 Expansion)
  isArchived?: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  mergedIntoDealId?: string | null;

  createdAt: string;
  updatedAt: string;
}

/**
 * Configuration options for cloning/duplicating an existing Deal
 */
export interface DealDuplicateOptions {
  newName?: string;
  targetPipelineId?: string;
  targetStageId?: string;
  copyLineItems?: boolean;
  copyContacts?: boolean;
  copyCustomFields?: boolean;
}

/**
 * Configuration options for merging two Deals
 */
export interface DealMergeOptions {
  masterDealId: string;
  secondaryDealId: string;
  resolvedName: string;
  resolvedValue: number;
  resolvedPipelineId: string;
  resolvedStageId: string;
  resolvedCloseDate?: string | null;
  resolvedAssignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  } | null;
  mergeContacts: boolean;
  mergeLineItems: boolean;
  mergeCustomFields: boolean;
  mergeTasksAndNotes: boolean;
}

/**
 * Result payload returned upon successful Deal merge
 */
export interface DealMergeResult {
  success: boolean;
  masterDealId: string;
  secondaryDealId: string;
  mergedContactsCount: number;
  mergedLineItemsCount: number;
  error?: string;
}

/**
 * Conversion strategy for adapting an entity when transferring a deal across different workspace scopes.
 * Aligned with Rule 4 (Strict Typing) and Rule 61 (Backoffice Control Plane).
 */
export type EntityScopeConversionStrategy =
  | 'auto'
  | 'promote_primary_focal_contact'
  | 'promote_first_contact'
  | 'derive_from_company_field'
  | 'promote_primary_as_guardian'
  | 'require_human_approval';

/**
 * Backoffice configuration policy for handling entity scope conversions on a pipeline or workspace.
 * Allows operations to dictate autonomous agent behavior without code changes (Rule 61 & 64).
 */
export interface EntityScopeConversionPolicy {
  institutionToPersonStrategy: 'promote_primary_focal_contact' | 'promote_first_contact' | 'require_human_approval';
  personToInstitutionStrategy: 'derive_from_company_field' | 'require_human_approval';
  toFamilyStrategy: 'promote_primary_as_guardian' | 'require_human_approval';
  requireApprovalForCrossScope?: boolean; // Forces Two-Phase proposal model (Rule 21 & 22)
  disableAutonomousTransfers?: boolean;   // Dead-Man Kill Switch (Rule 60)
}

/**
 * Result of resolving entity scope conversion before or during deal transfer.
 * Captures bi-directional lineage and audit trace (Rule 41).
 */
export interface EntityScopeResolutionResult {
  sourceEntityId: string;
  targetEntityId: string;
  sourceScope: string;
  targetScope: string;
  strategyUsed: EntityScopeConversionStrategy;
  wasCreated: boolean;
  promotedContactId?: string;
  auditEvidence: string;
}

/**
 * ARCHITECTURAL POINTER (Cross-Workspace Deal Transfer & Copy - Rule 10 & Rule 69):
 * Input options for transferring (moving) or copying a Deal across pipelines and workspaces.
 */
export interface TransferDealInput {
  dealId: string;
  mode: 'move' | 'copy';
  sourceWorkspaceId: string;
  targetWorkspaceId: string;
  targetPipelineId: string;
  targetStageId: string;
  assignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  } | null;
  summary?: string;
  nextStep?: DealNextStep | null;
  // Copy mode specific options:
  newName?: string;
  copyLineItems?: boolean;
  copyContacts?: boolean;
  copyCustomFields?: boolean;
  idempotencyKey?: string;
  expectedUpdatedAt?: string;
  // Polymorphic entity scope resolution & Two-Phase options (Rules 21, 22, 42):
  entityConversionStrategy?: EntityScopeConversionStrategy;
  focalContactId?: string; // Explicit focal contact to promote into person entity
  dryRun?: boolean; // Shadow Mode: simulate without writing to database
  approvalId?: string; // Pre-approved proposal ID for committing Two-Phase transfers
}

/**
 * Result payload returned upon executing a deal transfer or copy
 */
export interface TransferDealResult {
  success: boolean;
  dealId?: string;
  phase?: 'COMMITTED' | 'PROPOSAL';
  approvalId?: string;
  requiresProposal?: boolean;
  auditEvidence?: string;
  entityResolution?: EntityScopeResolutionResult;
  error?: string;
}

/**
 * Result payload from AI deal transfer summary and next-step recommendation
 */
export interface DealTransferAiSummaryResult {
  success: boolean;
  summary?: string;
  nextStep?: DealNextStep;
  activityCount?: number;
  error?: string;
  isFallback?: boolean;
}

/**
 * KPI Summary for Executive Deals Overview Dashboard
 */
export interface DealsOverviewMetrics {
  totalPipelineValue: number;
  totalWeightedValue: number;
  totalWonValue: number;
  totalActiveDeals: number;
  winRatePercentage: number;
  avgDealSize: number;
  healthyDealsCount: number;
  atRiskDealsCount: number;
  stalledDealsCount: number;
  closingThisWeekCount: number;
  slaBreachedCount: number;
  noNextStepCount: number;
}

/**
 * Options payload for converting a Lead / Prospect into a Deals Platform 2.0 Opportunity
 */
export interface LeadConversionOptions {
  leadEntityId: string;
  pipelineId: string;
  stageId?: string;
  dealName?: string;
  value?: number;
  expectedCloseDate?: string | null;
  assignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  } | null;
  focalContactIds?: string[];
  notes?: string;
  workspaceId: string;
}

/**
 * Result payload returned upon successful Lead conversion
 */
export interface LeadConversionResult {
  success: boolean;
  dealId?: string;
  leadEntityId?: string;
  error?: string;
}

/**
 * Multi-channel CRM activity interaction types for Deals
 */
export type DealInteractionType = 'call' | 'meeting' | 'email' | 'whatsapp' | 'sms' | 'note';

/**
 * Structured interaction payload for logging phone calls, meetings, emails, and messaging
 */
export interface DealInteractionData {
  type: DealInteractionType;
  subject: string;
  description?: string;
  outcome?: string; // e.g., 'connected', 'left_voicemail', 'completed', 'scheduled', 'delivered'
  durationMinutes?: number;
  recipientContactId?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  occurredAt?: string;
  locationOrPlatform?: string; // e.g. 'In-Person', 'Zoom', 'Google Meet', 'Phone'
}

/**
 * Result payload returned upon logging a Deal interaction
 */
export interface DealInteractionResult {
  success: boolean;
  activityId?: string;
  error?: string;
}

/**
 * ============================================================================
 * PHASE 7: FORECASTING & REVENUE ANALYTICS MATRIX DOMAIN TYPES (PRD Section 124)
 * ============================================================================
 */

/**
 * Workspace or Pipeline revenue target / quota for a given period
 */
export interface PipelineTarget {
  id: string;
  workspaceId: string;
  pipelineId?: string | null; // null represents workspace-level target
  period: string; // e.g., '2026-08', '2026-Q3', '2026'
  targetAmount: number;
  currency: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Stage-by-stage progression and conversion metrics for funnel analytics
 */
export interface StageFunnelStep {
  stageId: string;
  stageName: string;
  stageColor: string;
  order: number;
  dealsEntered: number;
  dealsConverted: number;
  conversionRate: number; // 0 - 100 percentage
  dropOffRate: number; // 0 - 100 percentage
  avgDaysInStage: number;
  totalValue: number;
  slaDays?: number;
}

/**
 * Velocity & cycle duration analytics (PRD Section 51)
 */
export interface SalesVelocityMetrics {
  salesVelocityPerDay: number; // ($ active * winRate% * avgDealSize) / avgCycleDays
  avgSalesCycleDays: number; // Avg days from creation to won
  winRatePercentage: number;
  avgDealSize: number;
  activePipelineValue: number;
  totalWonDeals: number;
  totalWonRevenue: number;
  timeToProposalDays: number;
  timeToCloseDays: number;
}

/**
 * Individual Sales Rep performance scorecard & metrics (PRD Section 52)
 */
export interface RepPerformanceMetrics {
  userId: string;
  userName: string;
  userEmail: string;
  avatarUrl?: string;
  dealsCount: number;
  dealsWonCount: number;
  dealsLostCount: number;
  winRatePercentage: number;
  revenueWon: number;
  activePipelineValue: number;
  avgDealSize: number;
  avgSalesCycleDays: number;
  activitiesCount: number;
}

/**
 * Pipeline bottleneck detection alert item (PRD Section 53)
 */
export interface StageBottleneck {
  stageId: string;
  stageName: string;
  stageColor: string;
  slaDays?: number;
  avgDaysInStage: number;
  delayFactor: number; // e.g. 1.5x, 2.3x SLA
  dropOffRate: number;
  severity: 'warning' | 'critical';
  reason: string;
}

/**
 * Revenue attribution breakdown by lead source or campaign channel (PRD Section 51)
 */
export interface RevenueAttribution {
  source: string;
  revenueWon: number;
  dealsCount: number;
  percentage: number;
}

/**
 * Forecast risk summary metrics (UI Section 34)
 */
export interface ForecastRiskSummary {
  highRiskCommitValue: number;
  highRiskCommitCount: number;
  closingIn14DaysValue: number;
  closingIn14DaysCount: number;
  withoutNextStepsValue: number;
  withoutNextStepsCount: number;
  highRiskCommitDeals: Deal[];
  closingSoonDeals: Deal[];
  noNextStepDeals: Deal[];
}

/**
 * Consolidated 3-Tier Analytics Dataset (UI Section 35)
 */
export interface DealsAnalyticsDataset {
  executive: {
    totalRevenueWon: number;
    totalPipelineValue: number;
    weightedForecastValue: number;
    winRatePercentage: number;
    targetAmount: number;
    pipelineCoverageRatio: number; // totalPipelineValue / targetAmount
    forecastAccuracy: number; // 0 - 100 percentage
  };
  management: {
    funnel: StageFunnelStep[];
    velocity: SalesVelocityMetrics;
    reps: RepPerformanceMetrics[];
    bottlenecks: StageBottleneck[];
  };
  operations: {
    stalledDealsCount: number;
    stalledDealsValue: number;
    slaBreachedCount: number;
    slaBreachedValue: number;
    riskSummary: ForecastRiskSummary;
    attributions: RevenueAttribution[];
  };
}

/**
 * Unified Commercial Catalog Item representation for Dual Autocomplete & Finance Hub
 */
export type UnifiedCatalogItem =
  | {
      id: string;
      type: 'product';
      name: string;
      sku?: string;
      description?: string;
      unitPrice: number;
      currency: string;
      isRecurring: boolean;
      billingInterval: 'monthly' | 'quarterly' | 'annual' | 'one_time';
      taxRate?: number;
      categoryId?: string;
      categoryName?: string;
      isActive: boolean;
    }
  | {
      id: string;
      type: 'package';
      name: string;
      sku?: string;
      description?: string;
      ratePerStudent: number;
      unitPrice: number; // Normalized alias for calculations
      currency: string;
      isRecurring: boolean; // true for institutional subscription tiers
      billingInterval: 'monthly' | 'quarterly' | 'annual' | 'one_time';
      billingTerm: 'term' | 'semester' | 'year' | 'monthly' | 'termly' | 'annually';
      taxRate?: number;
      isActive: boolean;
    };

/**
 * SKU / Product Performance Metric in Commercial Analytics
 */
export interface SkuPerformanceMetric {
  skuOrId: string;
  name: string;
  categoryName: string;
  isRecurring: boolean;
  totalRevenueWon: number;
  totalPipelineValue: number;
  totalQuantitySold: number;
  dealsWonCount: number;
  dealsTotalCount: number;
  winRatePercentage: number;
  avgDiscountPercentage: number;
}

/**
 * Category Revenue Contribution Metric
 */
export interface CategoryRevenueMetric {
  categoryId: string;
  categoryName: string;
  color?: string;
  totalRevenueWon: number;
  dealsCount: number;
  revenuePercentage: number;
  mrrContribution: number;
}

/**
 * Commercial & Pricing Analytics Summary
 */
export interface CommercialAnalyticsSummary {
  totalCatalogRevenueWon: number;
  totalActiveSkus: number;
  totalActivePackages: number;
  totalPriceBooks: number;
  recurringVsOneTimeRatio: {
    mrr: number;
    arr: number;
    recurringTotal: number;
    oneTimeTotal: number;
    recurringPercentage: number;
  };
  topProducts: SkuPerformanceMetric[];
  categoryBreakdown: CategoryRevenueMetric[];
  avgDiscountDepth: number;
}

/**
 * Parameters for creating a deal along with a newly initialized entity and primary contact.
 */
export interface CreateDealWithNewEntityParams {
  workspaceId: string;
  organizationId: string;
  entity: {
    name: string;
    entityType?: import('../types').EntityType;
    primaryContact: {
      name: string;
      phone?: string;
      email?: string;
      role?: string;
    };
  };
  deal: {
    pipelineId: string;
    stageId?: string;
    name: string;
    value: number;
    description?: string | null;
    expectedCloseDate?: string | null;
    assignmentStrategy?: 'direct' | 'unassigned' | 'round-robin' | 'value-based';
    assignedTo?: { userId: string | null; name: string | null; email: string | null };
    suppressAutomations?: boolean;
  };
}

/**
 * Result payload from composite deal and entity creation.
 */
export interface CreateDealWithNewEntityResult {
  success: boolean;
  dealId?: string;
  entityId?: string;
  focalContact?: DealFocalContact;
  error?: string;
  isDuplicate?: boolean;
  duplicates?: import('../entity-duplicate-detection').DuplicateMatch[];
}


