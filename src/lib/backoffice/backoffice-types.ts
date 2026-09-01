/**
 * @fileoverview Platform Control Plane Type Definitions (Super Admin Backoffice)
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Single source of truth for all backoffice roles, modules, template types, and telemetry.
 * - Zero `any` or `any[]` typing is strictly enforced across all interfaces.
 * - Platform collections are isolated to Admin SDK / Server Action operations with zero client-side direct access.
 *
 * @testability Exported types are purely functional and isomorphic (client and server safe).
 * @trustBoundary Security RBAC evaluates against trusted Firebase ID tokens and server profile documents.
 */

import type { IndustryVertical } from '../types';

// ─────────────────────────────────────────────────
// Backoffice Roles & Modules (RBAC Matrix)
// ─────────────────────────────────────────────────

/**
 * Backoffice roles — separate from workspace RBAC.
 * These roles govern what a user can do in the /backoffice control plane.
 */
export type BackofficeRole =
  | 'super_admin'        // Full access to all backoffice modules
  | 'tenant_admin_ops'   // Org/workspace management
  | 'release_admin'      // Feature flags, rollouts, kill switches
  | 'template_admin'     // Templates, themes management
  | 'support_admin'      // Support tools, impersonation, tenant triage
  | 'security_auditor'   // Audit logs, compliance (read-only)
  | 'migration_admin'    // Jobs, migrations, repairs
  | 'readonly_auditor';  // Read-only across all modules

/**
 * Backoffice module identifiers for RBAC matrix.
 */
export type BackofficeModule =
  | 'dashboard'
  | 'health'
  | 'organizations'
  | 'workspaces'
  | 'features'
  | 'templates'
  | 'survey_governance'
  | 'fields'
  | 'assets'
  | 'operations'
  | 'messaging_observatory'
  | 'finance_monitor'
  | 'meetings_monitor'
  | 'integration_health'
  | 'audit'
  | 'settings'
  | 'approvals';

/**
 * Actions available within each backoffice module.
 */
export type BackofficeAction = 'view' | 'create' | 'edit' | 'delete' | 'execute';

// ─────────────────────────────────────────────────
// Platform Feature Flags & Entitlements
// ─────────────────────────────────────────────────

/**
 * Rollout rule for gradual feature deployment.
 */
export interface RolloutRule {
  type: 'percentage' | 'allowlist' | 'channel';
  /** Percentage (0–100) for percentage-based rollout */
  percentage?: number;
  /** Organization IDs for allowlist-based rollout */
  orgIds?: string[];
  /** Release channel: internal → beta → stable */
  channel?: 'internal' | 'beta' | 'stable';
  /** Whether this rule is active */
  enabled: boolean;
}

/**
 * Platform Feature Flag — stored in `platform_features` collection.
 * This is the system-level source of truth for feature enablement.
 */
export interface PlatformFeature {
  id: string;
  key: string;                    // e.g., "page_builder", must be unique
  label: string;                  // Human-readable label
  description?: string;
  category: string;               // e.g., "Operations", "Studios", "Finance"
  stability: 'stable' | 'beta' | 'internal';
  defaultState: boolean;          // Default on/off for new orgs
  killSwitch: boolean;            // Emergency disable — overrides everything
  rolloutRules: RolloutRule[];
  orgOverrides: Record<string, boolean>; // orgId → enabled
  workspaceCompatibility: string[]; // ContactScope types this feature works with
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Entitlement bundle — groups features into plan tiers.
 * Stored in `platform_entitlements` collection.
 */
export interface PlatformEntitlement {
  id: string;
  name: string;                   // e.g., "Pro Plan", "Enterprise"
  description: string;
  featureIds: string[];           // Platform feature IDs included
  isDefault: boolean;             // Applied to new orgs by default
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

// ─────────────────────────────────────────────────
// Audit Logging
// ─────────────────────────────────────────────────

/**
 * Actor information for audit logs.
 */
export interface AuditActor {
  userId: string;
  name: string;
  email: string;
  role: BackofficeRole;
  isImpersonation?: boolean;
}

/**
 * Immutable audit log entry — stored in `platform_audit_logs` collection.
 * Follows Google Cloud Audit Log principles.
 */
export interface PlatformAuditLog {
  id: string;
  actor: AuditActor;
  action: string;                 // e.g., "feature.toggle", "org.suspend", "template.publish"
  resourceType: string;           // e.g., "feature", "organization", "template"
  resourceId: string;
  scope: 'platform' | 'organization' | 'workspace';
  scopeId?: string;               // org or workspace ID when scoped
  before: Record<string, unknown> | null;  // Snapshot before change
  after: Record<string, unknown> | null;   // Snapshot after change
  timestamp: string;              // ISO timestamp
  ip?: string;
  sessionId?: string;
  isBulk: boolean;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────
// Platform Templates (All 15 Domains)
// ─────────────────────────────────────────────────

/**
 * Universal Template type identifier covering all platform functional domains.
 */
export type PlatformTemplateType =
  | 'messaging'
  | 'form'
  | 'page'
  | 'survey'
  | 'pdf'
  | 'automation'
  | 'pipeline'
  | 'task'
  | 'theme'
  | 'role_architecture'
  | 'section'
  | 'block'
  | 'meeting'
  | 'dunning'
  | 'qr_credential'
  | 'qr_template'
  | 'brand_voice'
  | 'prompt';

/**
 * Version record for template history.
 */
export interface TemplateVersionRecord {
  version: number;
  content: unknown;
  publishedAt: string;
  publishedBy: string;
  changelog?: string;
}

/**
 * Platform Template — stored in `platform_templates` collection.
 */
export interface PlatformTemplate {
  id: string;
  type: PlatformTemplateType;
  name: string;
  description: string;
  category: string;
  scope: 'system';
  version: number;
  versionHistory: TemplateVersionRecord[];
  content: unknown;               // Strongly-typed per domain
  status: 'draft' | 'published' | 'deprecated' | 'archived';
  defaultForNewOrgs: boolean;
  visibilityRules: {
    orgIds?: string[];
    workspaceTypes?: string[];
  };
  usageCount: number;             // Denormalized
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

// ─────────────────────────────────────────────────
// Platform Assets
// ─────────────────────────────────────────────────

/**
 * Asset category.
 */
export type PlatformAssetCategory =
  | 'system-logo'
  | 'email-footer'
  | 'stock-icon'
  | 'document-background'
  | 'og-image'
  | 'theme-asset'
  | 'legal-document'
  | 'other';

/**
 * Platform Asset — stored in `platform_assets` collection.
 */
export interface PlatformAsset {
  id: string;
  name: string;
  category: PlatformAssetCategory;
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  isDefault: boolean;
  usageCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  uploadedBy: string;
}

// ─────────────────────────────────────────────────
// Platform Jobs
// ─────────────────────────────────────────────────

/**
 * Job type identifier.
 */
export type PlatformJobType =
  | 'reseed_templates'
  | 'reindex_search'
  | 'rebuild_variables'
  | 'repair_contacts'
  | 'fix_duplicate_slugs'
  | 'backfill_analytics'
  | 'replay_webhooks'
  | 'retry_campaigns'
  | 'restore_archived'
  | 'migrate_data'
  | 'migrate_hierarchical_rbac'
  | 'migrate_legacy_saas_fields'
  | 'migrate_messaging_templates_fer'
  | 'migrate_meetings_fer'
  | 'encrypt_platform_secrets'
  | 'custom';

/**
 * Job log entry.
 */
export interface JobLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Platform Job — stored in `platform_jobs` collection.
 */
export interface PlatformJob {
  id: string;
  type: PlatformJobType;
  label: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  scope: {
    type: 'platform' | 'organization' | 'workspace';
    id?: string;
  };
  isDryRun: boolean;
  progress: {
    total: number;
    processed: number;
    errors: number;
  };
  logs: JobLogEntry[];
  result?: Record<string, unknown>;
  createdBy: AuditActor;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────
// Platform Provider Settings
// ─────────────────────────────────────────────────

/**
 * Provider type identifier.
 */
export type PlatformProviderType = 'email' | 'sms' | 'webhook' | 'storage' | 'ai';

/**
 * Platform Provider Setting — stored in `platform_provider_settings` collection.
 */
export interface PlatformProviderSetting {
  id: string;
  provider: string;               // e.g., "resend", "mnotify"
  type: PlatformProviderType;
  config: Record<string, unknown>; // Provider-specific config (sealed secrets)
  supportedModels?: string[];      // For AI providers: governs the allowable models globally
  isDefault: boolean;
  orgOverrides: Record<string, Record<string, unknown>>;
  rateLimits: {
    maxPerMinute: number;
    maxPerHour: number;
    maxPerDay: number;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

// ─────────────────────────────────────────────────
// Platform Field & Contact Type Defaults
// ─────────────────────────────────────────────────

export interface PlatformFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'url' | 'email' | 'phone';
  required: boolean;
  options?: string[];
  description?: string;
  order: number;
}

export interface PlatformFieldSection {
  key: string;
  label: string;
  description?: string;
  order: number;
  fieldKeys: string[];
}

export interface PlatformFieldPack {
  id: string;
  name: string;
  description: string;
  fields: PlatformFieldDefinition[];
  sections: PlatformFieldSection[];
  entityCompatibility: ('institution' | 'family' | 'person')[];
  industryCompatibility?: IndustryVertical[];
  isDefaultForNewWorkspaces: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

// ─────────────────────────────────────────────────
// Config Resolution
// ─────────────────────────────────────────────────

export interface ResolvedConfig<T = boolean> {
  value: T;
  source: 'system' | 'organization' | 'workspace';
  overridden: boolean;
  sourceId?: string;
}

// ─────────────────────────────────────────────────
// Platform Dashboard & Telemetry Stats
// ─────────────────────────────────────────────────

export interface PlatformDashboardStats {
  activeOrganizations: number;
  activeWorkspaces: number;
  totalUsers: number;
  totalEntities: number;
  failedJobs: number;
  pendingJobs: number;
  recentAuditActions: number;     // Last 24h
  featureRolloutProgress: {
    featureKey: string;
    label: string;
    percentage: number;           // 0–100
  }[];
}

// ─────────────────────────────────────────────────
// Tenant Health Hub & Issue Triage Interfaces
// ─────────────────────────────────────────────────

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'detected' | 'acknowledged' | 'investigating' | 'resolved' | 'closed';
export type HealthSignalType =
  | 'messaging.high_bounce_rate'
  | 'messaging.delivery_failure'
  | 'webhook.endpoint_down'
  | 'payment.gateway_error'
  | 'payment.high_overdue_ratio'
  | 'automation.dead_letter'
  | 'automation.stuck_runs'
  | 'auth.token_expiring_soon'
  | 'storage.quota_warning'
  | 'schema.orphaned_fields'
  | 'schema.orphaned_entities';

/**
 * Composite health scorecard for a tenant organization.
 */
export interface TenantHealthScore {
  organizationId: string;
  organizationName: string;
  healthScore: number;           // 0–100 composite
  status: 'healthy' | 'warning' | 'critical';
  messagingHealth: number;       // 0–100
  integrationHealth: number;     // 0–100
  financialHealth: number;       // 0–100
  workflowHealth: number;        // 0–100
  activeUsersCount: number;
  openIssuesCount: number;
  lastCalculatedAt: string;
}

/**
 * Auto-detected or manually created tenant issue.
 * Stored in `tenant_issues` collection.
 */
export interface TenantIssue {
  id: string;
  organizationId: string;
  organizationName: string;
  workspaceId?: string;
  signalType: HealthSignalType | 'manual_ticket';
  severity: IssueSeverity;
  status: IssueStatus;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  assignedTo?: {
    userId: string;
    name: string;
    email: string;
  };
  notes: Array<{
    id: string;
    author: AuditActor;
    text: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

// ─────────────────────────────────────────────────
// Messaging Observatory & Dead-Letter Queue (DLQ)
// ─────────────────────────────────────────────────

export interface ChannelMetrics {
  totalSent: number;
  deliveredCount: number;
  deliveryRate: number;         // percentage 0-100
  failedCount: number;
  bouncedCount: number;
  bounceRate: number;           // percentage 0-100
  openedCount: number;
  clickedCount: number;
}

export interface DeliveryMetrics {
  period: '24h' | '7d' | '30d';
  channels: {
    email: ChannelMetrics;
    sms: ChannelMetrics;
    whatsapp: ChannelMetrics;
    push: ChannelMetrics;
  };
  totalDispatches: number;
  overallDeliveryRate: number;
  calculatedAt: string;
}

export interface OrgDeliveryStats {
  organizationId: string;
  organizationName: string;
  totalSent: number;
  deliveryRate: number;
  bounceRate: number;
  failedCount: number;
  primaryChannel: string;
}

/**
 * Dead-letter record for failed outbound webhooks.
 * Stored in `webhook_dead_letters` collection.
 */
export interface WebhookDeadLetter {
  id: string;
  workspaceId: string;
  organizationId: string;
  endpointUrl: string;
  eventType: string;
  payload: Record<string, unknown>;
  httpStatus?: number;
  errorMessage: string;
  attemptCount: number;
  status: 'failed' | 'replaying' | 'resolved' | 'abandoned';
  createdAt: string;
  lastAttemptAt: string;
}

export interface SuppressionEntry {
  id: string;
  recipient: string;            // email or phone
  channel: 'email' | 'sms';
  reason: 'hard_bounce' | 'complaint' | 'manual' | 'unsubscribe';
  sourceOrgId?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────
// Financial Monitor Interfaces
// ─────────────────────────────────────────────────

export interface RevenueMetrics {
  mrr: number;
  arr: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  netRevenueCollectionRate: number;
  totalAgingReceivables: number;
  activeAgreementsCount: number;
  totalPaidThisMonth: number;
  totalOutstandingOverdue: number;
  currency: string;
  calculatedAt: string;
}

export interface GatewayHealthStatus {
  gateway: string;
  status: 'healthy' | 'degraded' | 'down';
  successRate24h: number;        // 0-100
  latencyMs?: number;
  uptimePercentage?: number;
  failedWebhooks24h?: number;
  lastErrorTimestamp?: string;
  lastErrorMessage?: string;
  activeWebhooksCount?: number;
  lastCheckedAt?: string;
}

export interface OverdueInvoiceItem {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  organizationName: string;
  workspaceId: string;
  amount: number;
  currency: string;
  dueDate: string;
  daysOverdue: number;
  currentDunningStage: number;
  status: 'overdue' | 'in_dunning' | 'written_off';
}

export interface AgingBucket {
  range: '0-30' | '31-60' | '61-90' | '90+';
  amount: number;
  invoicesCount: number;
}

export interface OrgRevenueSnapshot {
  organizationId: string;
  organizationName: string;
  mrr: number;
  outstandingBalance: number;
  activePackagesCount: number;
  currency: string;
}

// ─────────────────────────────────────────────────
// Meetings & Events Telemetry Interfaces
// ─────────────────────────────────────────────────

export interface LiveMeetingSession {
  meetingId: string;
  workspaceId: string;
  organizationName: string;
  title: string;
  provider: 'zoom' | 'daily' | 'google_meet' | 'teams';
  attendeeCount: number;
  startTime: string;
  status: 'active' | 'scheduled' | 'ended';
}

export interface MeetingTelemetrySnapshot {
  activeRoomsCount: number;
  totalRegistrations24h: number;
  joinLinkDeliverySuccessRate: number; // 0-100
  undeliveredJoinLinksCount: number;
  facilitatorsBriefedRate: number;     // 0-100
  calculatedAt: string;
}

// ─────────────────────────────────────────────────
// Survey & Integration Health Interfaces
// ─────────────────────────────────────────────────

export interface SurveyTrafficMetrics {
  totalSubmissions24h: number;
  activeSurveysCount: number;
  averageCompletionRate: number;      // 0-100
  flaggedSpamSubmissions24h: number;
  calculatedAt: string;
}

export interface SurveyDropoffInsight {
  surveyId: string;
  surveyTitle: string;
  organizationName: string;
  totalSessions: number;
  completedSessions: number;
  dropoffStepIndex: number;
  dropoffQuestionLabel: string;
  dropoffRate: number;               // 0-100
}

export interface FlaggedSurveySubmission {
  id: string;
  surveyId: string;
  surveyTitle: string;
  organizationName: string;
  ipAddress: string;
  reason: string;
  submittedAt: string;
  contentSnippet: string;
}

export interface IntegrationTokenStatus {
  id: string;
  organizationId: string;
  organizationName: string;
  workspaceId: string;
  provider: 'google' | 'microsoft' | 'zoom' | 'facebook' | 'linkedin';
  accountName: string;
  expiresAt: string;
  daysRemaining: number;
  status: 'valid' | 'expiring_soon' | 'expired' | 'revoked';
  lastRefreshedAt: string;
}

export interface CreditConsumptionStatus {
  service: 'email_verification' | 'phone_hlr' | 'ai_tokens';
  remainingCredits: number;
  usedToday: number;
  projectedDepletionDays: number;
  status: 'optimal' | 'low' | 'exhausted';
}

// ─────────────────────────────────────────────────
// Approval Workflow (Four-Eyes Governance)
// ─────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';

/** Registry key of an approval-gated operation. */
export type ApprovalActionKey =
  | 'organization.suspend'
  | 'organization.clear_activity_logs'
  | 'feature.enable_kill_switch'
  | 'automation.clear'
  | 'job.create_live'
  | 'issue.bulk_resolve'
  | 'template.bulk_propagate';

/**
 * A pending dangerous operation awaiting a second admin (four-eyes).
 */
export interface ApprovalRequest {
  id: string;
  actionKey: ApprovalActionKey;
  /** Serialized, validated inputs captured at request time. */
  payload: Record<string, unknown>;
  /** Human summary shown in the inbox, e.g. "Suspend Acme Corp: nonpayment". */
  summary: string;
  status: ApprovalStatus;
  requestedBy: AuditActor;
  decidedBy?: AuditActor;
  decidedAt?: string;
  executedAt?: string;
  executionError?: string;
  createdAt: string;
  expiresAt: string;
}
