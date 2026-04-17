

// ─────────────────────────────────────────────────
// Backoffice Type Definitions
// Platform Control Plane types for Super Admin Backoffice
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
  | 'support_admin'      // Support tools, impersonation
  | 'security_auditor'   // Audit logs, compliance (read-only)
  | 'migration_admin'    // Jobs, migrations, repairs
  | 'readonly_auditor';  // Read-only across all modules

/**
 * Backoffice module identifiers for RBAC matrix.
 */
export type BackofficeModule =
  | 'dashboard'
  | 'organizations'
  | 'workspaces'
  | 'features'
  | 'templates'
  | 'fields'
  | 'assets'
  | 'operations'
  | 'audit'
  | 'settings';

/**
 * Actions available within each backoffice module.
 */
export type BackofficeAction = 'view' | 'create' | 'edit' | 'delete' | 'execute';

// ─────────────────────────────────────────────────
// Platform Feature Flags
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
// Platform Templates
// ─────────────────────────────────────────────────

/**
 * Template type identifier.
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
  | 'theme';

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
  content: unknown;               // Template-specific content (JSON)
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
export type PlatformProviderType = 'email' | 'sms' | 'webhook' | 'storage';

/**
 * Platform Provider Setting — stored in `platform_provider_settings` collection.
 */
export interface PlatformProviderSetting {
  id: string;
  provider: string;               // e.g., "resend", "mnotify"
  type: PlatformProviderType;
  config: Record<string, unknown>; // Provider-specific config (encrypted secrets)
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

/**
 * Field definition for default field packs.
 */
export interface PlatformFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'url' | 'email' | 'phone';
  required: boolean;
  options?: string[];             // For select/multiselect types
  description?: string;
  order: number;
}

/**
 * Section definition for organizing fields.
 */
export interface PlatformFieldSection {
  key: string;
  label: string;
  description?: string;
  order: number;
  fieldKeys: string[];
}

/**
 * Platform Field Pack — stored in `platform_field_defaults` collection.
 */
export interface PlatformFieldPack {
  id: string;
  name: string;
  description: string;
  fields: PlatformFieldDefinition[];
  sections: PlatformFieldSection[];
  entityCompatibility: ('institution' | 'family' | 'person')[];
  isDefaultForNewWorkspaces: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

// ─────────────────────────────────────────────────
// Config Resolution
// ─────────────────────────────────────────────────

/**
 * Resolved configuration value with source tracking.
 */
export interface ResolvedConfig<T = boolean> {
  value: T;
  source: 'system' | 'organization' | 'workspace';
  overridden: boolean;
  sourceId?: string;
}

// ─────────────────────────────────────────────────
// Platform Dashboard Stats
// ─────────────────────────────────────────────────

/**
 * Aggregated platform health metrics for the dashboard.
 */
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
