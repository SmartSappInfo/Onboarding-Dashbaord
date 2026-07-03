
// ─────────────────────────────────────────────────
// Industry Vertical Types (Requirement 1)
// ─────────────────────────────────────────────────

/**
 * Supported industry verticals for workspace scoping.
 * Each workspace is scoped to exactly one industry vertical.
 */
export type IndustryVertical =
  | 'SaaS'
  | 'SchoolEnrollment'
  | 'Law'
  | 'Marketing'
  | 'RealEstate'
  | 'Consultancy';

/**
 * Determines which contact identifiers a workspace requires for entity creation.
 * Applied uniformly across bulk import, new entity page, and survey submissions.
 */
export type ContactIdentifierPolicy = 'phone_only' | 'email_only' | 'phone_or_email';

export const MEETING_TYPES = [
  { id: 'parent', name: 'Parent Engagement', slug: 'parent-engagement' },
  { id: 'kickoff', name: 'Kickoff', slug: 'kickoff' },
  { id: 'training', name: 'Training', slug: 'training' },
  { id: 'webinar', name: 'Webinar', slug: 'webinar' },
] as const;

export type MeetingType = typeof MEETING_TYPES[number];



export type SchoolStatusState = 'Active' | 'Inactive' | 'Archived' | 'archived';

export type SchoolStatus = SchoolStatusState; // Alias for backward compatibility


/**
 * Tag Category Types
 */
export type TagCategory =
  | 'behavioral'    // Actions taken (Downloaded, Attended, Clicked)
  | 'demographic'   // Location, size, type
  | 'interest'      // Product/service interests
  | 'status'        // Current state (Hot Lead, Active, Churned)
  | 'lifecycle'     // Journey stage (Prospect, Onboarding, Renewal)
  | 'engagement'    // Activity level (Highly Engaged, Inactive)
  | 'custom';       // User-defined

/**
 * Tag scope types for global vs workspace tag separation (Requirement 7)
 */
export type TagScope = 'global' | 'workspace';

/**
 * Tag Definition
 * Stored in 'tags' collection
 * 
 * Tag Scope Distinction (Requirement 7):
 * - "global": Identity-level tags visible across all workspaces (e.g., "vip", "strategic-account")
 *   Stored in: entities.globalTags
 * - "workspace": Operational tags scoped to one workspace (e.g., "hot-lead", "billing-issue")
 *   Stored in: workspace_entities.workspaceTags
 * 
 * Note: The scope field is optional during migration. Once task 12.2 is complete, it will become required.
 */
export interface Tag {
  id: string;
  workspaceId: string;           // Workspace-scoped
  organizationId: string;        // For org-level analytics
  name: string;                  // Display name (max 50 chars)
  slug: string;                  // URL-safe identifier
  description?: string;          // Optional description (max 200 chars)
  category: TagCategory;         // Tag category
  scope?: TagScope;              // Tag scope: "global" (identity-level) or "workspace" (operational) - optional during migration
  color: string;                 // Hex color code
  isSystem: boolean;             // System-generated (read-only)
  usageCount: number;            // Denormalized count for performance
  createdBy: string;             // User ID
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

/**
 * Contact Tag Association
 * Embedded in contact documents (schools, prospects)
 */
export interface ContactTagging {
  tags: string[];                           // Array of tag IDs
  taggedAt: { [tagId: string]: string };    // When each tag was applied
  taggedBy: { [tagId: string]: string };    // Who applied each tag
}

/**
 * Tag Usage Statistics
 */
export interface TagUsageStats {
  tagId: string;
  tagName: string;
  contactCount: number;
  lastUsed: string;
  trendDirection: 'up' | 'down' | 'stable';
  campaignUsage: number;
  automationUsage: number;
}

/**
 * Tag Audit Log Entry
 */
export interface TagAuditLog {
  id: string;
  workspaceId: string;
  action: 'created' | 'updated' | 'deleted' | 'merged' | 'applied' | 'removed';
  tagId: string;
  tagName: string;
  contactId?: string;
  contactName?: string;
  userId: string;
  userName: string;
  timestamp: string;
  metadata?: {
    oldValue?: any;
    newValue?: any;
    mergedIntoTagId?: string;
    bulkOperation?: boolean;
    affectedCount?: number;
  };
}

/**
 * Entity Audit Log Entry
 * Tracks all entity and workspace_entity operations for security and compliance
 * Requirements: 29.4
 */
export interface EntityAuditLog {
  id: string;
  organizationId: string;
  workspaceId?: string; // Optional for entity operations, required for workspace_entity operations
  action: 'entity_created' | 'entity_updated' | 'entity_deleted' | 'entity_read' |
  'workspace_entity_created' | 'workspace_entity_updated' | 'workspace_entity_deleted' | 'workspace_entity_read';
  entityId: string;
  entityType: 'institution' | 'family' | 'person';
  userId: string;
  userName: string;
  userEmail: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: {
    oldValue?: any;
    newValue?: any;
    changedFields?: string[];
    bulkOperation?: boolean;
    affectedCount?: number;
    operationContext?: string; // e.g., 'migration', 'manual_edit', 'api_call'
  };
}

/**
 * System Migration Log
 * Tracks the execution of seeding and data migration scripts.
 */
export interface SystemMigrationLog {
  id: string; // The migration key (e.g., 'fer_template_identifiers')
  status: 'completed' | 'failed' | 'in_progress';
  lastRunAt: string; // ISO timestamp
  executedBy?: string; // User ID or system identity
  summary?: string; // Short human-readable summary
  details?: any; // Structured log output (e.g., counts, errors)
}

/**
 * Tag Filter Query
 */
export interface TagFilterQuery {
  tagIds: string[];
  logic: 'AND' | 'OR' | 'NOT';
  categoryFilter?: TagCategory;
  dateRange?: {
    field: 'taggedAt' | 'createdAt';
    start: string;
    end: string;
  };
}

export type AutomationTrigger =
  | 'ENTITY_CREATED'
  | 'ENTITY_UPDATED'
  | 'ENTITY_ASSIGNED'
  | 'ENTITY_STAGE_CHANGED'
  | 'ENTITY_LINKED'
  | 'ENTITY_UNLINKED'
  | 'WORKSPACE_ENTITY_UPDATED'
  | 'TASK_CREATED'
  | 'TASK_COMPLETED'
  | 'SURVEY_SUBMITTED'
  | 'PDF_SIGNED'
  | 'FORM_SUBMITTED'
  | 'WEBHOOK_RECEIVED'
  | 'MEETING_CREATED'
  | 'MEETING_REGISTRANT_ADDED'
  | 'MEETING_REGISTRANT_ATTENDED'
  | 'MEETING_REGISTRANT_NO_SHOW'
  | 'TAG_ADDED'
  | 'TAG_REMOVED'
  | 'CAMPAIGN_PAGE_SUBMITTED'
  | 'DEAL_CREATED'
  | 'DEAL_STAGE_CHANGED'
  | 'DEAL_STATUS_CHANGED'
  | 'DEAL_VALUE_CHANGED'
  | 'CAMPAIGN_DELIVERED'
  | 'CAMPAIGN_FAILED'
  | 'CAMPAIGN_OPENED'
  | 'CAMPAIGN_CLICKED'
  | 'CAMPAIGN_NOT_DELIVERED'
  | 'ENTITY_FIELD_CHANGED'
  | 'DATE_REACHED'
  | 'TASK_OVERDUE'
  | 'WEBPAGE_VISITED'
  | 'EVENT_RECORDED'
  | 'EMAIL_BOUNCED'
  | 'SCORE_CHANGED'
  | 'DEAL_OWNER_CHANGED'
  | 'ENTITY_INACTIVE'
  | 'AUTOMATION_ENTERED'
  | 'AUTOMATION_COMPLETED';

/**
 * A single trigger entry within an automation's trigger list.
 * Each def has its own isolated config (e.g. which specific form, tag, or survey to watch).
 * The automation fires if ANY of its trigger defs matches the incoming event.
 */
export interface AutomationTriggerDef {
  /** Stable local ID for this entry (nanoid). Used to route config changes back to the correct def. */
  id: string;
  /** The event type this trigger listens for. */
  type: AutomationTrigger;
  /** Per-trigger configuration (e.g. tagIds, formId, surveyId, stageId). */
  config?: Record<string, unknown>;
  /** Optional user-facing label override. Defaults to the trigger type's display name. */
  label?: string;
}

/**
 * Configuration for tag-based automation triggers (TAG_ADDED / TAG_REMOVED).
 * Specifies which tags to watch and optionally filters by contact type or
 * how the tag was applied.
 */
export interface TagTriggerConfig {
  /** Tag IDs that should fire this trigger. Empty array means any tag. */
  tagIds: string[];
  /** Restrict trigger to a specific entity type. */
  entityType?: EntityType;
  /** Filter by how the tag was applied: 'manual' (by a user) or 'automatic' (by automation). */
  appliedBy?: 'manual' | 'automatic';
}

/**
 * Automation node that evaluates tag conditions during flow execution.
 */
export interface TagConditionNode {
  id: string;
  type: 'tag_condition';
  data: {
    logic: 'has_tag' | 'has_all_tags' | 'has_any_tag' | 'not_has_tag';
    tagIds: string[];
  };
}

/**
 * Automation node that applies or removes tags as an automation action.
 */
export interface TagActionNode {
  id: string;
  type: 'tag_action';
  data: {
    action: 'add_tags' | 'remove_tags';
    tagIds: string[];
  };
}

/**
 * Defines the root Tenant for branding, billing, and user governance.
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  primaryColor?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  /** True once the first admin completes org configuration. */
  isConfigured?: boolean;
  /** Provisioning invite token (`SS-XXXXXX`) for the unconfigured setup flow. */
  joinToken?: string;
  /** ISO expiry for the provisioning token. */
  joinTokenExpiresAt?: string;
  /** True once the provisioning token has been consumed (org configured). */
  joinTokenUsed?: boolean;
  status?: 'active' | 'trial' | 'suspended' | 'archived';
  settings?: {
    defaultCurrency?: string;
    defaultTimezone?: string;
    defaultLanguage?: string;
  };
  activityLoggingDisabled?: boolean;
  activityLoggingEnabled?: boolean;
  // AI Configuration (Requirement: Multi-Model Architecture)
  aiKeyMode?: 'platform' | 'custom';
  geminiApiKey?: string;
  openRouterApiKey?: string;
  openaiApiKey?: string;
  claudeApiKey?: string; // Optional if using OpenRouter directly
  // SMS Configuration
  smsKeyMode?: 'platform' | 'custom';
  mnotifyApiKey?: string;
  // Email Configuration
  emailKeyMode?: 'platform' | 'custom';
  resendApiKey?: string;
  resendDomain?: string;
  // OAuth credentials for custom developer configurations
  googleClientId?: string;
  googleClientSecret?: string;
  zoomClientId?: string;
  zoomClientSecret?: string;
  microsoftClientId?: string;
  microsoftClientSecret?: string;
  /**
   * Organization-level default sender profile id per channel. This is the ONLY
   * permitted fallback when no explicit or workspace-level sender resolves —
   * there is no cross-tenant global fallback.
   */
  defaultSenderProfileIds?: DefaultSenderProfileIds;
  defaultWorkspaceId?: string;
  defaultRoleId?: string; // Default role for new invites
  /** Optional default industry for new workspaces (Requirement 18) */
  industry?: IndustryVertical;
  /** Default country for new entities in this org. Falls back to 'GH' (Ghana) if unset. */
  defaultCountryId?: string;
  /** ISO 3166-1 alpha-2 country code (e.g. 'GH', 'US') used for phone number parsing fallback. */
  defaultCountryCode?: string;
  /** Features enabled for this organization. Missing keys = use defaultEnabled from APP_FEATURES. */
  enabledFeatures?: FeatureToggleMap;
  /** Global default values applied when entities are created via survey submissions */
  surveyEntityDefaults?: SurveyEntityDefaults;
  /** Departments list configured for this organization, presented during user onboarding */
  departments?: string[];
  
  // Custom brand styling fields
  unsubscribeCopy?: string;
  /** HTML template for the email footer. Supports {{variable}} tokens. Falls back to DEFAULT_ORG_FOOTER_HTML. */
  footerHtml?: string;
  /** When false, no footer is appended to outbound emails. Defaults to true. */
  footerEnabled?: boolean;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandFontFamily?: string;
  landingPageFooterEnabled?: boolean;
  landingPageFooterStyle?: 'default' | 'minimalist' | 'centered' | 'custom';
  landingPageFooterCustomHtml?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
  };

  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface AISeedResult {
  name: string;
  description: string;
  logoUrl: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  country: string;
  language: string;
}

export interface OrgBranding {
  logoUrl: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandFontFamily: string;
  name: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  landingPageFooterEnabled?: boolean;
  landingPageFooterStyle?: 'default' | 'minimalist' | 'centered' | 'custom';
  landingPageFooterCustomHtml?: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
  };
}

/**
 * Strict type for raw Firestore organization document reads.
 * Replaces `any` casts in messaging-branding.ts, template-resolver.ts,
 * and preview utilities. All fields are optional because Firestore documents
 * may be partially populated.
 */
export interface OrgBrandingData {
  name?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  unsubscribeCopy?: string;
  /** HTML footer template with {{variable}} tokens. */
  footerHtml?: string;
  /** When false, no footer is appended to outbound emails. */
  footerEnabled?: boolean;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandFontFamily?: string;
  settings?: {
    defaultTimezone?: string;
    defaultLanguage?: string;
    defaultCurrency?: string;
  };
}

/**
 * How the Open Graph / social preview image for a public page is sourced.
 * - `asset`        → the content's own banner/hero/cover image
 * - `entity_logo`  → the owning organization's logo
 * - `custom`       → an explicit URL supplied in {@link SeoConfig.ogImageUrl}
 */
export type OgImageMode = 'asset' | 'entity_logo' | 'custom';

/**
 * Canonical, surface-agnostic SEO & social-sharing configuration.
 *
 * Persisted as a nested `seo` object on public content documents
 * (surveys, campaign pages, meetings, forms, signing documents) and consumed
 * by `resolveSeoMetadata` in `src/lib/seo.ts`. Titles are stored **bare**
 * (without the "— SmartSapp" suffix); the resolver applies branding.
 */
export interface SeoConfig {
  /** Bare title (no brand suffix). Falls back to the content title. */
  title?: string;
  /** Plain-text description; HTML is stripped by the resolver. */
  description?: string;
  /** Comma-separated keywords; the resolver splits into an array. */
  keywords?: string;
  /** Which source supplies the social preview image. Defaults per surface. */
  ogImageMode?: OgImageMode;
  /** Explicit image URL; used only when `ogImageMode === 'custom'`. */
  ogImageUrl?: string;
  /** When true, title/description mirror the content fields, ignoring overrides. */
  useContentFallback?: boolean;
  /** When true, emits `robots: noindex, nofollow`. */
  noIndex?: boolean;
}

/**
 * Contact scope types for workspaces
 */
export type ContactScope = 'institution' | 'family' | 'person';

/**
 * Entity types for unified contact model
 */
export type EntityType = 'institution' | 'family' | 'person';

/**
 * @deprecated Migration is complete. All records use the unified entity-only model.
 * Migration status for tracking school-to-entity migration progress (Requirement 18)
 */
export type MigrationStatus = 'legacy' | 'migrated' | 'dual-write';

/**
 * Workspace capabilities configuration
 */
export interface WorkspaceCapabilities {
  billing: boolean;
  admissions: boolean;
  children: boolean;
  contracts: boolean;
  messaging: boolean;
  automations: boolean;
  tasks: boolean;
}

/**
 * Defines a managed Workspace within an Organization.
 * Operational data is partitioned by these IDs.
 */
export interface Workspace {
  id: string;
  organizationId: string; // Anchored to an Org
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  status: 'active' | 'archived';
  statuses: WorkspaceStatus[];
  contactScope?: ContactScope; // Declares the contact type this workspace manages
  capabilities?: WorkspaceCapabilities; // Feature flags for workspace modules
  /** Determines if users see only their assigned entities in this workspace (governance) */
  restrictVisibilityToAssigned?: boolean;
  /** Features enabled for this workspace. Can only enable features that are enabled at org level. */
  enabledFeatures?: FeatureToggleMap;
  terminology?: {
    singular: string;
    plural: string;
    description?: string;
  };
  scopeLocked?: boolean; // True once first entity is linked
  /** Industry vertical this workspace is scoped to (Requirement 2) */
  industry: IndustryVertical;
  /** True after first entity is linked — prevents industry changes (Requirement 2) */
  industryScopeLocked: boolean;
  /** Timestamp when industry scope was locked (Requirement 2) */
  industryScopeLockedAt?: string;
  /** Workspace-level default values applied when entities are created via survey submissions */
  surveyEntityDefaults?: SurveyEntityDefaults;
  /** Contact identifier policy: which identifiers are required to save an entity */
  contactPolicy?: ContactIdentifierPolicy;
  /** Workspace-level default values applied across all entity creation flows */
  entityDefaults?: EntityDefaults;
  /** Default SMS Sender ID configured for the workspace (Max 11 alphanumeric characters) */
  defaultSmsSenderId?: string;
  /**
   * Workspace-level default sender profile id per channel. Overrides the org
   * default; resolved before falling back to {@link Organization.defaultSenderProfileIds}.
   */
  defaultSenderProfileIds?: DefaultSenderProfileIds;
  /** Custom lead sources created by the user during bulk import or elsewhere */
  customLeadSources?: string[];
  leadScoringSettings?: LeadScoringSettings;
  createdAt: string;
  updatedAt: string;
}

export interface EmailVerificationRule {
  minScore: number;
  scoreValue: number;
}

/** Same threshold→value shape as email rules; applied to phone verification scores. */
export type PhoneVerificationRule = EmailVerificationRule;

export interface LeadScoringSettings {
  emailVerificationRules: EmailVerificationRule[];
  phoneVerificationRules?: PhoneVerificationRule[];
  engagementRules: Record<string, number>;
}

export interface WorkspaceStatus {
  value: string;
  label: string;
  color: string;
  description?: string;
}

/**
 * Governance: Financial templates managed at the Organization level.
 */
export interface BillingProfile {
  id: string;
  organizationId: string;
  name: string;
  levyPercent: number;
  vatPercent: number;
  defaultDiscount: number;
  paymentInstructions: string;
  signatureName: string;
  signatureDesignation: string;
  signatureUrl?: string;
  workspaceIds: string[]; // Determines which workspaces can use this profile
  createdAt: string;
  updatedAt: string;
}

export interface Attendee {
  id: string;
  parentName: string;
  childrenNames: string[];
  joinedAt: string;
}

/**
 * Guardian associated with a family entity
 */
export interface Guardian {
  name: string;
  phone: string;
  email: string;
  relationship: string; // e.g., Father, Mother, Legal Guardian
  isPrimary: boolean;
}

/**
 * Child associated with a family entity
 */
export interface Child {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date string
  gradeLevel?: string;
  enrollmentStatus?: string;
}

export interface ContactNote {
  id: string;
  content: string;
  createdAt: string;
}

/**
 * A general note attached to an Entity, stored in the 'entity_notes' subcollection
 * or separate collection.
 */
export interface EntityNote {
  id: string;
  entityId: string;
  workspaceId: string;
  content: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  /** Note category for filtering */
  noteType?: 'general' | 'call' | 'meeting' | 'escalation' | 'followup';
  /** Pinned notes float to the top */
  isPinned?: boolean;
  pinnedAt?: string;
  pinnedBy?: string;
  /** Threading support */
  parentNoteId?: string;
  replyCount?: number;
  /**
   * Deal linkage — set when the note was created in a deal's context.
   * `dealName` is denormalised at write time for display (consistent with the
   * app's denormalisation pattern, e.g. Deal.stageName). The note still shares
   * `entityId`, so it surfaces in the entity notes panel with a deal chip.
   */
  dealId?: string;
  dealName?: string;
}

export interface ContactAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  createdAt: string;
}

/**
 * Canonical contact record for an entity.
 * All contact communication data lives here — no direct phone/email on entity root.
 *
 * Rules:
 * - Exactly one contact must have isPrimary = true
 * - Exactly one contact must have isSignatory = true
 * - The same contact may be both primary and signatory
 * - First contact created defaults to isPrimary + isSignatory
 * - typeKey is a stable normalized key (e.g. "billing_officer")
 * - typeLabel is the editable display label (e.g. "Billing Officer")
 * - Variables are generated from typeKey, never typeLabel
 */
export interface EntityContact {
  id: string;
  name: string;
  email?: string;
  phone?: string; // Stored natively in E.164 format (e.g., +233242737120)
  countryCode?: string; // ISO 3166-1 alpha-2 (e.g. 'GH')
  callingCode?: string; // Phone prefix (e.g. '233')
  typeKey: string;
  typeLabel?: string;
  isPrimary: boolean;
  isSignatory: boolean;
  order: number;
  notes?: ContactNote[];
  attachments?: ContactAttachment[];
  emailVerificationScore?: number;
  score?: number;
  // Email Hygiene
  emailStatus?: 'valid' | 'bounced' | 'unsubscribed' | 'complained' | 'snoozed' | 'opt-down';
  bounceReason?: string;
  bouncedAt?: string;
  unsubscribedAt?: string;
  unsubscribedCategories?: string[];
  snoozedUntil?: string;
  optDownFrequency?: 'weekly' | 'monthly' | 'default';
  // Phone Hygiene
  // Note: like emailVerificationScore, phoneVerificationScore stores the
  // rule-mapped lead-score value (not the raw 0-100 verification score —
  // that lives in phone_verification_cache and WorkspaceEntity).
  phoneStatus?: 'unverified' | 'format_valid' | 'otp_sent' | 'verified' | 'active' | 'failed' | 'invalid' | 'opted_out';
  phoneVerificationScore?: number;
  phoneVerifiedAt?: string;
  phoneVerificationMethod?: 'offline' | 'otp' | 'delivery';
  phoneType?: 'mobile' | 'fixed_line' | 'fixed_line_or_mobile' | 'voip' | 'premium_rate' | 'other';
  lastSmsDeliveredAt?: string;
  lastSmsFailedAt?: string;
  hasWhatsapp?: boolean; // Reserved for WhatsApp presence detection (v2) — modeled now, unpopulated
  // Engagement Tracking
  lastEngagedAt?: string; // ISO timestamp updated whenever a meaningful action occurs
  lastEmailOpenedAt?: string; // ISO timestamp for email open tracking
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Configurable contact type definitions per entity type.
 * Supports system/org/workspace override hierarchy.
 */
export interface ContactTypeTemplate {
  id: string;
  scopeType: 'system' | 'organization' | 'workspace';
  organizationId?: string;
  workspaceId?: string;
  entityType: EntityType;
  types: ContactTypeEntry[];
  updatedAt: string;
  updatedBy?: string;
}

export interface ContactTypeEntry {
  key: string;       // stable key: "manager"
  label: string;     // display: "Manager"
  active: boolean;
  order: number;
}


export interface Zone {
  id: string;
  name: string;
  organizationId?: string;
  isDefault?: boolean;
}

/**
 * A globally-scoped country record (seeded from ISO 3166-1 alpha-2).
 * Not org/workspace scoped — shared across the entire platform.
 */
export interface Country {
  id: string;       // ISO 3166-1 alpha-2 code (e.g. "GH")
  name: string;     // e.g. "Ghana"
  code: string;     // Same as id — kept for explicit access
  flag: string;     // Unicode emoji flag (e.g. "\uD83C\uDDEC\uD83C\uDDED")
  dialCode?: string; // e.g. "+233"
}

/**
 * An administrative region, scoped to an organization.
 * Belongs to a Country. Shared across all workspaces in the org.
 */
export interface Region {
  id: string;
  name: string;
  countryId: string;      // Reference to Country.id
  organizationId: string;
}

/**
 * An administrative district, scoped to an organization.
 * Belongs to a Region. Shared across all workspaces in the org.
 * Can be created inline when entering entity data.
 */
export interface District {
  id: string;
  name: string;
  regionId: string;       // Reference to Region.id
  organizationId: string;
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  workspaceIds: string[]; // Shared across workspaces
  stageIds: string[];
  accessRoles: string[];
  columnWidth?: number;
  isDefault?: boolean;
  isArchived?: boolean;
  createdAt: string;
  updatedAt?: string;
  assignmentStrategy?: 'direct' | 'round-robin' | 'value-based' | 'unassigned';
  assignmentUserIds?: string[];
}

export const APP_PERMISSIONS = [
  { id: 'schools_view', label: 'View Schools', category: 'Operations' },
  { id: 'schools_edit', label: 'Edit Profiles', category: 'Operations' },
  { id: 'prospects_view', label: 'View Prospects', category: 'Operations' },
  { id: 'finance_view', label: 'View Finance Hub', category: 'Finance' },
  { id: 'finance_manage', label: 'Manage Billing & Contracts', category: 'Finance' },
  { id: 'contracts_delete', label: 'Purge Legal Records', category: 'Finance' },
  { id: 'studios_view', label: 'View Design Studios', category: 'Studios' },
  { id: 'studios_edit', label: 'Create Content', category: 'Studios' },
  { id: 'dashboard_manage', label: 'Customize Dashboard Layout', category: 'Management' },
  { id: 'system_admin', label: 'Full System Management', category: 'Management' },
  { id: 'system_user_switch', label: 'Switch User Context', category: 'Management' },
  { id: 'meetings_manage', label: 'Schedule & Edit Meetings', category: 'Operations' },
  { id: 'tasks_manage', label: 'Manage CRM Tasks', category: 'Operations' },
  { id: 'activities_view', label: 'View Audit Timeline', category: 'Management' },
  { id: 'tags_view', label: 'View Tags', category: 'Operations' },
  { id: 'tags_manage', label: 'Manage Tags', category: 'Operations' },
  { id: 'tags_apply', label: 'Apply Tags to Contacts', category: 'Operations' },
  { id: 'forms_manage', label: 'Manage Forms', category: 'Studios' },
  { id: 'fields_manage', label: 'Manage Fields', category: 'Management' },
] as const;

export type AppPermissionId = typeof APP_PERMISSIONS[number]['id'];

export interface Role {
  id: string;
  organizationId: string;
  isDefault?: boolean;
  name: string;
  description: string;
  permissions: AppPermissionId[];
  /** Hierarchical permission structure (Permissions Expansion) */
  permissionsSchema?: PermissionsSchema;
  workspaceIds: string[];
  color: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  organizationId: string; // Users belong to one Org
  workspaceIds: string[]; // Users are assigned to one or more workspaces
  name: string;
  email: string;
  phone: string;
  photoURL?: string;
  isAuthorized: boolean;
  profileCompleted?: boolean;
  department?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  roles?: string[]; // Legacy global roles
  permissions?: AppPermissionId[]; // Legacy global permissions
  /** Hierarchical permission structure (Permissions Expansion) */
  permissionsSchema?: PermissionsSchema; // Legacy global schema
  
  /** Workspace-Specific Roles Mapping (workspaceId -> roleIds) */
  workspaceRoles?: Record<string, string[]>;
  /** Flattened permissions scoped per workspace */
  workspacePermissions?: Record<string, AppPermissionId[]>;
  /** Hydrated hierarchical schemas scoped per workspace */
  workspacePermissionsSchemas?: Record<string, PermissionsSchema>;

  // AI User Preferences
  preferredAiModel?: string;      // e.g., 'gemini-2.0-flash', 'gpt-4o'
  preferredAiProvider?: string;   // e.g., 'googleai', 'openrouter', 'openai'
  
  // Workspace and Organization Sticky Persistence
  lastActiveWorkspaceId?: string;
  lastActiveOrganizationId?: string;
  defaultWorkspaceId?: string;
  
  // Notification Preferences
  notificationPreferences?: NotificationPreferences;

  /** Backoffice roles for platform control plane access */
  backofficeRoles?: import('./backoffice/backoffice-types').BackofficeRole[];

  // Facilitator Profile (used in Meeting templates and presenter cards)
  /** Public-facing presenter role title, e.g. "Keynote Speaker", "Lead Trainer" */
  facilitatorRole?: string;
  /** Short biography shown on meeting pages and join screens */
  facilitatorBio?: string;

  createdAt: string;
}

export interface OnboardingStage {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  color?: string;
}

export interface School {
  id: string;
  /**
   * Organization identifier for multi-tenant isolation
   * 
   * This field anchors the school to an organization for proper data isolation.
   * In legacy data, this may not be present, so code should use the utility
   * function `getOrganizationId()` which provides a safe fallback to workspaceIds[0].
   * 
   * @see getOrganizationId utility function for safe access
   */
  organizationId?: string;
  name: string;
  initials?: string;
  slug: string;
  slogan?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  workspaceIds: string[]; // Shared
  workspaceId?: string; // Singular for backward compatibility
  status: SchoolStatusState;
  schoolStatus: string;

  entityContacts?: EntityContact[]; // Canonical contact data (FER-01)
  pipelineId: string;
  zone?: Zone;
  location?: string;
  billingAddress?: string;
  currency?: string;
  subscriptionPackageId?: string;
  subscriptionPackageName?: string;
  subscriptionRate?: number;
  discountPercentage?: number;
  nominalRoll?: number;
  arrearsBalance?: number;
  creditBalance?: number;
  modules?: {
    id: string;
    name: string;
    abbreviation: string;
    color: string;
  }[];
  implementationDate?: string;
  referee?: string;
  includeDroneFootage?: boolean;
  assignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  } | null;
  stage?: {
    id: string;
    name: string;
    order: number;
    color?: string;
  };
  track?: string;
  createdAt: string;
  updatedAt?: string; // ISO timestamp
  // Tagging fields
  tags?: string[];
  taggedAt?: { [tagId: string]: string };
  taggedBy?: { [tagId: string]: string };
  /**
   * @deprecated Migration is complete. All records use the unified entity-only model.
   */
  migrationStatus?: MigrationStatus;
  entityId?: string; // Reference to the unified entity (for migrated schools)
}

/**
 * Institution-specific data for entities with entityType: "institution"
 */
export interface InstitutionData {
  nominalRoll?: number;
  subscriptionPackageId?: string;
  subscriptionRate?: number;
  billingAddress?: string;
  currency?: string;
  modules?: {
    id: string;
    name: string;
    abbreviation: string;
    color: string;
  }[];
  implementationDate?: string; // ISO date string
  referee?: string;
  website?: string;
  initials?: string;
  slogan?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  discountPercentage?: number;
  arrearsBalance?: number;
  creditBalance?: number;
  location?: {
    zone?: { id: string; name: string };
    locationString?: string;
  };
}

/**
 * Family-specific data for entities with entityType: "family"
 */
export interface FamilyData {
  guardians: Guardian[];
  children: Child[];
  admissionsData?: Record<string, any>;
}

/**
 * Person-specific data for entities with entityType: "person"
 */
export interface PersonData {
  firstName: string;
  lastName: string;
  company?: string;
  jobTitle?: string;
  leadSource?: string;
}

/**
 * Unified Entity - represents a contact identity across all workspaces
 * Stores stable identity data only (no pipeline state, no workspace-specific tags)
 * 
 * Tag Storage (Requirement 7):
 * - globalTags: Identity-level tags visible across all workspaces (e.g., "vip", "strategic-account")
 *   These tags represent fundamental attributes of the entity that transcend workspace boundaries.
 */
/**
 * Consolidated finance data for all entity types
 * Replaces scattered billing fields across institutionData and industryData
 */
export interface FinanceData {
  planType?: string;
  subscriptionIds?: string[];
  currency?: string;
  billingAddress?: string;
  subscriptionRate?: number;
  customerTier?: 'basic' | 'pro' | 'enterprise';
  signupDate?: string;
  renewalDate?: string;
  paymentMethod?: 'card' | 'bank_transfer' | 'cash' | 'check';
  lastPaymentDate?: string;
  nextPaymentDue?: string;
  invoiceIds?: string[];
  paymentIds?: string[];
}

export interface Entity {
  id: string;
  organizationId: string;
  entityType: EntityType;
  name: string; // Display name (computed from firstName + lastName for person entities)
  slug?: string; // URL-safe identifier (for institution entities)
  
  // Institution-specific root fields (Moved from institutionData)
  initials?: string;
  logoUrl?: string;
  referee?: string;
  location?: {
    locationString?: string;
    zone?: {
      id: string;
      name: string;
    };
    /** Official country (from global countries collection) */
    country?: { id: string; name: string; code: string; flag: string };
    /** Administrative region (org-scoped) */
    region?: { id: string; name: string };
    /** Administrative district (org-scoped, can be created inline) */
    district?: { id: string; name: string };
  };

  entityContacts: EntityContact[]; // Canonical contact data (FER-01)
  contacts?: any[]; // @deprecated - legacy focal persons fallback
  
  // Finance Data (Consolidated)
  financeData?: FinanceData;
  
  globalTags: string[]; // Identity-level tags visible across all workspaces (Requirement 7)
  
  // Legacy modules/features migrated to root
  interests?: string[]; // Array of feature/module/interest IDs or names

  status?: 'active' | 'archived'; // Soft delete status
  createdAt: string;
  updatedAt: string;
  
  // Scope-specific data (only one will be populated based on entityType)
  familyData?: FamilyData;
  personData?: PersonData;
  
  // Industry-specific data (polymorphic, Requirement 3)
  industry?: IndustryVertical;
  industryData?: IndustryData;
  
  // Reserved for future cross-entity relationships
  relatedEntityIds?: string[];

  // Dynamic custom data bucket (Requirement: Phase 6)
  customData?: Record<string, any>;

  // Online Presence & Social Media
  onlinePresence?: OnlinePresence;
  leadScore?: number;
}

/**
 * Online Presence — digital address, social media, and web presence for an entity.
 * Lives as a flat sub-object on the Entity document.
 */
export interface OnlinePresence {
  website?: string;
  digitalAddress?: string;
  googleMapLocation?: string;
  googleBusinessProfile?: string;
  facebook?: string;
  whatsapp?: string;
  linkedin?: string;
  pinterest?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  x?: string; // formerly Twitter
}

/**
 * WorkspaceEntity - represents the operational relationship between an entity and a workspace
 * Stores workspace-specific state: assignee, workspace tags
 * 
 * Tag Storage (Requirement 7):
 * - workspaceTags: Operational tags scoped to this specific workspace (e.g., "hot-lead", "billing-issue")
 *   These tags represent workspace-specific state and are NOT visible in other workspaces.
 * 
 * Note: Pipeline tracking has been moved to the Deal model. WorkspaceEntity no longer tracks
 * pipeline stages directly. Use Deal records for opportunity/pipeline management.
 */
export interface WorkspaceEntity {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  entityType: EntityType;
  assignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  } | null;
  status: 'active' | 'archived';
  workspaceTags: string[]; // Workspace-scoped operational tags (Requirement 7)
  taggedAt?: { [tagId: string]: string }; // Tag assignment timestamps
  taggedBy?: { [tagId: string]: string }; // Tag assignment user IDs
  lastContactedAt?: string;
  addedAt: string;
  updatedAt: string;
  // Denormalized read-model fields for performance
  displayName: string;
  /** Lowercased, trimmed displayName for case-insensitive search (Phase 5.2). */
  displayNameLower?: string;
  primaryContactName?: string;
  primaryEmail?: string;  // Denormalized from entityContacts where isPrimary
  primaryPhone?: string;  // Denormalized from entityContacts where isPrimary
  entityContacts: EntityContact[]; // Denormalized contact data (FER-01)
  interests?: Partial<Module>[];
  entityName?: string; // Snapshot for backward compatibility
  logoUrl?: string;
  initials?: string;
  slogan?: string;
  location?: { locationString?: string; zone?: { id: string; name: string }; country?: { id: string; name: string; code: string; flag: string }; region?: { id: string; name: string }; district?: { id: string; name: string } };
  locationString?: string; // Legacy/flat location fallback
  nominalRoll?: number;
  implementationDate?: string;
  zone?: { id: string; name: string };
  modules?: Partial<Module>[];
  slug?: string;
  /** Denormalized location IDs for performant filtering */
  locationCountryId?: string;
  locationRegionId?: string;
  locationDistrictId?: string;

  // Social ROI attribution UTM fields
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;

  // Dynamic custom data bucket (Requirement: Phase 6)
  customData?: Record<string, any>;
  leadScore?: number;
  lastEngagedAt?: string; // Rolled-up engagement timestamp for fast filtering

  // Denormalized phone verification fields (raw 0-100 score; see phone_verification_cache)
  phoneVerificationStatus?: string;
  phoneVerificationScore?: number;
  lastPhoneVerifiedAt?: string;
  phoneVerificationDetails?: Record<string, any>;
}

export interface DealContact {
  entityId: string;
  role: string;          // e.g., 'Decision Maker', 'Billing', 'Evaluator', 'Parent'
  name?: string;
  email?: string;
}

/**
 * DealFocalContact — a focal person selected from the deal's OWN entity's
 * `entityContacts[]`. Distinct from `DealContact` (which links contacts from
 * OTHER entities). Captured at deal creation; the `id` mirrors the source
 * `EntityContact.id`.
 */
export interface DealFocalContact {
  id: string;            // Source EntityContact.id within the entity
  name: string;
  email?: string;
  phone?: string;
  role?: string;         // EntityContact.typeLabel (e.g., 'Decision Maker', 'Primary Parent')
}

/**
 * Deal (Opportunity) - represents an independent transactional record
 * Multiple deals can be linked to a single Entity within a workspace.
 */
export interface Deal {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;           // Link back to the Unified Entity
  pipelineId: string;
  stageId: string;
  stageName?: string;         // Denormalized at creation — avoids client-side stage collection lookups
  name: string;               // e.g., "Lincoln Academy Expansion 2026"
  value: number;              // Deal value
  propertyId?: string;        // Optional property reference for real estate deals
  status: 'open' | 'won' | 'lost';
  lostReason?: string | null; // Captures why the deal was closed lost
  contacts?: DealContact[];   // Associated secondary contacts (from OTHER entities)
  focalContacts?: DealFocalContact[]; // Focal persons from THIS deal's entity
  assignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  } | null;
  expectedCloseDate?: string | null;
  description?: string | null;
  customFields?: Record<string, any>; // Persists across workspaces
  createdAt: string;
  updatedAt: string;
}

/**
 * Unified contact object returned by the adapter layer (Requirement 18)
 * 
 * This interface represents a resolved contact that can come from either:
 * - Legacy schools collection (when migrationStatus is "legacy")
 * - New entities + workspace_entities model (when migrationStatus is "migrated")
 * 
 * The adapter layer uses this interface to provide a consistent API for
 * accessing contact data regardless of the underlying storage model.
 */
export interface ResolvedContact {
  id: string;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  entityContacts: EntityContact[]; // Canonical contact data (FER-01)
  contacts?: any[]; // @deprecated - legacy focal persons array fallback
  // Workspace-specific operational state
  pipelineId?: string;
  stageId?: string;
  stageName?: string;
  assignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  } | null;
  status?: string;
  tags?: string[]; // Workspace tags for the active workspace
  globalTags?: string[]; // Global identity tags (only for migrated entities)
  // Entity metadata
  entityType?: EntityType | null;
  entityId?: string | null;
  workspaceEntityId?: string | null;
  
  // Primary Contact Details (Denormalized for convenience)
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  
  // Signatory Details
  signatoryName?: string;
  signatoryEmail?: string;
  signatoryPhone?: string;

  // Identity & Location
  initials?: string;
  referee?: string;
  locationString?: string;
  zoneName?: string;

  // Migration tracking
  /**
   * @deprecated Migration is complete. All records use the unified entity-only model. Always returns 'migrated'.
   */
  migrationStatus: MigrationStatus;
  // Legacy school data (for backward compatibility)
  schoolData?: School;
  
  // Data Buckets (Requirement: Phase 6)
  industryData?: any;
  financeData?: any;
  personData?: any;
  familyData?: any;
  customData?: any;
}

export interface SubscriptionPackage {
  id: string;
  workspaceIds: string[]; // Shared
  name: string;
  description: string;
  ratePerStudent: number;
  billingTerm: 'term' | 'semester' | 'year';
  currency: string;
  isActive: boolean;
}

export interface BillingPeriod {
  id: string;
  workspaceIds: string[]; // Shared
  name: string;
  startDate: string;
  endDate: string;
  invoiceDate: string;
  paymentDueDate: string;
  status: 'open' | 'closed';
}

export interface InvoiceItem {
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue';

export interface Invoice {
  id: string;
  entityName?: string | null;
  invoiceNumber: string;
  entityId?: string | null; // Unified entity reference
  entityType?: EntityType | null; // Type of entity
  periodId: string;
  periodName: string;
  nominalRoll: number;
  packageId: string;
  packageName: string;
  ratePerStudent: number;
  currency: string;
  subtotal: number;
  discount: number;
  levyAmount: number;
  vatAmount: number;
  arrearsAdded: number;
  creditDeducted: number;
  totalPayable: number;
  status: InvoiceStatus;
  items: InvoiceItem[];
  paymentInstructions: string;
  signatureName: string;
  signatureDesignation: string;
  signatureUrl?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  workspaceIds: string[]; // Shared
  billingProfileId: string;
}

export interface Meeting {
  id: string;
  title?: string;
  /** Canonical SEO & social-sharing config for the public meeting page. @see SeoConfig */
  seo?: SeoConfig;
  // ── V3: Standalone URL routing ──────────────────
  meetingSlug: string; // Unique slug for public URL: /meetings/[type]/[meetingSlug]
  // ── V3: Branding controls ──────────────────────
  logoUrl?: string; // Per-meeting logo override (falls back to entity logo)
  brandingName?: string; // Manual branding name override
  brandingSlogan?: string; // Manual branding slogan override
  brandingEnabled?: boolean; // Default true; false hides logo, entity name, slogan
  heroLayout?: 'image' | 'form'; // 'image' = hero image right (default), 'form' = registration form right
  // ── V3: Banner controls ──────────────────────
  bannerType?: 'none' | 'image' | 'embed'; // 'none' (default)
  bannerImageUrl?: string;
  bannerEmbedCode?: string;
  // ── Entity reference (now optional) ─────────────
  entityId?: string; // Unified entity reference
  entityName?: string | null; // Snapshot of entity name
  entitySlug?: string; // Legacy URL slug (kept for backward compat)
  entityType?: EntityType; // Type of entity
  workspaceIds: string[]; // Shared
  meetingTime: string;
  meetingLink: string;
  type: MeetingType;
  heroImageUrl?: string;
  // Editable hero content overrides (Phase 1 - Meetings V2)
  heroTitle?: string;
  heroDescription?: string;
  heroTagline?: string;
  heroCtaLabel?: string;
  // Registration configuration (Phase 2 - Meetings V2)
  registrationEnabled?: boolean;
  registrationRequiredToJoin?: boolean;
  registrationMode?: 'open' | 'approval_required';
  registrationFields?: MeetingRegistrationField[];
  registrationSuccessMessage?: string;
  capacityLimit?: number;
  waitlistEnabled?: boolean;
  recordingUrl?: string;
  brochureUrl?: string;
  resourceUrl?: string;
  feedbackFormUrl?: string;
  durationMinutes?: number;
  // ── Facilitators ───────────────────────────────────────────────────────
  facilitators?: MeetingFacilitator[];

  // ── Lead Capture ───────────────────────────────────────────────────────
  createEntity?: boolean;
  entityMapping?: MeetingEntityMapping;
  autoTags?: string[];           // Tag IDs to auto-apply to new/matched entities
  autoAutomations?: string[];    // Automation IDs to trigger for new entities

  // ── Messaging ──────────────────────────────────────────────────────────
  messagingConfig?: MeetingMessagingConfig;
  organizationId?: string;

  // ── Publishing ─────────────────────────────────────────────────────────  // Phase 7: Publish Status
  publishStatus?: 'draft' | 'published' | 'archived';
  status?: 'scheduled' | 'active' | 'ended' | 'cancelled';
  endedAt?: string;
}

// ── Meeting Facilitator ────────────────────────────────────────────────────
export interface MeetingFacilitator {
  id: string; // Unique ID for this facilitator mapping
  type: 'workspace_user' | 'custom';
  userId?: string; // If workspace_user
  name: string;
  role?: string;
  bio?: string; // Per-meeting bio — auto-filled from workspace user profile, manually editable
  email?: string;
  phone?: string;
  image?: string; // photoURL or custom uploaded image
  joinLink: string; // unique join link
}

// ── Meeting Entity Mapping ─────────────────────────────────────────────────
export interface MeetingEntityMapping {
  entityNameFieldKey?: string;      // registration field key for entity name
  contactNameFieldKey?: string;     // registration field key for contact name
  contactEmailFieldKey?: string;    // registration field key for email
  contactPhoneFieldKey?: string;    // registration field key for phone
  additionalMappings?: { fieldKey: string; targetField: string }[];
}

// ── Meeting Reminder Slot ──────────────────────────────────────────────────
export interface MeetingReminderSlot {
  id: string;
  offsetMinutes: number;
  offsetLabel: string;
  emailTemplateId?: string;
  smsTemplateId?: string;
  channels: ('email' | 'sms')[];
  enabled: boolean;
}

// ── Meeting Invitation Slot ──────────────────────────────────────────────────
export interface MeetingInvitationSlot {
  id: string; // e.g. 'initial', '1_month', '1_week', '5_days', '3_days', '2_days', '1_day', 'today', 'last_chance'
  label: string;
  emailTemplateId?: string;
  smsTemplateId?: string;
  channels: ('email' | 'sms')[];
  enabled: boolean;
  scheduledDate?: string; // ISO datetime string for 'initial' (Legacy/Fallback)
  scheduledTime?: string; // HH:mm time string for other relative stages (Legacy/Fallback)
  emailScheduledDate?: string; // ISO datetime string for 'initial' email
  smsScheduledDate?: string;   // ISO datetime string for 'initial' SMS
  emailScheduledTime?: string; // HH:mm time string for relative email stages
  smsScheduledTime?: string;   // HH:mm time string for relative SMS stages
}

export const DEFAULT_GLOBAL_INVITATION_TEMPLATE_ID = 'global_meeting_invitation_initial_email';

export const getDefaultMeetingMessagingConfig = (): MeetingMessagingConfig => ({
  registrationAckEnabled: false,
  registrationAckChannels: ['email'],
  facilitatorRemindersEnabled: false,
  facilitatorPostEventEnabled: false,
  facilitatorChannels: ['email'],
  reminders: [],
  invitationsEnabled: false,
  invitationSeries: [
    { id: 'initial', label: 'Initial Invitation', emailTemplateId: DEFAULT_GLOBAL_INVITATION_TEMPLATE_ID, channels: ['email'], enabled: true },
    { id: '1_month', label: '1 Month Before', channels: ['email'], enabled: false },
    { id: '1_week', label: '1 Week Before', channels: ['email'], enabled: false },
    { id: '5_days', label: '5 Days Before', channels: ['email'], enabled: false },
    { id: '3_days', label: '3 Days Before', channels: ['email'], enabled: false },
    { id: '2_days', label: '2 Days Before', channels: ['email'], enabled: false },
    { id: '1_day', label: '1 Day Before', channels: ['email'], enabled: false },
    { id: 'today', label: 'Happening Today', channels: ['email'], enabled: false },
    { id: 'last_chance', label: 'Time Up - Last Chance', channels: ['email'], enabled: false },
  ],
  postEventEnabled: false,
  postEventDelayMinutes: 60,
  postEventAudience: 'attendees_only',
  postEventChannels: ['email'],
  postEventAbsenteeEnabled: false,
  rescheduleEnabled: false,
  rescheduleChannels: ['email'],
  cancelEnabled: false,
  cancelChannels: ['email'],
  resendLinkEmailTemplateId: 'global_meeting_resend_join_link_email',
  resendLinkSmsTemplateId: 'global_meeting_resend_join_link_sms',
});

// ── Meeting Messaging Config ───────────────────────────────────────────────
export interface MeetingMessagingConfig {
  // Registration Ack (to registrant)
  registrationAckEnabled: boolean;
  registrationAckEmailTemplateId?: string;
  registrationAckSmsTemplateId?: string;
  registrationAckChannels: ('email' | 'sms')[];

  // Facilitators (internal team)
  facilitatorRemindersEnabled: boolean;
  facilitatorRemindersEmailTemplateId?: string;
  facilitatorRemindersSmsTemplateId?: string;
  
  facilitatorPostEventEnabled: boolean;
  facilitatorPostEventEmailTemplateId?: string;
  facilitatorPostEventSmsTemplateId?: string;
  facilitatorChannels: ('email' | 'sms')[];

  // Custom Reminders (to registrants)
  reminders: MeetingReminderSlot[];

  // Invitation Series (to pending registrants)
  invitationsEnabled: boolean;
  invitationSeries: MeetingInvitationSlot[];

  // Post-Event Follow-Up
  postEventEnabled: boolean;
  postEventDelayMinutes: number;
  postEventAudience: 'all_registrants' | 'attendees_only';
  postEventEmailTemplateId?: string;
  postEventSmsTemplateId?: string;
  postEventChannels: ('email' | 'sms')[];

  // Absentee Follow-Up
  postEventAbsenteeEnabled: boolean;
  postEventAbsenteeEmailTemplateId?: string;
  postEventAbsenteeSmsTemplateId?: string;

  // Reschedule Notifications
  rescheduleEnabled: boolean;
  rescheduleEmailTemplateId?: string;
  rescheduleSmsTemplateId?: string;
  rescheduleChannels: ('email' | 'sms')[];
  rescheduleFacilitatorEmailTemplateId?: string;
  rescheduleFacilitatorSmsTemplateId?: string;
  rescheduleRegistrantEmailTemplateId?: string;
  rescheduleRegistrantSmsTemplateId?: string;

  // Cancellation Notifications
  cancelEnabled: boolean;
  cancelEmailTemplateId?: string;
  cancelSmsTemplateId?: string;
  cancelChannels: ('email' | 'sms')[];
  cancelFacilitatorEmailTemplateId?: string;
  cancelFacilitatorSmsTemplateId?: string;
  cancelRegistrantEmailTemplateId?: string;
  cancelRegistrantSmsTemplateId?: string;

  // Resend Link Configuration
  resendLinkEmailTemplateId?: string;
  resendLinkSmsTemplateId?: string;

  // Outbound Registration Webhook
  /** When enabled, a signed JSON POST is sent to registrationWebhookUrl on every new registration */
  registrationWebhookEnabled?: boolean;
  /** HTTPS endpoint that will receive the registration webhook payload */
  registrationWebhookUrl?: string;
  /** Optional HMAC-SHA256 secret used to sign payloads via X-SmartSapp-Signature header */
  registrationWebhookSecret?: string;
}

export interface MeetingRegistrationField {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'multiselect' | 'checkbox' | 'textarea';
  required: boolean;
  options?: string[];
  placeholder?: string;
  order: number;
}

export type MeetingRegistrantStatus = 'registered' | 'approved' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show' | 'pending';

export interface MeetingRegistrant {
  id: string;
  meetingId: string;
  workspaceIds: string[];
  token: string;
  status: MeetingRegistrantStatus;
  source?: 'invite' | 'one-click' | 'direct' | 'admin';
  entityId?: string; // Links back to the WorkspaceEntity or unified Entity
  registrationData: Record<string, any>;
  name: string;
  email?: string;
  phone?: string;
  registeredAt: string;
  approvedAt?: string;
  attendedAt?: string;
  cancelledAt?: string;
  personalizedMeetingUrl?: string;
  lastInviteSentAt?: string;
  lastReminderSentAt?: string;
  sentInvitations?: Record<string, string>; // Record of invitation stages sent (e.g., { initial: '2025-01-01T...', '1_week': '2025-01-07T...' })
}

/**
 * Meeting Template — used in the template gallery for creating meetings.
 * Built-in templates are read-only; custom templates are workspace-scoped.
 */
export interface MeetingTemplate {
  id: string;
  name: string;
  description: string;
  thumbnailUrl?: string;
  typeId: string; // Maps to MEETING_TYPES[n].id
  typeName: string;
  isBuiltIn: boolean;
  workspaceId?: string; // null for built-ins; workspace-scoped for custom
  organizationId?: string;
  defaults: {
    heroTitle?: string;
    heroDescription?: string;
    heroTagline?: string;
    heroCtaLabel?: string;
    heroImageUrl?: string;
    brandingEnabled?: boolean;
    heroLayout?: 'image' | 'form';
    registrationEnabled?: boolean;
    registrationFields?: MeetingRegistrationField[];
    registrationSuccessMessage?: string;
    capacityLimit?: number;
  };
  createdAt: string;
  createdBy?: string;
}

/** Built-in meeting templates (static data, not Firestore) */
export const BUILT_IN_TEMPLATES: MeetingTemplate[] = [
  {
    id: 'builtin-parent-engagement',
    name: 'Parent Engagement',
    description: 'Engage parents with school updates, Q&A sessions, and collaborative discussions.',
    typeId: 'parent',
    typeName: 'Parent Engagement',
    isBuiltIn: true,
    defaults: {
      heroTitle: 'Parent Engagement Session',
      heroDescription: 'Join us for an interactive session to discuss your child\'s progress and school initiatives.',
      heroCtaLabel: 'Join Session',
      brandingEnabled: true,
      heroLayout: 'image',
    },
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin-kickoff',
    name: 'School Kickoff',
    description: 'Welcome session to introduce new programs, staff, and term objectives.',
    typeId: 'kickoff',
    typeName: 'Kickoff',
    isBuiltIn: true,
    defaults: {
      heroTitle: 'Kickoff Meeting',
      heroDescription: 'Let\'s kick off the new term together. Join us for important updates and introductions.',
      heroCtaLabel: 'Join Kickoff',
      brandingEnabled: true,
      heroLayout: 'image',
    },
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin-training',
    name: 'Staff Training',
    description: 'Training sessions for staff development, tool onboarding, and skill building.',
    typeId: 'training',
    typeName: 'Training',
    isBuiltIn: true,
    defaults: {
      heroTitle: 'Training Session',
      heroDescription: 'Professional development session to enhance your skills and knowledge.',
      heroCtaLabel: 'Join Training',
      brandingEnabled: true,
      heroLayout: 'image',
    },
    createdAt: '2025-01-01T00:00:00Z',
  },
  {
    id: 'builtin-webinar',
    name: 'Public Webinar',
    description: 'Public-facing webinar with registration, capacity limits, and audience engagement.',
    typeId: 'webinar',
    typeName: 'Webinar',
    isBuiltIn: true,
    defaults: {
      heroTitle: 'Live Webinar',
      heroDescription: 'Register for our upcoming webinar and join the conversation.',
      heroCtaLabel: 'Register Now',
      brandingEnabled: true,
      heroLayout: 'form',
      registrationEnabled: true,
    },
    createdAt: '2025-01-01T00:00:00Z',
  },
];

export interface MediaCategory {
  id: string;
  name: string;
  workspaceId: string;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  url: string;
  fullPath?: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'link';
  workspaceIds: string[]; // Shared
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  uploadedBy: string;
  createdAt: string;
  linkTitle?: string;
  linkDescription?: string;
  previewImageUrl?: string;
  category?: string;
}

export interface SurveyEntityDefaults {
  // Finance / contact
  currency?: string;
  subscriptionPackageName?: string;
  subscriptionRate?: number;
  contactTypeKey?: string;

  // SchoolEnrollment institution
  gradeOfferings?: string[];
  academicYear?: string;
  capacity?: number;
  currentEnrollment?: number;


  activeUsers?: number;

  // SaaS / Consultancy / Marketing person
  role?: string;
  activationStatus?: 'pending' | 'active' | 'inactive';
  influenceLevel?: 'decision-maker' | 'influencer' | 'user';
  approvalAuthority?: boolean;
  department?: string;
  decisionMakingStyle?: 'fast' | 'consensus' | 'hierarchical';

  // Law institution
  firmType?: 'solo' | 'partnership' | 'corporate';
  practiceAreas?: string[];
  conflictCheckRequired?: boolean;

  // Law person
  clientType?: 'individual' | 'company' | 'buyer' | 'seller' | 'tenant' | 'landlord' | 'investor';
  urgency?: 'low' | 'medium' | 'high' | 'critical';

  // Marketing / Consultancy institution
  clientIndustry?: string;

  // RealEstate person
  preferredLocations?: string[];
}

/**
 * Workspace-level default values applied when creating entities via any flow
 * (bulk import, new entity page, survey submissions).
 * Keys are entity field paths, values are default strings.
 * Scoped by entity type (institution/family/person).
 */
export interface EntityDefaults {
  institution?: Record<string, string>;
  family?: Record<string, string>;
  person?: Record<string, string>;
}

export interface SurveyEntityMapping {
  entityNameFieldId?: string;
  contactNameFieldId?: string;
  contactEmailFieldId?: string;
  contactPhoneFieldId?: string;
  additionalMappings?: { questionId: string; targetField: string }[];
}

export interface Survey {
  id: string;
  organizationId?: string;
  workspaceIds: string[]; // Shared
  internalName: string;
  title: string;
  description: string;
  slug: string;
  logoUrl?: string;
  bannerImageUrl?: string;
  videoUrl?: string;
  videoThumbnailUrl?: string;
  videoCaption?: string;
  status: 'draft' | 'published' | 'archived';
  elements: SurveyElement[];
  entityId?: string | null; // Unified entity reference (formerly schoolId)
  entityName?: string | null; // Snapshot of entity name
  createdAt: string;
  updatedAt: string;
  scoringEnabled?: boolean;
  maxScore?: number;
  scoreDisplayMode?: 'points' | 'percentage';
  resultRules?: SurveyResultRule[];
  thankYouTitle?: string;
  thankYouDescription?: string;
  startButtonText?: string;
  submitButtonText?: string;
  embedRedirectMode?: 'modal' | 'parent';
  showCoverPage?: boolean;
  showIntroAsPage?: boolean;
  stepperVariant?: 'full' | 'simple';
  showSurveyTitles?: boolean;
  questionTitleBold?: boolean;
  optionsColumns?: number;
  showBranding?: boolean;
  backgroundColor?: string;
  backgroundPattern?: 'none' | 'dots' | 'grid' | 'circuit' | 'topography' | 'cubes' | 'gradient';
  patternColor?: string;
  webhookEnabled?: boolean;
  webhookId?: string;
  showDebugProcessingModal?: boolean;
  adminAlertsEnabled?: boolean;
  adminAlertChannel?: 'email' | 'sms' | 'whatsapp' | 'both';
  adminAlertNotifyManager?: boolean;
  adminAlertSpecificUserIds?: string[];
  adminAlertEmailTemplateId?: string;
  adminAlertSmsTemplateId?: string;
  adminAlertWhatsappTemplateId?: string;
  externalAlertsEnabled?: boolean;
  externalAlertChannel?: 'email' | 'sms' | 'whatsapp' | 'both';
  externalAlertContactTypes?: string[];
  externalAlertEmailTemplateId?: string;
  externalAlertSmsTemplateId?: string;
  externalAlertWhatsappTemplateId?: string;
  useEntityLogo?: boolean;
  logoMode?: 'organization' | 'custom' | 'placeholder';
  // Entity Creation & Assignment (Task 12)
  createEntity?: boolean;
  entityMapping?: SurveyEntityMapping;
  assignmentEnabled?: boolean;
  assignedUsers?: string[];
  notifyAssignedUsers?: {
    email: boolean;
    sms: boolean;
    emailTemplateId?: string;
    smsTemplateId?: string;
  };
  autoTags?: string[];
  autoAutomations?: string[];
  allowCrossVisibility?: boolean; // When true, assigned users can see all submissions (default: false = own only)
  allowResubmission?: boolean; // When true, shows "Submit Another Response" button on thank you/result pages
  aiMetadata?: {
    isAiGenerated: boolean;
    learningSignalId: string;
    isFirstPublishComplete: boolean;
  };
  // SEO & Social Configuration
  /**
   * Canonical SEO config. Reads should prefer this object.
   * @see SeoConfig
   */
  seo?: SeoConfig;
  /** @deprecated Use {@link Survey.seo}.title. Retained for backward-compat during migration. */
  seoTitle?: string;
  /** @deprecated Use {@link Survey.seo}.description. */
  seoDescription?: string;
  /** @deprecated Use {@link Survey.seo}.keywords. */
  seoKeywords?: string;
  /** @deprecated Use {@link Survey.seo}.ogImageUrl. */
  seoOgImage?: string;
  /** @deprecated Use {@link Survey.seo}.ogImageMode (`survey_banner` maps to `asset`). */
  seoOgImageMode?: 'survey_banner' | 'entity_logo' | 'custom';
  /** @deprecated Use {@link Survey.seo}.useContentFallback. */
  seoUseSurveyFallback?: boolean;
  leadCaptureMode?: 'questions' | 'form';
  leadCaptureTitle?: string;
  leadCaptureDescription?: string;
  leadCaptureFieldsConfig?: LeadCaptureFieldsConfig;
  thankYouRedirectEnabled?: boolean;
  thankYouRedirectUrl?: string;
  thankYouConfettiEnabled?: boolean;
}

export interface LeadCaptureFieldSetting {
  show: boolean;
  label: string;
  required: boolean;
}

export interface LeadCaptureFieldsConfig {
  name: LeadCaptureFieldSetting;
  email: LeadCaptureFieldSetting;
  phone: LeadCaptureFieldSetting;
  company: LeadCaptureFieldSetting;
}

export interface SurveyElement {
  id: string;
  type: string;
  title?: string;
  hidden?: boolean;
  style?: {
    textAlign?: 'left' | 'center' | 'right' | 'justify';
  };
}

export interface SurveyQuestion extends SurveyElement {
  type: 'text' | 'long-text' | 'yes-no' | 'multiple-choice' | 'checkboxes' | 'dropdown' | 'rating' | 'date' | 'time' | 'file-upload' | 'email' | 'phone' | 'number' | 'link';
  title: string;
  description?: string;
  isRequired: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: string[];
  allowOther?: boolean;
  minLength?: number;
  maxLength?: number;
  minSelections?: number;
  maxSelections?: number;
  enableScoring?: boolean;
  optionScores?: number[];
  yesScore?: number;
  noScore?: number;
  autoAdvance?: boolean;
  isFilterField?: boolean;
}

export interface SurveyLayoutBlock extends SurveyElement {
  type: 'heading' | 'description' | 'divider' | 'image' | 'video' | 'audio' | 'document' | 'embed' | 'section';
  variant?: 'h1' | 'h2' | 'h3';
  text?: string;
  url?: string;
  html?: string;
  renderAsPage?: boolean;
  validateBeforeNext?: boolean;
  stepperTitle?: string;
  description?: string; // For section descriptions
  showSectionHeader?: boolean; // Controls visibility of section title/description on client (defaults to true)
  thumbnailUrl?: string;
}

export interface SurveyLogicBlock extends SurveyElement {
  type: 'logic';
  rules: {
    sourceQuestionId: string;
    operator: 'isEqualTo' | 'isNotEqualTo' | 'contains' | 'doesNotContain' | 'startsWith' | 'doesNotStartWith' | 'endsWith' | 'doesNotEndWith' | 'isEmpty' | 'isNotEmpty' | 'isGreaterThan' | 'isLessThan';
    targetValue?: any;
    action: {
      type: 'jump' | 'require' | 'show' | 'hide' | 'disableSubmit';
      targetElementId?: string;
      targetElementIds?: string[];
    };
  }[];
}

export interface SurveyResultRule {
  id: string;
  label: string;
  minScore: number;
  maxScore: number;
  priority: number;
  pageId: string;
  emailTemplateId?: string;
  emailSenderProfileId?: string;
  smsTemplateId?: string;
  smsSenderProfileId?: string;
  redirectEnabled?: boolean;
  redirectUrl?: string;
}

export interface SurveyResultPage {
  id: string;
  name: string;
  isDefault: boolean;
  blocks: SurveyResultBlock[];
  confettiEnabled?: boolean;
}

export interface SurveyResultBlock {
  id: string;
  type: 'heading' | 'text' | 'image' | 'video' | 'audio' | 'button' | 'quote' | 'divider' | 'score-card' | 'list' | 'logo' | 'header' | 'footer';
  title?: string;
  content?: string;
  url?: string;
  link?: string;
  openInNewTab?: boolean;
  variant?: 'h1' | 'h2' | 'h3';
  listStyle?: 'ordered' | 'unordered';
  items?: string[];
  style?: {
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    variant?: string;
    animate?: boolean;
    color?: string;
    backgroundColor?: string;
    padding?: string;
    width?: string;
  };
  thumbnailUrl?: string;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  submittedAt: string;
  score?: number;
  answers: {
    questionId: string;
    value: any;
  }[];
  entityId?: string | null; // Unified entity reference
  entityName?: string | null; // Snapshot for display
  entityType?: EntityType; // Type of entity
  workspaceId?: string | null; // Workspace context at time of submission
  assignedUserId?: string; // User who shared the survey link
  sourcePageId?: string | null;
}

export interface SurveySummary {
  id: string;
  summary: string;
  createdAt: string;
  prompt?: string;
  provider?: string;
  modelId?: string;
}

export interface SurveySession {
  id: string;
  surveyId: string;
  maxStepReached: number;
  isSubmitted: boolean;
  updatedAt: string;
  assignedUserId?: string; // The representative who shared the link (from ?ref= param)
  startedAt?: string; // First visit timestamp for completion time calculation
}

export interface LearningSignal {
  id: string;
  organizationId: string;
  workspaceId: string;
  userId: string;
  prompt: string;
  modelId: string;
  provider: string;
  artifactType: 'survey' | 'form' | 'page' | 'pdf' | 'template' | 'script' | 'automation';
  initialState: any;
  finalState?: any;
  touchedFields?: string[];
  validationErrors?: string[];
  validationSuccess?: boolean;
  userRating?: number;
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  editDistance?: number; // Normalized delta between initial and final
}

export interface PdfSession {
  id: string;
  pdfId: string;
  maxPageReached: number;
  isSubmitted: boolean;
  updatedAt: string;
}

export interface PDFForm {
  id: string;
  organizationId?: string; // Organization context for multi-tenant support
  workspaceIds: string[]; // Shared
  name: string;
  publicTitle: string;
  /** Canonical SEO & social-sharing config for the public signing-document page. @see SeoConfig */
  seo?: SeoConfig;
  slug: string;
  storagePath: string;
  downloadUrl: string;
  status: 'draft' | 'published' | 'archived';
  fields: PDFFormField[];
  namingFieldId?: string | null;
  displayFieldIds?: string[];
  isContractDocument?: boolean;
  passwordProtected?: boolean;
  password?: string;
  backgroundColor?: string;
  backgroundPattern?: 'none' | 'dots' | 'grid' | 'circuit' | 'topography' | 'cubes' | 'gradient';
  patternColor?: string;
  logoUrl?: string;
  entityId?: string | null; // Unified entity reference
  entityName?: string | null; // Snapshot of entity name
  webhookEnabled?: boolean;
  webhookId?: string;
  showDebugProcessingModal?: boolean;
  confirmationMessagingEnabled?: boolean;
  confirmationTemplateId?: string;
  confirmationSenderProfileId?: string;
  adminAlertsEnabled?: boolean;
  adminAlertChannel?: 'email' | 'sms' | 'whatsapp' | 'both';
  adminAlertNotifyManager?: boolean;
  adminAlertSpecificUserIds?: string[];
  adminAlertEmailTemplateId?: string;
  adminAlertSmsTemplateId?: string;
  adminAlertWhatsappTemplateId?: string;
  resultsShared?: boolean;
  resultsPassword?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PDFFormField {
  id: string;
  label: string;
  type: string;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  pageNumber: number;
  required?: boolean;
  fontSize?: number;
  alignment?: 'left' | 'center' | 'right';
  verticalAlignment?: 'top' | 'center' | 'bottom';
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textTransform?: 'none' | 'uppercase' | 'capitalize';
  placeholder?: string;
  options?: string[];
  staticText?: string;
  variableKey?: string;
}

export interface Submission {
  id: string;
  pdfId: string;
  submittedAt: string;
  formData: { [key: string]: any };
  status: 'submitted' | 'partial';
  entityId?: string | null; // Unified entity reference
  entityType?: EntityType; // Type of entity
}

export interface Contract {
  id: string;
  entityId: string;
  entityName: string;
  pdfId: string;
  pdfName: string;
  status: ContractStatus;
  submissionId?: string;
  signedAt?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  emailTemplateId?: string;
  smsTemplateId?: string;
  recipients: { name: string; email?: string; phone?: string; type: string }[];
}

export type ContractStatus = 'no_contract' | 'draft' | 'sent' | 'partially_signed' | 'signed' | 'expired';

export interface Activity {
  id: string;
  organizationId: string; // Organization tenant identifier
  workspaceId: string; // Strictly confined
  entityId?: string | null; // Unified entity reference
  entityType?: EntityType | null; // Type of entity
  displayName?: string; // Denormalized entity name at time of logging
  entityName?: string | null; // Historical entity name snapshot
  entitySlug?: string; // Denormalized slug for historical readability
  userId?: string | null;
  type: string;
  source: string;
  timestamp: string;
  createdAt?: string; // Alias for timestamp for backward compatibility
  description: string;
  metadata?: any;
}

export interface Task {
  id: string;
  entityName?: string | null;
  organizationId?: string; // Organization context for multi-tenant support
  workspaceId: string; // Strictly confined
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  assignedTo: string | string[];
  assignedToName?: string;
  assignedToNames?: string[];
  entityId?: string | null; // Unified entity reference
  entityType?: EntityType; // Type of entity
  dueDate: string;
  startDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  source?: 'manual' | 'automation' | 'system';
  automationId?: string;
  attachments?: TaskAttachment[];
  notes?: TaskNote[];
  reminders: TaskReminder[];
  reminderSent: boolean;
  relatedEntityType?: 'SurveyResponse' | 'Submission' | 'Meeting' | 'School' | 'Deal' | null;
  relatedParentId?: string | null; // e.g. Survey ID or PDF ID
  relatedEntityId?: string | null; // e.g. Response ID
}

export interface TaskNote {
  id: string;
  content: string;
  createdAt: string;
  authorName?: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  createdAt: string;
}

export interface TaskReminder {
  reminderTime: string;
  channels: ('notification' | 'email' | 'sms')[];
  sent: boolean;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'review' | 'done';
export type TaskCategory = 'call' | 'visit' | 'document' | 'training' | 'follow_up' | 'general';

export interface Automation {
  id: string;
  workspaceIds: string[]; // Shared
  name: string;
  description?: string;
  isArchived?: boolean;

  /**
   * First-class multi-trigger array.
   * Each entry has its own type and isolated config.
   * The automation fires if ANY trigger def matches the incoming event.
   */
  triggers: AutomationTriggerDef[];

  /**
   * Denormalized flat array of trigger type strings for Firestore array-contains queries.
   * Always kept in sync with triggers[].type by serializeBlueprint.
   * Example: ['TAG_ADDED', 'FORM_SUBMITTED']
   */
  triggerTypes: string[];

  nodes: any[];
  edges: any[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  triggerConfig?: TagTriggerConfig;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isActive: boolean;
  workspaceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

/**
 * Automation Event Payload (Requirement 10.1)
 * 
 * Standard payload structure for all automation engine events.
 * Ensures workspace context is carried with every event so that automations
 * in one workspace cannot accidentally trigger actions intended for another workspace.
 * 
 * This addresses Risk 8 (Automation Context Confusion) from the requirements.
 */
export interface AutomationEventPayload {
  /** Organization ID - root tenant identifier */
  organizationId: string;
  /** Workspace ID - operational context where the event occurred */
  workspaceId: string;
  /** Entity ID - the contact/entity that triggered the event */
  entityId: string;
  /** Entity Type - institution, family, or person */
  entityType: EntityType;
  /** Action - the specific action that triggered the event (e.g., 'school_created', 'tag_added') */
  action: string;
  /** Actor ID - the user who performed the action (null for system actions) */
  actorId: string | null;
  /** Timestamp - ISO 8601 timestamp when the event occurred */
  timestamp: string;
  /** Additional context data specific to the event type */
  [key: string]: any;
}

export interface AutomationAction {
  type: 'SEND_MESSAGE' | 'CREATE_TASK' | 'UPDATE_FIELD' | 'WEBHOOK' | 'CREATE_DEAL' | 'SEND_NOTIFICATION_EMAIL' | 'SEND_NOTIFICATION_SMS' | 'SEND_NOTIFICATION_IN_APP' | 'SEND_NOTIFICATION_PUSH' | 'DIRECT_EMAIL' | 'DIRECT_SMS';
  // Legacy template ID (for backward compatibility)
  templateId?: string;
  // New template resolution by category/type (Task 15.2)
  templateCategory?: TemplateCategory;
  templateType?: string;
  senderProfileId?: string;
  directSubject?: string;
  directBody?: string;
  useBrandLayout?: boolean;
  recipientType?: 'fixed' | 'manager' | 'contact' | 'entity' | 'signatory' | 'respondent';
  fixedRecipient?: string;
  contactRole?: string;
  taskTitle?: string;
  taskDescription?: string;
  taskPriority?: TaskPriority;
  taskCategory?: TaskCategory;
  taskDueOffsetDays?: number;
  // New checkboxes/multi-targeting options
  recipientTargets?: ('triggering' | 'primary' | 'signatories' | 'roles' | 'all' | 'fixed')[];
  recipientRoles?: string[];
  // New notification configurations
  notificationTargets?: ('assignee' | 'users' | 'custom')[];
  notificationUserIds?: string[];
  customRecipient?: string;
  /**
   * @deprecated Replaced by templateId. The selected notification template carries
   * the subject. Kept for backward compatibility with existing Firestore documents.
   */
  notificationSubject?: string;
  /**
   * @deprecated Replaced by templateId. The selected notification template carries
   * the message body. Kept for backward compatibility with existing Firestore documents.
   */
  notificationBody?: string;
  resendConfig?: {
    enabled: boolean;
    maxResends: number; // validated 1-5
    resendTitles: string[]; // One per resend variant
    resendPreviewTexts: string[]; // One per resend variant
    resendDelayHours: number; // >= 1
    triggerCondition: 'no_open' | 'no_click';
  };
}

export interface CampaignSession {
  id: string;
  campaignId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  totalRecipients: number;
  processed: number;
  success: number;
  failed: number;
  selectedOption?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StepExecution {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: 'success' | 'failed' | 'waiting' | 'skipped';
  executedAt: string;
  durationMs?: number;
  error?: string;
  metadata?: {
    evaluation?: 'true' | 'false';
    actionType?: string;
    delayUntil?: string;
    resumedAt?: string;
    output?: Record<string, unknown>;
  };
}

export interface AutomationRun {
  id: string;
  automationId: string;
  automationName: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  startedAt: string;
  finishedAt?: string;
  triggerData: Record<string, unknown>;
  error?: string;
  entityId?: string | null; // Unified entity reference
  entityType?: EntityType; // Type of entity
  workspaceId?: string;
  steps?: Record<string, StepExecution>;
  /** Tracks the node the contact is currently at (set by step-logger) */
  currentNodeId?: string;
  currentNodeLabel?: string;
  /** Pause/resume management */
  pausedAt?: string;
  pausedBy?: string;
  /** True when run was force-ended by an admin */
  terminatedManually?: boolean;
}

export interface AutomationJob {
  id: string;
  automationId: string;
  runId: string;
  targetNodeId: string;
  payload: Record<string, unknown>;
  executeAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
}

export type WebhookType = 'inbound' | 'outbound';

export interface Webhook {
  id: string;
  organizationId: string;
  workspaceId?: string;
  name: string;
  type: WebhookType;
  url: string; // Destination for outbound, source info for inbound
  trigger?: AutomationTrigger; // For outbound webhooks
  status: 'active' | 'paused' | 'failed';
  secret?: string; // For signature verification
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface VariableDefinition {
  id: string;
  key: string;
  label: string;
  category: string;
  source: string;
  sourceId?: string;
  sourceName?: string;
  entity: string;
  path: string;
  type: string;
  hidden?: boolean;
  constantValue?: string;
}

export type MessageChannel = 'email' | 'sms' | 'whatsapp' | 'in_app' | 'push';

export type RecipientType = 
  | 'respondent'
  | 'internal_alert'
  | 'assignee'
  | 'entity'
  | 'external_alert'
  | 'all';

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  inApp: boolean;
  push: boolean;
  categories?: Record<string, boolean>; // e.g. { 'tasks': true, 'surveys': false }
}

export type TemplateCategory =
  | 'forms'
  | 'surveys'
  | 'meetings'
  | 'agreements'
  | 'campaigns'
  | 'reminders'
  | 'tasks'
  | 'automations'
  | 'qr_codes'
  | 'users'
  | 'general'
  | 'all';

/**
 * Concrete, storable template categories (excludes the `all` filter sentinel).
 * Single source of truth for category selectors/schemas across channels.
 */
export const APP_TEMPLATE_CATEGORIES = [
  'general',
  'surveys',
  'meetings',
  'forms',
  'agreements',
  'campaigns',
  'reminders',
  'tasks',
  'automations',
  'qr_codes',
  'users',
] as const satisfies readonly Exclude<TemplateCategory, 'all'>[];

/** A concrete, storable template category (the `all` filter sentinel excluded). */
export type StorableTemplateCategory = (typeof APP_TEMPLATE_CATEGORIES)[number];

/**
 * Template target audience axis.
 * - 'external_client': Messages to entities/contacts (label uses workspace terminology)
 * - 'internal_team': Messages to workspace users, admins, team members
 */
export type TemplateTarget = 'external_client' | 'internal_team';

/**
 * Email content authoring mode.
 * - 'plain_text': Simple text with {{variable}} placeholders
 * - 'html_code': Raw HTML/CSS editor with live preview
 * - 'rich_builder': Visual drag-and-drop block editor
 * SMS templates always use 'plain_text'.
 */
export type ContentMode = 'plain_text' | 'html_code' | 'rich_builder' | 'template';

/**
 * Simplified template lifecycle status.
 * - 'draft': Work-in-progress, not usable in consumer selectors
 * - 'active': Published and available in template selectors
 * - 'archived': Soft-hidden, excluded from all consumer template lists
 */
export type TemplateStatus = 'draft' | 'active' | 'archived';

export type VariableContext =
  | 'meeting'
  | 'form'
  | 'survey'
  | 'agreement'
  | 'entity'
  | 'campaign'
  | 'users'
  | 'common'
  | (string & {});

export interface TemplateVariable {
  id: string;
  name: string;
  label: string;
  description: string;
  dataType: 'string' | 'date' | 'number' | 'url' | 'html';
  context: VariableContext;
  exampleValue: string;
  // Dynamic variables (from form/survey fields)
  isDynamic: boolean;
  sourceFormId?: string;
  sourceFieldId?: string;
  // Computed variables
  isComputed: boolean;
  computeExpression?: string;
}

export interface ReminderConfig {
  triggerType: 'before_event' | 'after_event' | 'on_deadline' | 'after_failure' | 'after_completion';
  /** Minutes before/after the event. 0 = at event time. */
  offsetMinutes: number;
  offsetLabel: string;
  eventType: 'meeting' | 'form_deadline' | 'survey_deadline' | 'payment_due' | 'task_reminder' | 'automation_failed' | 'automation_completed';
}

export interface ScheduledMessage {
  id: string;
  organizationId: string;
  workspaceId?: string;
  templateId: string;
  channel: MessageChannel;
  recipientContact: string;   // email, phone, or userId (for in_app/push)
  recipientEntityId?: string;
  variables: Record<string, any>;
  scheduledAt: string;        // ISO timestamp
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  reminderType?: string;      // e.g. 'meeting_1_hour'
  sourceEventId?: string;     // meetingId, formId, etc.
  sourceEventType?: string;
  retryCount?: number;
  sentAt?: string;
  error?: string;
  createdAt: string;

  // Snapshot content overrides
  customSubject?: string | null;
  customBody?: string | null;
  
  // Custom sender profile configuration
  senderProfileId?: string | null;
  senderName?: string | null;
  senderIdentifier?: string | null;

  // Provider tracking info (for gateway/cancellation sync)
  providerId?: string | null;
  providerStatus?: string | null;
}

export interface ComposerContext {
  category?: TemplateCategory;
  meetingId?: string;
  formId?: string;
  surveyId?: string;
  agreementId?: string;
}

export const REMINDER_OFFSETS = {
  FIFTEEN_MINUTES: { offsetMinutes: 15,   offsetLabel: '15 minutes before' },
  ONE_HOUR:        { offsetMinutes: 60,   offsetLabel: '1 hour before' },
  TWO_HOURS:       { offsetMinutes: 120,  offsetLabel: '2 hours before' },
  ONE_DAY:         { offsetMinutes: 1440, offsetLabel: '1 day before' },
  TWO_DAYS:        { offsetMinutes: 2880, offsetLabel: '2 days before' },
  TIME_UP:         { offsetMinutes: 0,    offsetLabel: 'At event time' },
} as const;

export interface MessagingTrigger {
  id: string; // The trigger key (maps to MessageTemplate.templateType)
  name: string;
  description: string;
  category: TemplateCategory;
  target: TemplateTarget;
  recipientType: RecipientType;
  supportedChannels: MessageChannel[];
}


export interface MessageTemplate {
  id: string;

  // Two-tier scope
  scope: 'global' | 'organization';
  organizationId?: string;
  globalTemplateId?: string;

  // THREE-AXIS CLASSIFICATION
  category: TemplateCategory;
  channel: MessageChannel;
  /** Target audience: external clients (uses workspace terminology) or internal team */
  target: TemplateTarget;

  // Content
  name: string;
  /** Email content authoring mode. SMS always uses 'plain_text'. */
  contentMode: ContentMode;
  subject?: string;
  previewText?: string;
  subjectOptions?: Array<{ subject: string; previewText: string }>;
  body: string;
  blocks?: MessageBlock[];
  bodyBlocks?: MessageBlock[];

  // Template sub-type (e.g. 'invitation', 'reminder', 'follow_up')
  templateType: string;
  recipientType?: RecipientType;

  // Variables
  variableContext: VariableContext;
  declaredVariables: string[];
  /** @deprecated use declaredVariables */
  variables?: string[];

  // Reminder config (reminders category only)
  reminderConfig?: ReminderConfig;

  // Status & lifecycle (simplified: no approval workflow)
  status: TemplateStatus;
  version: number;
  previousVersionId?: string;

  /** @deprecated Use status === 'active' instead. Kept for backward compatibility with existing Firestore queries. */
  isActive?: boolean;

  // Style (OPTIONAL — null/undefined means no wrapper)
  styleId?: string | null;
  workspaceIds?: string[];

  // WhatsApp-only (channel === 'whatsapp'): binds this template to an approved
  // Meta template and maps positional {{1..n}} params to variable keys.
  whatsappTemplateName?: string;
  whatsappLanguage?: string;
  whatsappParamMap?: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface MessageBlock {
  id: string;
  type: 'heading' | 'text' | 'image' | 'video' | 'button' | 'quote' | 'divider' | 'list' | 'logo' | 'header' | 'footer' | 'score-card' | 'columns' | 'rsvp';
  title?: string;
  content?: string;
  url?: string;
  link?: string;
  variant?: 'h1' | 'h2' | 'h3';
  listStyle?: 'ordered' | 'unordered' | 'roman' | 'checkmark' | 'arrow';
  items?: string[];
  goingLabel?: string;
  declinedLabel?: string;
  laterLabel?: string;
  rsvpStyle?: 'standard' | 'card_bento' | 'card_inline' | 'event_full_bento' | 'event_full_inline' | 'event_compact_bento' | 'event_compact_inline';
  rsvpDate?: string;
  rsvpTime?: string;
  rsvpLocation?: string;
  pillText?: string;
  rsvpDateLabel?: string;
  rsvpTimeLabel?: string;
  rsvpLocationLabel?: string;
  columns?: {
    width: string;
    blocks: MessageBlock[];
  }[];
  style?: {
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundSize?: string;
    color?: string;
    padding?: string;
    paddingTop?: string;
    paddingBottom?: string;
    paddingLeft?: string;
    paddingRight?: string;
    marginTop?: string;
    marginBottom?: string;
    fontSize?: string;
    fontFamily?: string;
    fontWeight?: string;
    lineHeight?: string;
    borderRadius?: string;
    borderWidth?: string;
    borderStyle?: string;
    borderColor?: string;
    width?: string;
    variant?: string;
    animate?: boolean;
  };
  visibilityLogic?: {
    rules: MessageBlockRule[];
    matchType: 'all' | 'any';
  };
}

export interface MessageBlockRule {
  variableKey: string;
  operator: 'isEqualTo' | 'isNotEqualTo' | 'contains' | 'doesNotContain' | 'isGreaterThan' | 'isLessThan' | 'isEmpty' | 'isNotEmpty';
  value?: string;
}

export interface MessageStyle {
  id: string;
  name: string;
  /** Legacy fallback wrapper */
  htmlWrapper?: string;
  /** HTML wrapper template for internal admin communications */
  htmlWrapperInternal?: string;
  /** HTML wrapper template for customer-facing client communications */
  htmlWrapperExternal?: string;
  workspaceIds: string[];
  isDefault?: boolean;
  scope?: 'global' | 'organization';
  organizationId?: string | null;
  createdAt: string;
  updatedAt: string;

  // Custom visual overrides
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  backgroundColor?: string;
  textColor?: string;
  cardBackgroundColor?: string;
  borderRadius?: string;
  logoUrl?: string;
  footerHtml?: string;
  footerEnabled?: boolean;
}

// ─── Campaign Entity & Management (Phase 3) ──────────────────────────────────

/**
 * Campaign lifecycle status.
 * Linear progression: draft → scheduled → sending → sent | failed
 * Manual transitions: any → archived
 */
export type CampaignStatus = 'draft' | 'scheduled' | 'testing' | 'paused' | 'sending' | 'sent' | 'failed' | 'archived' | 'dispatching';

/**
 * Defines how a campaign's audience is selected.
 * Supports tag-based, manual, all-entities, and saved audience modes.
 */
export interface AudienceDefinition {
  /** Selection mode */
  mode: 'all' | 'tags' | 'manual' | 'saved' | 'advanced';
  /** Tag IDs for tag-based targeting (Phase 3 simple mode) */
  tagIds?: string[];
  /** Tag matching logic: 'any' = OR, 'all' = AND */
  tagLogic?: 'any' | 'all';
  /** Excluded tag IDs */
  excludeTagIds?: string[];
  /** Manually selected entity IDs */
  entityIds?: string[];
  /** Contact scope within entities (can be broad scope or a specific contact role key) */
  contactScope?: 'primary' | 'signatories' | 'all' | (string & {});
  /** Optional contact type filter (e.g. 'father', 'mother') */
  contactTypeFilter?: string | null;
  /** Reference to a saved audience definition (Phase 4) */
  savedAudienceId?: string;
  /** Advanced filters (Phase 4) — used when mode = 'advanced' or 'saved' */
  filters?: AudienceFilter[];
  /** Logic for combining advanced filters */
  filterLogic?: 'AND' | 'OR';
  groups?: any[];
  /** Manually selected individual contacts */
  selectedContacts?: Array<{
    entityId: string;
    contactId: string;
    name?: string;
    email?: string;
    phone?: string;
    entityName?: string;
  }>;
}

/**
 * Typed filter field options for the audience builder.
 * MVP set: tags, status, entityType, assignedTo, location.
 * Phase 5-6 expansion: dealPipeline, dealStage, automationId, automationStatus.
 */
export type AudienceFilterField =
  | 'tags'
  | 'status'
  | 'entityType'
  | 'assignedTo'
  | 'locationCountry'
  | 'locationRegion'
  | 'locationDistrict'
  | 'lastContactedAt'
  | 'dealPipeline'
  | 'dealStage'
  | 'automationId'
  | 'automationStatus'
  | (string & {}); // Backward-compatible escape hatch

/**
 * Audience filter condition for advanced filtering.
 * Each row in the visual filter builder maps to one AudienceFilter.
 */
export interface AudienceFilter {
  /** Unique ID per filter row (for React keying) */
  id: string;
  field: AudienceFilterField;
  operator: 'is' | 'is_not' | 'contains' | 'not_contains' | 'any_of' | 'all_of' | 'is_empty' | 'is_not_empty';
  value: any;
}

/**
 * Saved audience segment — reusable filter definition.
 * Stored in the `message_audiences` Firestore collection.
 */
export interface MessageAudience {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  filters: AudienceFilter[];
  filterLogic: 'AND' | 'OR';
  groups?: any[];
  estimatedCount?: number;
  lastEstimatedAt?: string;
  lastUsedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Campaign entity — the core unit for scheduling, analytics, retries, and cloning.
 *
 * Content is **snapshotted at creation time** (R5 fix):
 * - templateId references the source template for attribution
 * - customSubject/customBody/customBlocks hold the actual content used at send time
 * - The campaign is self-contained and does NOT re-fetch the template at send time
 */

/**
 * Phase 6: Rule for applying a tag to entities based on campaign delivery outcome.
 * Each rule targets a specific cohort (e.g., all delivered, all failed).
 */
export interface PostSendTagRule {
  id?: string;
  actionType?: 'add_tag' | 'create_deal' | 'create_task';
  tagId?: string;
  tagName?: string;
  /** Which cohort of recipients should receive this tag */
  appliesTo: 'all_targeted' | 'delivered' | 'failed' | 'not_delivered';
  /** Optional delay in minutes before applying (for 'not_delivered': wait, then check) */
  delayMinutes?: number;

  // parameters for 'create_deal'
  dealPipelineId?: string;
  dealStageId?: string;
  dealTitleTemplate?: string;
  
  // parameters for 'create_task'
  taskTitleTemplate?: string;
  taskDueDateOffsetDays?: number;
}

/**
 * Phase 6: Hook that triggers an automation when a campaign engagement event occurs.
 */
export interface CampaignAutomationHook {
  event: 'campaign_delivered' | 'campaign_failed' | 'campaign_not_delivered' | 'campaign_opened' | 'campaign_clicked';
  automationId: string;
  automationName: string;
  /** Optional delay in minutes before triggering */
  delayMinutes?: number;
}

export interface MessageCampaign {
  id: string;

  // Scope
  workspaceId: string;
  organizationId: string;

  // Identity
  internalName: string;
  channel: MessageChannel;
  target: TemplateTarget;

  // Content (snapshotted — self-contained)
  templateId?: string;
  templateName?: string;
  contentMode: ContentMode;
  customSubject?: string;
  customBody?: string;
  customBlocks?: MessageBlock[];
  /** Style wrapper ID applied at send time */
  styleId?: string | null;

  // Audience
  audienceDefinition: AudienceDefinition;
  /** Estimated recipient count at creation/last-edit time */
  estimatedRecipientCount?: number;

  // Sender
  senderProfileId?: string;

  // Lifecycle
  status: CampaignStatus;
  scheduledAt?: string;
  sentAt?: string;
  /** Tracks the last completed wizard step for draft resume (1-5) */
  lastCompletedStep?: number;

  // Bulk job linkage (R3 fix — two-phase commit)
  /** Linked bulk message job ID for send tracking and error recovery */
  jobId?: string;

  // Post-send behavior (Phase 6)
  /** Conditional tag rules applied after campaign completes */
  postSendTagRules?: PostSendTagRule[];
  /** Automation hooks triggered by campaign engagement events */
  automationHooks?: CampaignAutomationHook[];
  /** Whether to transform URLs in the message body into tracked links (Phase 7) */
  trackLinks?: boolean;

  abTestEnabled?: boolean;
  abTestConfig?: {
    testSizePercentage: number;
    testDurationHours: number;
    winnerMetric: 'open_rate' | 'click_rate' | 'low_unsubscribe_rate';
    winnerSelectedAt?: string;
    winningVariantId?: 'A' | 'B';
    evaluationJobId?: string;
  };
  variants?: CampaignVariant[];

  // Stats (denormalized for list view)
  stats: {
    totalTargeted: number;
    totalSent: number;
    totalFailed: number;
    totalOpened: number;
    totalClicked: number;
    totalUnsubscribed?: number;
  };

  // Metadata
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignStats {
  totalTargeted: number;
  totalSent: number;
  totalFailed: number;
  totalOpened: number;
  totalClicked: number;
  totalUnsubscribed: number;
}

export interface CampaignVariant {
  id: 'A' | 'B';
  templateId?: string | null;
  templateName?: string | null;
  customSubject?: string;
  customBody?: string;
  customBlocks?: MessageBlock[];
  ratio: number;
  stats: CampaignStats;
}

/** Per-channel pointer to the default {@link SenderProfile} id, used at org and workspace level. */
export type DefaultSenderProfileIds = Partial<Record<'email' | 'sms' | 'whatsapp', string>>;

export interface SenderProfile {
  id: string;
  /**
   * Tenant owner. A profile may only be used to send messages for this organization.
   * Required for all profiles created after the org-isolation migration; legacy
   * profiles are backfilled from their workspaces' organizationId.
   */
  organizationId: string;
  name: string;
  channel: 'email' | 'sms' | 'whatsapp';
  identifier: string; // The from email or Sender ID
  /** WhatsApp-only: the Meta phone-number ID this profile sends from. */
  whatsappPhoneNumberId?: string;
  /** WhatsApp-only: connection health for this sender. */
  whatsappStatus?: 'connected' | 'pending' | 'error' | 'disconnected';
  isDefault: boolean;
  isActive: boolean;
  workspaceIds: string[];
  mNotifyStatus?: 'approved' | 'pending' | 'not_registered';
  mNotifyMessage?: string;
  resendStatus?: 'verified' | 'pending' | 'not_registered';
  createdAt: string;
  updatedAt: string;
}

export interface MessageLog {
  id: string;
  organizationId?: string; // Organization identifier for multi-tenant isolation
  title: string;
  templateId: string;
  templateName: string;
  senderProfileId: string;
  senderName: string;
  channel: 'email' | 'sms' | 'whatsapp';
  /** Direction of the message. Defaults to outbound when absent (legacy logs). */
  direction?: 'inbound' | 'outbound';
  recipient: string;
  subject?: string | null;
  previewText?: string | null;
  body: string;
  status: 'sent' | 'failed' | 'scheduled';
  sentAt: string;
  updatedAt?: string;
  variables: Record<string, any>;
  workspaceIds: string[];
  workspaceId?: string; // Primary workspace context (Requirement 11)
  entityId?: string | null; // Unified entity reference
  entityType?: EntityType; // Type of entity
  displayName?: string; // Denormalized entity display name
  entityName?: string; // Legacy denormalized school name
  providerId: string | null;
  providerStatus: string | null;
  error?: string;
  hasAttachments?: boolean;
  attachmentCount?: number;
  openedCount?: number;
  clickedCount?: number;
  dealId?: string; // Optional deal reference for deal-level message tracking
  campaignId?: string;
  campaignVariantId?: 'A' | 'B';
  /** WhatsApp-only: the Meta message id (wamid), used to reconcile status webhooks. */
  metaMessageId?: string;
  /** WhatsApp-only: name of the approved template used for this send, if any. */
  whatsappTemplateName?: string;
  /** WhatsApp-only: Meta conversation id, for conversation-based pricing/analytics. */
  whatsappConversationId?: string;

  // ── Automation correlation (enables per-node stats + resend) ──────────────
  /** Automation that produced this message, when sent from an automation step. */
  automationId?: string;
  /** Automation run (per-contact execution) that produced this message. */
  runId?: string;
  /** Message-step node that produced this message. Used to aggregate node stats. */
  nodeId?: string;

  // ── Resend linkage ────────────────────────────────────────────────────────
  /** True when this log is a resend of an earlier message (not a first send). */
  isResend?: boolean;
  /** The id of the original MessageLog this is a resend of. */
  resendOfLogId?: string;
  /** 1-based attempt number for resends (1 = first resend, 2 = second, ...). */
  resendNumber?: number;

  // ── Structured delivery timestamps (complement providerStatus/counts) ─────
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  bouncedAt?: string;
  complainedAt?: string;
  unsubscribedAt?: string;
  repliedAt?: string;
}

export interface MessageJob {
  id: string;
  templateId: string;
  senderProfileId: string;
  channel: 'email' | 'sms' | 'whatsapp';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalRecipients: number;
  processed: number;
  success: number;
  failed: number;
  createdBy: string;
  createdAt: string;
  /** Campaign linkage for analytics aggregation */
  campaignId?: string;
  /** Snapshotted content for campaign-aware jobs (R2 fix — no templateId required) */
  customSubject?: string;
  customBody?: string;
  /** Organization ID for branding resolution */
  organizationId?: string;
  /** Workspace ID for scoping */
  workspaceId?: string;
  /** Whether to transform URLs in the message body into tracked links (Phase 7) */
  trackLinks?: boolean;
}

export interface MessageTask {
  id: string;
  recipient: string;
  variables: Record<string, any>;
  status: 'pending' | 'sent' | 'failed';
  providerId?: string;
  /** Provider message ID for webhook correlation (e.g., Resend email_id) */
  providerMessageId?: string;
  /** External delivery status from provider webhooks (delivered, bounced, complained, opened, clicked) */
  externalStatus?: string;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  error?: string;
  /** Entity display name for analytics recipient table */
  displayName?: string;
  /** Entity ID for post-send tagging */
  entityId?: string;
  campaignVariantId?: 'A' | 'B';
}

// ─────────────────────────────────────────────────────────────────────────────
// Message-step delivery tracking & resend (automation messaging)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Channels for which per-node delivery statistics are tracked.
 * `in_app`/`push` are platform-delivered and have no provider delivery webhooks.
 */
export type TrackedMessageChannel = 'email' | 'sms' | 'whatsapp';

/**
 * Denormalized per-node counters for a message step, incremented by provider
 * webhooks (Resend / mNotify SMS / WhatsApp). One document per automation node.
 *
 * Stored in the `message_node_stats` collection, keyed by `${automationId}__${nodeId}`.
 *
 * Read-time aggregation over `message_logs` is avoided in favour of these
 * counters so the message-step panel and inspector tab stay O(1) to load.
 */
export interface MessageNodeStats {
  /** Composite id: `${automationId}__${nodeId}`. */
  id: string;
  automationId: string;
  nodeId: string;
  workspaceId: string;
  organizationId?: string;
  channel: TrackedMessageChannel;

  /** First sends only (resends are counted in `resent`). */
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  /** Hard failures / undelivered (SMS `undelivered`, email send errors). */
  failed: number;
  unsubscribed: number;
  replied: number;
  /** Total resend messages dispatched across all contacts at this node. */
  resent: number;

  /** ISO timestamp of the most recent send at this node. */
  lastMessageAt?: string;
  updatedAt: string;
}

/** Counter fields on {@link MessageNodeStats} that webhook events increment. */
export type MessageNodeStatCounter =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'complained'
  | 'failed'
  | 'unsubscribed'
  | 'replied'
  | 'resent';

/** Condition that keeps a contact waiting at a message node until satisfied. */
export type ResendTriggerCondition = 'no_open' | 'no_click';

/**
 * Per-resend subject/preview override. The message *body* is always identical
 * to the original send; only the framing (subject / preview / SMS first line)
 * changes per attempt.
 */
export interface MessageResendVariant {
  /** Email subject, or SMS leading line, for this resend attempt. */
  title: string;
  /** Optional email preview text for this resend attempt. */
  previewText?: string;
}

/**
 * Resend-on-no-engagement configuration, stored on a message-step node's config
 * (`node.data.config.resendConfig`). When enabled the message step behaves as a
 * waiting card: the contact is held at the node until they engage (open/click)
 * or the resend attempts are exhausted, after which they advance.
 */
export interface MessageResendConfig {
  enabled: boolean;
  /** Number of resend attempts after the initial send (1–5). */
  maxResends: number;
  /** Hours to wait between attempts before checking the trigger condition. */
  resendDelayHours: number;
  /** What counts as "engaged" — stops further resends and advances the contact. */
  triggerCondition: ResendTriggerCondition;
  /**
   * Subject/preview overrides per attempt. `variants[0]` is the first resend.
   * If fewer variants than `maxResends` are provided, the last variant is reused.
   */
  variants: MessageResendVariant[];
}


export interface Module {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  description?: string;
  order: number;
  organizationId?: string;
  isDefault?: boolean;
}

export interface Perspective {
  id: string;
  name: string;
  description?: string;
  color: string;
  status: 'active' | 'archived';
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardLayout {
  componentIds: string[];
  hiddenWidgetIds?: string[]; // Widgets explicitly hidden by the user
}

export interface BillingSettings {
  levyPercent: number;
  vatPercent: number;
  defaultDiscount: number;
  paymentInstructions: string;
  signatureName: string;
  signatureDesignation: string;
  signatureUrl?: string;
}

// ─────────────────────────────────────────────────
// Hierarchical RBAC System (Requirement: Permissions Expansion)
// ─────────────────────────────────────────────────

/**
 * Standard CRUD actions for permissions.
 */
export type AppPermissionAction = 'view' | 'create' | 'edit' | 'delete';

/**
 * Action-level permissions for a specific feature.
 * Missing keys default to 'false'.
 */
export interface FeaturePermissionSet {
  view: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
}

/**
 * Section-level container for features.
 * inheritance: Section.enabled = false overrides all sub-features.
 */
export interface SectionPermissions {
  enabled: boolean;
  features: Record<string, FeaturePermissionSet>;
}

/**
 * Full hierarchical permission schema.
 */
export interface PermissionsSchema {
  operations: SectionPermissions;
  finance: SectionPermissions;
  studios: SectionPermissions;
  management: SectionPermissions;
}

// ─────────────────────────────────────────────────
// Feature Toggle System
// ─────────────────────────────────────────────────

/**
 * Canonical Feature Registry - single source of truth for all toggleable features.
 * Each feature maps to sidebar nav items and corresponding dashboard widgets.
 * When a new feature is added to the app, register it here.
 */
export const APP_FEATURES = [
  // Operations
  { id: 'entities', label: 'Contacts / Entities', category: 'Operations', icon: 'School', defaultEnabled: true },
  { id: 'pipeline', label: 'Pipeline', category: 'Operations', icon: 'Workflow', defaultEnabled: true },
  { id: 'tasks', label: 'Tasks', category: 'Operations', icon: 'CheckSquare', defaultEnabled: true },
  { id: 'meetings', label: 'Meetings', category: 'Operations', icon: 'Calendar', defaultEnabled: true },
  { id: 'automations', label: 'Automations', category: 'Operations', icon: 'Zap', defaultEnabled: true },
  { id: 'reports', label: 'Intelligence / Reports', category: 'Operations', icon: 'BarChart3', defaultEnabled: true },
  { id: 'quick_notes', label: 'Quick Notes', category: 'Operations', icon: 'NotebookPen', defaultEnabled: true },
  // Studios
  { id: 'portals', label: 'Public Portals', category: 'Studios', icon: 'Globe', defaultEnabled: true },
  { id: 'media', label: 'Media Library', category: 'Studios', icon: 'Film', defaultEnabled: true },
  { id: 'surveys', label: 'Surveys', category: 'Studios', icon: 'ClipboardList', defaultEnabled: true },
  { id: 'pdfs', label: 'Doc Signing', category: 'Studios', icon: 'FileText', defaultEnabled: true },
  { id: 'messaging', label: 'Messaging', category: 'Studios', icon: 'MessageSquareText', defaultEnabled: true },
  { id: 'tags', label: 'Tags', category: 'Studios', icon: 'Tags', defaultEnabled: true },
  { id: 'forms', label: 'Forms', category: 'Studios', icon: 'ClipboardSignature', defaultEnabled: true },
  { id: 'qr_studio', label: 'QR Studio', category: 'Studios', icon: 'QrCode', defaultEnabled: true },
  { id: 'verify_studio', label: 'Verify Studio', category: 'Studios', icon: 'ShieldCheck', defaultEnabled: true },
  // Finance
  { id: 'agreements', label: 'Agreements', category: 'Finance', icon: 'FileCheck', defaultEnabled: true },
  { id: 'invoices', label: 'Invoices', category: 'Finance', icon: 'Receipt', defaultEnabled: true },
  { id: 'packages', label: 'Packages', category: 'Finance', icon: 'Package', defaultEnabled: true },
  { id: 'billing_periods', label: 'Billing Cycles', category: 'Finance', icon: 'Timer', defaultEnabled: true },
  { id: 'billing_setup', label: 'Billing Setup', category: 'Finance', icon: 'Settings2', defaultEnabled: true },
  // Social Intelligence
  { id: 'social_intelligence', label: 'Social Intelligence', category: 'Studios', icon: 'Share2', defaultEnabled: true },
] as const;

export type AppFeatureId = typeof APP_FEATURES[number]['id'];

/** Feature toggle map: featureId → enabled */
export type FeatureToggleMap = Partial<Record<AppFeatureId, boolean>>;

/**
 * Widget definition for the dashboard widget registry.
 */
export interface WidgetDefinition {
  id: string;
  type: 'static' | 'pipeline';
  label: string;
  description: string;
  icon: string;
  featureId?: AppFeatureId;
  category: string;
  gridClass: string;
  pipelineId?: string;
}

// ─────────────────────────────────────────────────
// Campaign Page Builder Types
// ─────────────────────────────────────────────────

export type PageBlockType = 'hero' | 'text' | 'form' | 'cta' | 'faq' | 'columns' | 'container' | 'testimonial' | 'stats' | 'survey' | 'agreement' | 'html' | 'payment_methods' | 'procedure_list' | 'image' | 'video' | 'spacer' | 'divider' | 'logo_grid' | 'meeting' | 'qr' | 'video_hero' | 'testimonial_grid' | 'choice_cards' | 'app_download' | 'step_section' | 'countdown';

export interface PageBlock {
  id: string;
  type: PageBlockType;
  props: Record<string, unknown>;
  blocks?: PageBlock[]; // for nested layouts
}

export interface PageSection {
  id: string;
  type: 'section';
  props: Record<string, unknown>;
  blocks: PageBlock[];
}

export interface PageSectionProps {
  heading?: string;
  background?: string;
  layout?: '1-col' | '2-col' | '3-col' | '4-col' | 'grid';
  backgroundType?: 'none' | 'color' | 'image' | 'video' | 'gradient' | 'pattern';
  backgroundAttachment?: 'scroll' | 'fixed';
  gradientFrom?: string;
  gradientTo?: string;
  gradientAngle?: number;
  backgroundPattern?: 'dots' | 'grid' | 'topography' | 'diagonal';
  backgroundColor?: string;
  backgroundImageUrl?: string;
  backgroundVideoUrl?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  marginTop?: string;
  marginBottom?: string;
  minHeight?: string;
  verticalAlign?: 'top' | 'center' | 'bottom';
  columnGap?: 'small' | 'medium' | 'large';
  visibilityDevice?: 'all' | 'desktop' | 'mobile';
  visibilityBehavior?: 'all' | 'has_tag' | 'no_tag';
  visibilityTag?: string;
}

export interface CampaignPageStructure {
  sections: PageSection[];
}

export interface PageTriggerAction {
  id: string;
  type: 'trigger_automation' | 'open_modal' | 'redirect' | 'trigger_webhook' | 'scroll_to';
  config: {
    automationId?: string;
    modalType?: 'survey' | 'form' | 'agreement';
    targetId?: string; // SurveyId, FormId, AgreementId
    url?: string;
  };
}

export interface PageTrigger {
  id: string;
  name: string; // Human-readable label e.g. "Welcome popup"
  event: 'page_load' | 'block_click' | 'form_submitted' | 'on_exit' | 'scroll_to' | 'card_selected' | 'countdown_expired';
  targetBlockId?: string; // Which block fires this (for block_click/form_submitted)
  config?: {
    once?: boolean;
    delaySeconds?: number;
  };
  actions: PageTriggerAction[]; // Multiple actions per trigger
}

export interface CampaignPage {
  id: string;
  organizationId: string;
  workspaceIds: string[];
  campaignId?: string | null;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  pageGoal: 'lead_capture' | 'registration' | 'information' | 'payment' | 'thank_you';
  themeId?: string | null;
  /** Canonical SEO & social-sharing config. @see SeoConfig */
  seo: SeoConfig;
  settings: {
    customScriptsAllowed: boolean;
    customHead?: string;
    customBody?: string;
    showHeader: boolean;
    showFooter: boolean;
    triggers?: PageTrigger[];
    themeOverrides?: {
      primary?: string;
      secondary?: string;
      background?: string;
      accent?: string;
      typography?: {
        primaryFont?: string;
      };
    };
  };
  stats?: {
    views: number;
    uniques: number;
    conversions: number;
    clicks: number;
  };
  publishedVersionId?: string | null;
  /** 'custom_coded' = hand-built Next.js page; 'page_builder' = built via the page builder UI */
  pageType?: 'custom_coded' | 'page_builder';
  /** When true, page events are tracked in custom_page_analytics */
  trackingEnabled?: boolean;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignPageVersion {
  id: string;
  pageId: string;
  organizationId: string;
  versionNumber: number;
  structureJson: CampaignPageStructure;
  themeSnapshot?: Record<string, any>;
  createdBy: string;
  createdAt: string;
  isPublishedVersion: boolean;
}

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  goal: 'lead_capture' | 'registration' | 'information' | 'payment' | 'thank_you';
  structureJson: CampaignPageStructure;
  thumbnailUrl?: string;
  isGlobal?: boolean;
  organizationId?: string;
}

export interface PageSectionTemplate {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  category: string;
  structure: PageSection;
  createdAt: string;
}

export interface CampaignPageTheme {
  id: string;
  organizationId: string;
  workspaceId?: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    baseSize: string;
  };
  ui: {
    borderRadius: string;
    buttonStyle: 'flat' | 'glow' | 'glass';
  };
  isSystem?: boolean;
}

/**
 * A fully-resolved theme — the merged result of a selected `CampaignPageTheme`,
 * per-page overrides, org branding, and built-in defaults. The page renderer
 * consumes this (never a raw theme) and emits it as CSS variables.
 */
export interface ResolvedTheme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    accent: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    baseSize: string;
  };
  ui: {
    borderRadius: string;
    buttonStyle: 'flat' | 'glow' | 'glass';
  };
}

/**
 * Read-only resources a block may reference while rendering (e.g. an embed
 * picking a form). Passed into the block render context.
 */
export interface FormResource {
  id: string;
  title: string;
  internalName?: string;
}

export interface SurveyResource {
  id: string;
  title: string;
}

export interface AgreementResource {
  id: string;
  title: string;
}

export interface MeetingResource {
  id: string;
  title: string;
  slug?: string;
  status?: string;
  type?: {
    id: string;
    slug: string;
    name: string;
  };
}

export interface QRCodeResource {
  id: string;
  title: string;
  slug?: string;
  redirectUrl?: string;
}

export interface BuilderResources {
  forms: ReadonlyArray<FormResource>;
  surveys: ReadonlyArray<SurveyResource>;
  agreements: ReadonlyArray<AgreementResource>;
  meetings?: ReadonlyArray<MeetingResource>;
  qrCodes?: ReadonlyArray<QRCodeResource>;
}



export interface PageSubmission {
  id: string;
  pageId: string;
  campaignId?: string;
  workspaceId: string;
  organizationId: string;
  entityId?: string | null;
  submissionType: 'form' | 'registration' | 'signup';
  data: Record<string, any>;
  source: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    referrer?: string;
  };
  createdAt: string;
}

/**
 * Fields Manager Data Models
 */
export interface FieldGroup {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string;                    // e.g. "Contact Identity", "Financial Profile"
  slug: string;                    // Auto-generated kebab-case key
  description?: string;
  icon: string;                    // Lucide icon name, auto-determined
  color: string;                   // Accent color
  entityTypes: EntityType[];       // Which entity types this group applies to
  industry?: IndustryVertical;     // Which industry seeded this (null = user-created)
  isSystem: boolean;               // System groups are immutable
  order: number;                   // Drag-sort position
  fieldCount?: number;             // Denormalized
  createdAt: string;
  updatedAt?: string;
}

export interface AppField {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string; // Internal name
  label: string; // Display label
  variableName: string; // Used in liquid/mustache templates
  type: 'short_text' | 'long_text' | 'email' | 'phone' | 'number' | 'currency' | 'date' | 'datetime' | 'select' | 'multi_select' | 'radio' | 'checkbox' | 'yes_no' | 'address' | 'url' | 'hidden';
  groupId?: string; // Reference to FieldGroup.id
  /** @deprecated Use groupId */
  section: 'common' | 'institution' | 'family' | 'child' | 'custom_admissions' | 'custom_marketing' | string;
  industryOrigin?: IndustryVertical; // Which industry seeded this
  isNative: boolean; // System fields are immutable
  compatibilityScope: ('common' | 'institution' | 'family' | 'person' | 'submission-only' | 'internal-only')[];
  helpText?: string;
  placeholder?: string;
  defaultValue?: any;
  options?: { value: string; label: string }[]; // For select/radio
  validationRules?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt?: string;
}

/**
 * Form Builder Data Models
 */
export interface Form {
  id: string;
  workspaceId: string;
  organizationId: string;
  internalName: string;
  title: string;
  slug: string;
  description?: string;
  /** Canonical SEO & social-sharing config for the public form page. @see SeoConfig */
  seo?: SeoConfig;
  formType: 'bound' | 'global';
  contactScope?: 'institution' | 'family' | 'person'; // Only populated if bound
  fields: FormFieldInstance[];
  theme: FormThemeConfig;
  successBehavior: {
    type: 'message' | 'redirect';
    value: string; // The message text or redirect URL
  };
  actions: FormSubmissionActions;
  status: 'draft' | 'published' | 'archived';
  submissionCount: number;
  workspaceIds?: string[];
  assignedUsers?: string[];
  assignmentEnabled?: boolean;
  allowResubmission?: boolean;
  allowCrossVisibility?: boolean;
  showDebugProcessingModal?: boolean;
  notifyAssignedUsers?: {
    email: boolean;
    sms: boolean;
  };
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
  version?: number;
}

export interface FormFieldInstance {
  id: string; // Unique ID within the form
  appFieldId: string; // Reference to the AppField
  labelOverride?: string;
  placeholderOverride?: string;
  helpTextOverride?: string;
  required: boolean;
  hidden: boolean;
  defaultValueOverride?: any;
  order: number;
  width?: 'full' | 'half'; // Form layout option
}

export interface FormThemeConfig {
  preset: 'minimal' | 'professional' | 'card' | 'embedded';
  cardWidth?: 'sm' | 'md' | 'lg' | 'full';
  borderRadius?: string;
  inputStyle?: 'outline' | 'filled' | 'flushed';
  labelPlacement?: 'top' | 'left' | 'floating';
  accentColor?: string;
  ctaLabel?: string;
  ctaStyle?: 'solid' | 'outline' | 'ghost';
  ctaWidth?: 'auto' | 'full';
  ctaAlignment?: 'left' | 'center' | 'right';
  backgroundStyle?: 'transparent' | 'solid' | 'glass';
}

export interface FormSubmissionActions {
  tags: string[]; // Applied immediately or post-creation
  automations: string[]; // Triggers 'form_submitted:<formId>' or these explicitly
  notifications?: {
    internalUserIds?: string[]; // @deprecated - use internalAlerts.userIds instead
    sendConfirmationEmail?: boolean; // @deprecated - use respondentAlerts instead
    internalAlerts?: {
      enabled: boolean;
      userIds: string[];
      emailTemplateId?: string;
      smsTemplateId?: string;
      whatsappTemplateId?: string;
      pushTemplateId?: string;
      inAppTemplateId?: string;
    };
    respondentAlerts?: {
      enabled: boolean;
      respondentEmailField?: string;
      respondentPhoneField?: string;
      emailTemplateId?: string;
      smsTemplateId?: string;
      whatsappTemplateId?: string;
      pushTemplateId?: string;
      inAppTemplateId?: string;
    };
    externalAlerts?: {
      enabled: boolean;
      emailAddresses: string[];
      emailTemplateId?: string;
      smsTemplateId?: string;
      whatsappTemplateId?: string;
      pushTemplateId?: string;
      inAppTemplateId?: string;
    };
  };
  webhooks: string[]; // URLs or Webhook document IDs
  entityHandling?: 'create_new' | 'update_matching' | 'create_or_update'; // only if 'bound'
}

export interface FormSubmission {
  id: string;
  formId: string;
  workspaceId: string;
  organizationId: string;
  data: Record<string, any>; // The parsed JSON answers { variableName: value }
  entityId?: string; // Linked entity if created/updated
  sourcePageId?: string; // Campaign page that embedded this form (indirect tracking)
  ipAddress?: string;
  userAgent?: string;
  utmSource?: string; // UTM campaign tracking
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  submittedAt: string;
}

// ─────────────────────────────────────────────────
// QR Studio Types
// ─────────────────────────────────────────────────

export type QRCodeMode = 'static' | 'dynamic';

export type QRCodeType =
  | 'url' | 'survey' | 'form' | 'landing_page' | 'public_portal'
  | 'doc_signing' | 'meeting' | 'invoice' | 'vcard' | 'wifi'
  | 'email' | 'sms' | 'whatsapp' | 'text' | 'file';

export type QRDotStyle = 'square' | 'rounded' | 'dots' | 'classy' | 'classy-rounded' | 'extra-rounded';
export type QRCornerSquareStyle = 'square' | 'dot' | 'extra-rounded';
export type QRCornerDotStyle = 'square' | 'dot';
export type QRErrorCorrection = 'L' | 'M' | 'Q' | 'H';
export type QRStatus = 'active' | 'paused' | 'archived';

export interface QRGradient {
  enabled: boolean;
  type: 'linear' | 'radial';
  rotation?: number;
  colorStops: { offset: number; color: string }[];
}

export interface QRDesign {
  foregroundColor: string;
  backgroundColor: string;
  gradient?: QRGradient;
  dotStyle: QRDotStyle;
  cornerSquareStyle: QRCornerSquareStyle;
  cornerSquareColor?: string;
  cornerDotStyle: QRCornerDotStyle;
  cornerDotColor?: string;
  logoUrl?: string;
  logoSize?: number;        // percentage 10-30
  logoMargin?: number;      // px around logo
  frameStyle?: 'none' | 'banner-bottom' | 'banner-top' | 'rounded-bottom' | 'pill';
  frameText?: string;
  frameColor?: string;
  quietZone?: number;       // px
  errorCorrection: QRErrorCorrection;
  size?: number;            // px, default 300
  posterData?: any;         // Serialized CanvasState for advanced poster designer
}

export interface QRDestination {
  url?: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  fallbackUrl?: string;
}

export interface QRTracking {
  enabled: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  campaignName?: string;
  sourceLabel?: string;
}

export interface QRCode {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  slug: string;
  description?: string;
  mode: QRCodeMode;
  type: QRCodeType;
  destination: QRDestination;
  shortPath?: string;
  redirectUrl?: string;
  design: QRDesign;
  tracking: QRTracking;
  status: QRStatus;
  notifications?: {
    internalAlerts?: {
      enabled: boolean;
      userIds: string[];
      emailTemplateId?: string;
      smsTemplateId?: string;
      whatsappTemplateId?: string;
      pushTemplateId?: string;
      inAppTemplateId?: string;
    };
  };
  stats: {
    totalScans: number;
    uniqueScans?: number;
    lastScannedAt?: string;
  };
  createdBy: { userId: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface QRCodeTemplate {
  id: string;
  workspaceId: string;
  organizationId: string;
  scope: 'workspace';
  name: string;
  category: string;
  design: QRDesign;
  previewImageUrl?: string;
  sourceTemplateId?: string; // tracks which system/native template this was derived from
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InAppNotification {
  id: string;
  userId: string;
  organizationId: string;
  workspaceId?: string;
  title: string;
  body: string;
  category?: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface QRScanEvent {
  id: string;
  organizationId: string;
  workspaceId: string;
  qrCodeId: string;
  scannedAt: string;
  sessionId?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  browser?: string;
  os?: string;
  ipHash?: string;
  country?: string;
  city?: string;
  destinationUrl: string;
  resourceType?: string;
  resourceId?: string;
  queryParams?: Record<string, string>;
}

// ─────────────────────────────────────────────────
// Industry-Specific Data Types (Requirement 3)
// Polymorphic discriminated unions for industry data
// ─────────────────────────────────────────────────

/**
 * Polymorphic union of all industry-specific data structures.
 * Discriminated by `industry` + `entityType` fields.
 */
export type IndustryData =
  | SaaSInstitutionData
  | SaaSPersonData
  | SchoolEnrollmentInstitutionData
  | LawInstitutionData
  | LawPersonData
  | MarketingInstitutionData
  | MarketingPersonData
  | RealEstateInstitutionData
  | RealEstatePersonData
  | ConsultancyInstitutionData
  | ConsultancyPersonData;

// ── SaaS Industry (Requirement 8 — Current System) ──

export interface SaaSInstitutionData {
  industry: 'SaaS';
  capacity: number; // Renamed from companySize
  activeUsers?: number;

  trialIds?: string[];
  onboardingIds?: string[];
  supportTicketIds?: string[];
  healthScoreIds?: string[];
}

export interface SaaSPersonData {
  industry: 'SaaS';
  role: 'admin' | 'manager' | 'user';
  lastLoginDate?: string;
  activationStatus: 'pending' | 'active' | 'inactive';
}

// ── School Enrollment Industry (Requirement 4) ──

export interface SchoolEnrollmentInstitutionData {
  industry: 'SchoolEnrollment';
  gradeOfferings: string[];
  academicYear: string;
  capacity: number; // Renamed from enrollmentCapacity
  currentEnrollment?: number;
  applicationIds?: string[];
  enrollmentIds?: string[];
  schoolVisitIds?: string[];
}

// ── Law Industry (Requirement 5) ──

export interface LawInstitutionData {
  industry: 'Law';
  firmType: 'solo' | 'partnership' | 'corporate';
  practiceAreas: string[];
  barAssociations?: string[];
  capacity?: number; // Number of attorneys/staff
  conflictCheckRequired: boolean;
  matterIds?: string[];
  intakeFormIds?: string[];
  conflictCheckIds?: string[];
}

export interface LawPersonData {
  industry: 'Law';
  clientType: 'individual' | 'company';
  legalIssueType?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

// ── Marketing Industry (Requirement 6) ──

export interface MarketingInstitutionData {
  industry: 'Marketing';
  clientIndustry: string;
  targetAudience?: string;
  capacity?: number; // Number of employees
  revenue?: number; // Annual revenue
  monthlyBudget?: number;
  campaignIds?: string[];
  proposalIds?: string[];
  deliverableIds?: string[];
}

export interface MarketingPersonData {
  industry: 'Marketing';
  role: string;
  influenceLevel: 'decision-maker' | 'influencer' | 'user';
  approvalAuthority: boolean;
}

// ── Real Estate Industry (Requirement 7) ──

export interface RealEstateInstitutionData {
  industry: 'RealEstate';
  propertyPortfolio?: string[];
  developerType: 'residential' | 'commercial' | 'mixed';
  investmentFocus?: string;
  capacity?: number; // Number of properties managed
  propertyIds?: string[];
}

export interface RealEstatePersonData {
  industry: 'RealEstate';
  clientType: 'buyer' | 'seller' | 'tenant' | 'landlord' | 'investor';
  budgetRange?: { min: number; max: number };
  preferredLocations?: string[];
}

// ── Consultancy Industry (Requirement 9) ──

export interface ConsultancyInstitutionData {
  industry: 'Consultancy';
  clientIndustry: string;
  capacity?: number; // Number of consultants
  strategicPriorities?: string[];
  painPoints?: string[];
  discoveryIds?: string[];
  proposalIds?: string[];
  engagementIds?: string[];
}

export interface ConsultancyPersonData {
  industry: 'Consultancy';
  role: string;
  department?: string;
  influenceLevel: 'decision-maker' | 'influencer' | 'user';
  decisionMakingStyle?: 'fast' | 'consensus' | 'hierarchical';
}

// ─────────────────────────────────────────────────────────────────────────────
// Industry-Specific Collection Interfaces
// ─────────────────────────────────────────────────────────────────────────────

// ── SaaS Collections (Requirements 8.17–8.23) ──

/** Trial management record for a SaaS account entity. */
export interface Trial {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  trialStartDate: string; // ISO date string
  trialEndDate: string; // ISO date string
  trialStatus: 'active' | 'expired' | 'converted' | 'cancelled';
  conversionDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** Onboarding tracking record for a SaaS account entity. */
export interface Onboarding {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  onboardingStatus: 'not_started' | 'in_progress' | 'completed' | 'stalled';
  activationMilestones: {
    name: string;
    completed: boolean;
    completedAt?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

/** Subscription billing record for a SaaS account entity. */
export interface IndustrySubscription {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  planType: string;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  amount: number;
  currency: string;
  status: 'active' | 'past_due' | 'cancelled' | 'expired';
  startDate: string;
  renewalDate: string;
  createdAt: string;
  updatedAt: string;
}

/** Support ticket record for a SaaS account entity. */
export interface SupportTicket {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  issueType: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  resolutionTime?: number; // hours
  satisfactionRating?: number; // 1–5
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

/** Account health score snapshot for a SaaS entity. */
export interface HealthScore {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  overallScore: number; // 0–100
  usageScore: number;
  supportScore: number;
  engagementScore: number;
  churnRisk: 'low' | 'medium' | 'high';
  calculatedAt: string;
  createdAt: string;
}

/** Product usage event record for a SaaS entity. */
export interface ProductUsage {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  featureUsed: string;
  frequency: number;
  sessionDuration?: number; // seconds
  engagementScore?: number;
  recordedAt: string;
  createdAt: string;
}

/** Feature adoption record tracking depth of usage for a SaaS entity. */
export interface FeatureAdoption {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  featureName: string;
  featureUsageStatus: 'not_used' | 'tried' | 'adopted' | 'champion';
  adoptionDate?: string;
  depthOfUsage?: 'shallow' | 'moderate' | 'deep';
  createdAt: string;
  updatedAt: string;
}

// ── School Enrollment Collections (Requirements 4.7–4.10) ──

/** Admission application record for a School Enrollment entity. */
export interface Application {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // School entity
  familyId?: string;
  studentName: string;
  gradeApplying: string;
  applicationStatus: 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'waitlisted';
  submittedAt: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Student enrollment record for a School Enrollment entity. */
export interface Enrollment {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // School entity
  familyId?: string;
  studentName: string;
  grade: string;
  academicYear: string;
  enrollmentStatus: 'enrolled' | 'withdrawn' | 'graduated';
  enrollmentDate: string;
  createdAt: string;
  updatedAt: string;
}

/** School visit / tour scheduling record. */
export interface SchoolVisit {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // School entity
  familyId?: string;
  visitDate: string;
  visitType: 'tour' | 'open_house' | 'shadow_day' | 'meeting';
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  attendees?: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Law Collections (Requirements 5.8–5.15) ──

/** Legal matter / case record for a Law entity. */
export interface Matter {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // Client entity
  matterNumber: string;
  matterType: string;
  practiceArea: string;
  status: 'intake' | 'active' | 'on_hold' | 'closed';
  openedDate: string;
  closedDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** Client intake form record for a Law entity. */
export interface IntakeForm {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  matterId?: string;
  formData: Record<string, unknown>;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Conflict-of-interest check record for a Law entity. */
export interface ConflictCheck {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  checkStatus: 'pending' | 'clear' | 'conflict_found';
  conflictDetails?: string;
  checkedBy: string;
  checkedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Consultation / meeting record for a Law entity. */
export interface Consultation {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  matterId?: string;
  consultationDate: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Related party (witness, opposing counsel, etc.) for a matter. */
export interface RelatedParty {
  id: string;
  organizationId: string;
  workspaceId: string;
  matterId: string;
  name: string;
  role: string; // e.g. 'witness', 'opposing_counsel', 'expert'
  contactInfo?: string;
  createdAt: string;
  updatedAt: string;
}

/** Legal document record associated with a matter. */
export interface LegalDocument {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  matterId?: string;
  documentName: string;
  documentType: string;
  storageUrl: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Billable time entry for a matter. */
export interface TimeTracking {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // Client entity
  matterId: string;
  userId: string; // Attorney / staff
  hours: number;
  billableRate: number;
  description: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

/** Court date / deadline record for a matter. */
export interface CourtDate {
  id: string;
  organizationId: string;
  workspaceId: string;
  matterId: string;
  entityId: string;
  courtName?: string;
  hearingType: string;
  scheduledDate: string;
  status: 'upcoming' | 'completed' | 'adjourned' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Marketing Collections (Requirements 6.8–6.13) ──

/** Marketing campaign record for a Marketing entity. */
export interface Campaign {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // Client entity
  campaignName: string;
  campaignType: string;
  status: 'planning' | 'active' | 'paused' | 'completed';
  budget: number;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** Proposal record for a Marketing entity. */
export interface Proposal {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  proposalName: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  value?: number;
  sentAt?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Deliverable record for a campaign or engagement. */
export interface Deliverable {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  campaignId?: string;
  engagementId?: string;
  deliverableName: string;
  deliverableType: string;
  status: 'pending' | 'in_progress' | 'review' | 'approved' | 'delivered';
  dueDate: string;
  completedDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** Performance metric snapshot for a campaign. */
export interface PerformanceMetric {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  campaignId?: string;
  metricName: string;
  metricValue: number;
  unit?: string;
  recordedAt: string;
  createdAt: string;
}

/** Client report record for a Marketing entity. */
export interface ClientReport {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  campaignId?: string;
  reportName: string;
  reportPeriod: string;
  storageUrl?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Strategy document record for a Marketing entity. */
export interface StrategyDoc {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  docName: string;
  docType: string;
  storageUrl?: string;
  version?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Real Estate Collections (Requirements 7.7–7.13) ──

/** Property listing record for a Real Estate entity. */
export interface Property {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // Owner / developer entity
  propertyType: 'residential' | 'commercial' | 'land' | 'mixed';
  address: string;
  price: number;
  status: 'available' | 'under_contract' | 'sold' | 'off_market';
  listedDate: string;
  createdAt: string;
  updatedAt: string;
}

/** Buyer / tenant property preference record. */
export interface PropertyPreference {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string; // Buyer / tenant entity
  propertyType?: 'residential' | 'commercial' | 'land' | 'mixed';
  budgetRange?: { min: number; max: number };
  preferredLocations?: string[];
  bedrooms?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Property viewing / site visit record. */
export interface Viewing {
  id: string;
  organizationId: string;
  workspaceId: string;
  propertyId: string;
  clientEntityId: string; // Buyer / tenant entity
  viewingDate: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  feedback?: string;
  createdAt: string;
  updatedAt: string;
}

/** Offer record for a property. */
export interface Offer {
  id: string;
  organizationId: string;
  workspaceId: string;
  propertyId: string;
  buyerEntityId: string;
  offerAmount: number;
  status: 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'countered';
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Negotiation record between buyer and seller. */
export interface Negotiation {
  id: string;
  organizationId: string;
  workspaceId: string;
  propertyId: string;
  offerId: string;
  buyerEntityId: string;
  sellerEntityId?: string;
  status: 'in_progress' | 'agreed' | 'failed';
  agreedPrice?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Closed deal / transaction record for a property (Real Estate specific). */
export interface PropertyDeal {
  id: string;
  organizationId: string;
  workspaceId: string;
  propertyId: string;
  buyerEntityId: string;
  sellerEntityId?: string;
  dealValue: number;
  closingDate: string;
  status: 'pending' | 'closed' | 'fallen_through';
  createdAt: string;
  updatedAt: string;
}

/** Property-related document record. */
export interface PropertyDocument {
  id: string;
  organizationId: string;
  workspaceId: string;
  propertyId: string;
  entityId?: string;
  documentName: string;
  documentType: string;
  storageUrl: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ── Consultancy Collections (Requirements 9.9–9.15) ──

/** Discovery / needs-assessment session record for a Consultancy entity. */
export interface Discovery {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  discoveryType: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  findings?: string;
  completedDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** Consulting engagement / project record. */
export interface Engagement {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  engagementName: string;
  engagementType: string;
  status: 'proposal' | 'active' | 'on_hold' | 'completed';
  startDate: string;
  endDate?: string;
  value: number;
  createdAt: string;
  updatedAt: string;
}

/** Milestone within a consulting engagement. */
export interface Milestone {
  id: string;
  organizationId: string;
  workspaceId: string;
  engagementId: string;
  milestoneName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  dueDate: string;
  completedDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** Outcome / impact measurement record for a consulting engagement. */
export interface Outcome {
  id: string;
  organizationId: string;
  workspaceId: string;
  engagementId: string;
  entityId: string;
  outcomeDescription: string;
  measuredValue?: number;
  unit?: string;
  measuredAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Retainer agreement record for a Consultancy entity. */
export interface Retainer {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  retainerName: string;
  monthlyValue: number;
  currency: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Call Centre & Outreach Campaign Types ───────────────────────────────────

export interface CallScript {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  description?: string;
  content: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** Provenance — 'imported' marks scripts recreated from a .cflow file. Absent ⇒ native. */
  source?: 'native' | 'imported';
  importMeta?: {
    importedAt: string;
    originalName?: string;
    formatVersion?: number;
  };
}

export type CallCampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled' | 'archived';

export interface CallOutcomeAutomation {
  type: CallActionType;
  params: CallActionParams;
}

export interface CallCampaign {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  description?: string;
  scriptId: string;
  scriptSnapshot: string;
  audienceDefinition: AudienceDefinition;
  outcomes: string[];
  automationRules: Record<string, CallOutcomeAutomation[]>;
  status: CallCampaignStatus;
  allowAddContactsAfterLaunch?: boolean;
  triggerActionsAutomatically?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  progress: {
    total: number;
    completed: number;
    pending: number;
    skipped: number;
    callbacks: number;
    deferred: number;
  };
  aiInsights?: {
    commonObjections: string[];
    commonQuestions: string[];
    scriptPerformanceScore: number;
    suggestedImprovements?: string;
  };
}

export type CallQueueItemStatus = 'scheduled' | 'in_progress' | 'completed' | 'callback_scheduled' | 'deferred' | 'skipped' | 'invalid_contact';

export interface CallQueueItem {
  id: string;
  campaignId: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  entityType: EntityType;
  entityName: string;
  entityPhone: string;
  entityEmail: string;
  /** When set, this queue item targets a specific contact within the entity rather than the entity's default contact */
  contactId?: string;
  /** Display name of the specific contact (populated when contactId is set) */
  contactName?: string;
  contactRole?: string;
  status: CallQueueItemStatus;
  assignedTo: string | null;
  lockExpiresAt: string | null;
  callbackDate: string | null;
  attempts: number;
  lastAttemptAt: string | null;
  notesDraft?: string;
  outcome?: string;
  duration?: number;
  
  // AI Integration slots
  recordingUrl?: string;
  transcript?: string;
  aiSummary?: {
    summary: string;
    suggestedOutcome: string;
    confidence: number;
    sentiment: 'positive' | 'neutral' | 'negative';
  };
  aiExtractedActions?: Array<{
    type: 'create_task' | 'schedule_callback';
    title: string;
    dueDate?: string;
  }>;
  
  createdAt: string;
  updatedAt: string;
}

/** Canonical set of action types available in call scripts and campaign automations. */
export type CallActionType =
  | 'SEND_SMS'
  | 'SEND_EMAIL'
  | 'SEND_WHATSAPP'
  | 'CREATE_TASK'
  | 'CHANGE_STAGE'
  | 'ADD_TO_PIPELINE'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'WEBHOOK'
  | 'LOG_NOTE'
  | 'SCHEDULE_MEETING'
  | 'TRANSFER_CALL'
  | 'ADD_TO_CALL_CAMPAIGN'
  | 'UPDATE_CONTACT';

export type ScriptNodeType = 
  | 'start'           // Beginning of call
  | 'script_block'    // What agent should say
  | 'question'        // Ask customer something
  | 'multiple_choice' // Customer answer options (branches)
  | 'condition'       // If/Else logic check
  | 'objection'       // Objection handler block
  | 'action'          // Automation trigger (e.g. change stage, task)
  | 'outcome'         // Campaign outcomes (e.g. Interested, Callback)
  | 'end';            // End call

export interface ScriptNode {
  id: string;
  type: ScriptNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    text: string;           // Script text to display to agent (supports variable injection)
    outcomeValue?: string;  // Value mapped if node type is 'outcome'
    actionType?: CallActionType; // Action type mapped if node type is 'action'
    options?: string[];     // Answer options for question nodes
    
    // Node Specific Configurations
    startConfig?: {
      checkDnc?: boolean;
      checkTimezone?: boolean;
      allowedHoursStart?: string; // HH:MM
      allowedHoursEnd?: string;   // HH:MM
    };
    sayConfig?: {
      complianceVerify?: boolean;
      complianceText?: string;
    };
    questionConfig?: {
      fieldBinding?: 'contact' | 'deal';
      fieldName?: string; // e.g. "email", "value", "expectedCloseDate"
      fieldType?: 'text' | 'number' | 'select' | 'datepicker';
      selectOptions?: string[];
      validationPattern?: string; // Regex
      allowFreeform?: boolean;
    };
    objectionConfig?: {
      // Legacy flat field kept for backwards compatibility
      keywordTriggers?: string[];
      // Multi-entry objection list — each entry is a named objection with triggers + a response
      objections?: Array<{
        title: string;           // Short name, e.g. "Too expensive"
        keywordTriggers: string[]; // Words/phrases that trigger this objection
        description: string;     // Agent response / talking-point for this objection
      }>;
    };
    /** Per-action configuration when node type is 'action'. @see CallActionParams */
    actionConfig?: CallActionParams;
    outcomeConfig?: {
      suppressDays?: number;
      followUpCampaignId?: string;
      /** Post-call automations that run when a call resolves to this outcome. */
      automations?: CallOutcomeAutomation[];
    };
    endConfig?: {
      wrapUpTemplateId?: string;
    };
  };
}

export interface ScriptEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;           // Text label shown on the branch button (e.g., "Yes", "No", "Busy")
}

export interface BranchingScriptGraph {
  nodes: ScriptNode[];
  edges: ScriptEdge[];
}

/**
 * Unified, fully-typed parameter bag shared by every call action. Superset across all
 * CallActionTypes — used by the execution engine, script `actionConfig`, and outcome
 * automations. Replaces the former per-site `Record<string, any>` shapes.
 */
export interface CallActionParams {
  // Messaging (SEND_SMS / SEND_EMAIL / SEND_WHATSAPP)
  templateId?: string;
  /** Optional inline overrides resolved at send time (fall back to the template). */
  customBody?: string;
  customSubject?: string;
  // Task (CREATE_TASK)
  taskTitle?: string;
  taskDescription?: string;
  taskPriority?: 'low' | 'medium' | 'high';
  /** 'days' = N days from call date, 'specific' = fixed calendar date */
  taskDueDateMode?: 'days' | 'specific';
  taskDueDays?: number;
  /** HH:mm — used with both modes (default from config, overridable per-call) */
  taskDueTimeOfDay?: string;
  /** ISO date string e.g. \"2025-12-31\" — only used when taskDueDateMode === 'specific' */
  taskDueSpecificDate?: string;
  taskDueDate?: string;
  taskAssigneeMode?: 'caller' | 'specific' | 'round_robin';
  taskAssigneeId?: string;
  // Pipeline / stage (CHANGE_STAGE, ADD_TO_PIPELINE)
  pipelineId?: string;
  stageId?: string;
  // Tags (ADD_TAG / REMOVE_TAG)
  tagId?: string;
  // Note (LOG_NOTE)
  noteContent?: string;
  // Meeting (SCHEDULE_MEETING)
  meetingMode?: 'guest_list' | 'create';
  /** Existing-meeting target for guest_list mode (meetings/{meetingId}/registrants) */
  meetingId?: string;
  /** MEETING_TYPES id for create mode */
  meetingTypeId?: string;
  // Transfer to another call campaign (ADD_TO_CALL_CAMPAIGN) + legacy TRANSFER_CALL
  campaignId?: string;
  contactScope?: 'primary' | 'all';
  transferTarget?: string;
  transferMode?: 'phone' | 'agent' | 'campaign';
  // Webhook (WEBHOOK) — headers stored as a JSON string from the UI
  webhookUrl?: string;
  webhookMethod?: 'POST' | 'GET' | 'PUT';
  webhookHeaders?: string;
  // Update Contact (UPDATE_CONTACT)
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  updateMode?: 'update' | 'new';
  // Common
  triggerDelaySeconds?: number;
}

/**
 * Params shape for campaign post-call automation rules.
 * @deprecated Alias of {@link CallActionParams} — kept for back-compat with existing imports.
 */
export type AutomationRuleParams = CallActionParams;

// ─────────────────────────────────────────────────
// Page Link Tracking & Analytics (Phase 1)
// ─────────────────────────────────────────────────

/**
 * Named event types fired on tracked landing pages.
 */
export type PageEventType =
  | 'page_view'
  | 'video_start'
  | 'video_complete'
  | 'video_replay'
  | 'cta_click';

/**
 * Source channel that brought the visitor to the page.
 * 'email'    — arrived via a tracked email link (/api/l/{id})
 * 'sms'      — arrived via a personalised SMS URL (Phase 8)
 * 'whatsapp' — arrived via a personalised WhatsApp URL (Phase 8)
 * 'qr'       — arrived via a QR code redirect (/q/{shortPath})
 * 'direct'   — organic / unknown source
 */
export type PageEventChannel = 'email' | 'sms' | 'whatsapp' | 'qr' | 'direct';

/**
 * A single tracked event on a landing page.
 * Stored in custom_page_analytics/{slug}/events/{autoId}.
 */
export interface CustomPageEvent {
  id?: string;
  type: PageEventType;
  /** Entity ID from ?ref= query param — undefined for anonymous visitors. */
  entityId?: string;
  /** Browser-local session ID (localStorage). Used for uniqueViews deduplication. */
  sessionId: string;
  channel: PageEventChannel;
  timestamp: string;
}

/**
 * Aggregate stats stored on the root custom_page_analytics/{slug} document.
 * All fields are incremented atomically with FieldValue.increment.
 */
export interface CustomPageStats {
  views: number;
  uniqueViews: number;
  videoStarts: number;
  videoCompletions: number;
  videoReplays: number;
  ctaClicks: number;
}

/**
 * Root document for a tracked landing page.
 * Stored in custom_page_analytics/{slug}.
 */
export interface CustomPageAnalyticsDoc {
  slug: string;
  /** Links to campaign_pages/{pageId} when the page is registered in the page builder registry. */
  pageId?: string;
  stats: CustomPageStats;
  updatedAt: string;
}

/**
 * A CustomPageEvent enriched with entity display name for the admin UI.
 */
export interface CustomPageEventWithEntity extends CustomPageEvent {
  entityDisplayName?: string;
}

/**
 * Typed tracked link record stored in Firestore tracked_links/{id}.
 * Replaces the local interface in link-tracking.ts to centralise types.
 */
export interface TrackedLink {
  id: string;
  originalUrl: string;
  campaignId: string;
  jobId: string;
  taskId: string;
  /** Entity ID attached at link-creation time so the redirect can forward identity. */
  entityId?: string;
  channel?: PageEventChannel;
  clickCount: number;
  createdAt: string;
}

/**
 * Return type of getLinkData() — fast read path in the redirect route.
 * Decoupled from the write path so the 302 is never blocked by analytics.
 */
export interface TrackedLinkClickResult {
  originalUrl: string;
  entityId?: string;
  channel?: PageEventChannel;
}

/**
 * Map of page slug → canonical URL, used by the page link pre-pass resolver.
 * Populated server-side before resolveVariables() is called.
 */
export type PageLinkMap = Map<string, string>;

// ── Scheduling Engine & Calendar Booking Types ────────────────────────────

export type ConferencingProvider = 'GOOGLE_MEET' | 'ZOOM' | 'MICROSOFT_TEAMS' | 'PHONE' | 'IN_PERSON';

export interface CalendarConnection {
  id: string;
  organizationId: string;
  workspaceId: string;
  userId: string;
  provider: 'google_calendar' | 'microsoft_teams' | 'zoom';
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO DateTime
  calendarId: string; // e.g. "primary"
  syncDirection: 'one_way_to_calendar' | 'one_way_from_calendar' | 'two_way';
  lastSyncAt?: string;
  createdAt: string;
}

export interface WorkingDay {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  slots: Array<{ start: string; end: string }>; // e.g. [{ start: "09:00", end: "12:00" }]
}

export interface UserAvailability {
  id: string; // matches user or workspace
  organizationId: string;
  workspaceId: string;
  userId: string;
  weeklySchedule: WorkingDay[];
  timezone: string; // IANA string e.g. "Africa/Accra"
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  maxBookingsPerDay?: number;
  minimumNoticeHours: number;
  maximumNoticeDays: number;
}

export interface BookingQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'dropdown' | 'checkbox' | 'radio';
  required: boolean;
  options?: string[]; // for multi-choice fields
}

export interface BookingPage {
  id: string;
  organizationId: string;
  workspaceId: string;
  slug: string;
  title: string;
  description?: string;
  durationMinutes: number;
  availabilityId: string;
  questions: BookingQuestion[];
  meetingProvider: ConferencingProvider;
  locationDetails?: string;
  bufferMinutes: number;
  publishStatus: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface BookingResponse {
  id: string;
  bookingPageId: string;
  organizationId: string;
  workspaceId: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string;
  answers: Record<string, string | string[]>;
  scheduledTime: string; // ISO DateTime UTC
  durationMinutes: number;
  meetingId?: string; // links to created Meeting doc
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
}

// ─────────────────────────────────────────────────
// Social Intelligence Modules Typings
// ─────────────────────────────────────────────────

export interface SocialAccount {
  id: string;
  orgId: string;
  workspaceId: string;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'x' | 'tiktok' | 'youtube' | 'pinterest' | 'google_business';
  platformAccountId: string;
  displayName: string;
  username: string;
  avatarUrl: string;
  status: 'active' | 'expired' | 'revoked';
  auth: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    scopes: string[];
  };
  simulated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SocialPost {
  id: string;
  orgId: string;
  workspaceId: string;
  campaignId?: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  contentObject: {
    title: string;
    baseCaption: string;
    mediaUrls: string[];
  };
  platformVariations: Record<string, {
    caption: string;
    mediaUrls: string[];
    hashtags: string[];
    scheduledTime: string;
    publishedPostId?: string;
    error?: string;
    utmParams: {
      source: string;
      medium: string;
      campaign: string;
      content: string;
    };
  }>;
  aiOptimized: boolean;
  approvalStatus: 'none' | 'pending' | 'approved' | 'rejected';
  approverId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandVoiceProfile {
  id: string;
  orgId: string;
  workspaceId: string;
  name: string;
  isDefault: boolean;
  description: string;
  tone: 'professional' | 'casual' | 'inspiring' | 'bold' | 'educational' | 'witty';
  emojiDensity: 'none' | 'low' | 'medium' | 'high';
  averageLength: 'short' | 'medium' | 'long';
  forbiddenWords: string[];
  mandatoryKeywords: string[];
  targetAudience: string;
  productDescriptions: string;
  missionStatement: string;
  extractedStyleTokens: string[];
  samplePosts: string[];
  automationMode?: 'manual' | 'suggest' | 'autopilot';
  createdAt: string;
  updatedAt: string;
}

export interface SocialInboxItemReply {
  id: string;
  sender: 'user' | 'platform_user' | 'ai';
  senderName: string;
  content: string;
  createdAt: string;
  wasAutoSent?: boolean;
}

export interface SocialInboxItem {
  id: string;
  orgId: string;
  workspaceId: string;
  socialAccountId: string;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'x' | 'tiktok' | 'youtube' | 'pinterest' | 'google_business';
  itemType: 'message' | 'comment' | 'mention' | 'review';
  platformItemId: string;
  platformSenderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  rating?: number;
  status: 'unread' | 'pending' | 'resolved' | 'snoozed';
  assignedUserId?: string;
  crmContactId?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  replies: SocialInboxItemReply[];
  suggestedReplies?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SocialListeningRule {
  id: string;
  orgId: string;
  workspaceId: string;
  name: string;
  trackKeywords: string[];
  trackHashtags: string[];
  trackCompetitors: string[];
  excludeKeywords?: string[];
  alertThreshold: 'any' | 'negative' | 'viral_potential';
  notifyEmail?: boolean;
  notifyInApp?: boolean;
  notifyFeed?: boolean;
  active: boolean;
  createdAt: string;
}

export interface SocialAutomationRule {
  id: string;
  orgId: string;
  workspaceId: string;
  name: string;
  trigger: 'inbound_message' | 'brand_mention' | 'negative_sentiment';
  condition: 'all' | 'contains_keywords' | 'negative_only';
  conditionKeywords: string[];
  actions: {
    id: string;
    type: 'draft_ai_reply' | 'crm_tag_lead' | 'notify_admin';
    params: {
      tagName?: string;
      aiTone?: string;
      notifyInApp?: boolean;
      notifyEmail?: boolean;
    };
  }[];
  active: boolean;
  createdAt: string;
}

export interface SocialBrandKit {
  id: string;
  workspaceId: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl?: string;
  bannerText: string;
  updatedAt: string;
}


