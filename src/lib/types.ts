
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

/** @deprecated Use EntityContact.typeKey instead. Will be removed after contact migration. */
export type FocalPersonType = 'Champion' | 'Accountant' | 'Administrator' | 'Principal' | 'School Owner' | string;

export type SchoolStatusState = 'Active' | 'Inactive' | 'Archived' | 'archived';

export type SchoolStatus = SchoolStatusState; // Alias for backward compatibility

export type LifecycleStatus = 'Onboarding' | 'Active' | 'Churned' | 'Lead' | 'Lost' | string;

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
  | 'SCHOOL_CREATED'
  | 'SCHOOL_STAGE_CHANGED'
  | 'TASK_COMPLETED'
  | 'SURVEY_SUBMITTED'
  | 'PDF_SIGNED'
  | 'WEBHOOK_RECEIVED'
  | 'MEETING_CREATED'
  | 'TAG_ADDED'
  | 'TAG_REMOVED'
  | 'CAMPAIGN_PAGE_SUBMITTED'
  | 'FORM_SUBMITTED';

/**
 * Configuration for tag-based automation triggers (TAG_ADDED / TAG_REMOVED).
 * Specifies which tags to watch and optionally filters by contact type or
 * how the tag was applied.
 */
export interface TagTriggerConfig {
  /** Tag IDs that should fire this trigger. Empty array means any tag. */
  tagIds: string[];
  /** Restrict trigger to a specific contact type. */
  contactType?: 'school' | 'prospect';
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
  status?: 'active' | 'trial' | 'suspended' | 'archived';
  settings?: {
    defaultCurrency?: string;
    defaultTimezone?: string;
    defaultLanguage?: string;
  };
  // AI Configuration (Requirement: Multi-Model Architecture)
  geminiApiKey?: string;
  openRouterApiKey?: string;
  openaiApiKey?: string;
  claudeApiKey?: string; // Optional if using OpenRouter directly
  defaultWorkspaceId?: string;
  defaultRoleId?: string; // Default role for new invites
  /** Optional default industry for new workspaces (Requirement 18) */
  industry?: IndustryVertical;
  /** Features enabled for this organization. Missing keys = use defaultEnabled from APP_FEATURES. */
  enabledFeatures?: FeatureToggleMap;
  /** Global default values applied when entities are created via survey submissions */
  surveyEntityDefaults?: SurveyEntityDefaults;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
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
 * Migration status for tracking school-to-entity migration progress (Requirement 18)
 * 
 * - "legacy": Not yet migrated, still using old schools collection exclusively
 * - "migrated": Fully migrated to entities + workspace_entities model
 * - "dual-write": Transitional state where writes go to both old and new models
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
  createdAt: string;
  updatedAt: string;
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

/** @deprecated Use EntityContact instead. Will be removed after contact migration. */
export interface FocalPerson {
  name: string;
  phone: string;
  email: string;
  type: FocalPersonType;
  isSignatory: boolean;
  notes?: FocalPersonNote[];
  attachments?: FocalPersonAttachment[];
}

export interface FocalPersonNote {
  id: string;
  content: string;
  createdAt: string;
}

export interface FocalPersonAttachment {
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
  phone?: string;
  typeKey: string;
  typeLabel?: string;
  isPrimary: boolean;
  isSignatory: boolean;
  order: number;
  notes?: FocalPersonNote[];
  attachments?: FocalPersonAttachment[];
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

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  workspaceIds: string[]; // Shared across workspaces
  stageIds: string[];
  accessRoles: string[];
  columnWidth?: number;
  isDefault?: boolean;
  createdAt: string;
  updatedAt?: string;
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
  roles: string[];
  permissions?: AppPermissionId[];
  /** Hierarchical permission structure (Permissions Expansion) */
  permissionsSchema?: PermissionsSchema;
  // AI User Preferences
  preferredAiModel?: string;      // e.g., 'gemini-2.0-flash', 'gpt-4o'
  preferredAiProvider?: string;   // e.g., 'googleai', 'openrouter', 'openai'
  /** Backoffice roles for platform control plane access */
  backofficeRoles?: import('./backoffice/backoffice-types').BackofficeRole[];
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
  focalPersons?: any[]; // @deprecated - legacy focal persons
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
  lifecycleStatus?: LifecycleStatus;
  createdAt: string;
  updatedAt?: string; // ISO timestamp
  // Tagging fields
  tags?: string[];
  taggedAt?: { [tagId: string]: string };
  taggedBy?: { [tagId: string]: string };
  /**
   * Migration tracking field (Requirement 18)
   * 
   * Tracks the migration progress from the legacy schools collection to the new
   * entities + workspace_entities model. The adapter layer uses this field to
   * determine whether to read from the legacy schools collection or the new model.
   * 
   * - "legacy": Not yet migrated, still using old schools collection exclusively
   * - "migrated": Fully migrated to entities + workspace_entities model
   * - "dual-write": Transitional state where writes go to both old and new models
   * 
   * @default undefined (treated as "legacy")
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
  
  // Migration fields (Requirement 12)
  migrationStatus?: 'legacy' | 'migrated' | 'dual-write';
  legacySchoolId?: string;
  
  // Reserved for future cross-entity relationships
  relatedEntityIds?: string[];
}

/**
 * WorkspaceEntity - represents the operational relationship between an entity and a workspace
 * Stores workspace-specific state: pipeline position, assignee, workspace tags
 * 
 * Tag Storage (Requirement 7):
 * - workspaceTags: Operational tags scoped to this specific workspace (e.g., "hot-lead", "billing-issue")
 *   These tags represent workspace-specific state and are NOT visible in other workspaces.
 */
export interface WorkspaceEntity {
  id: string;
  organizationId: string;
  workspaceId: string;
  entityId: string;
  entityType: EntityType;
  pipelineId: string;
  stageId: string;
  assignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  } | null;
  status: 'active' | 'archived';
  lifecycleStatus?: string; // Dynamic workspace-defined status (e.g., "Onboarding", "Active", "Churned")
  workspaceTags: string[]; // Workspace-scoped operational tags (Requirement 7)
  taggedAt?: { [tagId: string]: string }; // Tag assignment timestamps
  taggedBy?: { [tagId: string]: string }; // Tag assignment user IDs
  lastContactedAt?: string;
  addedAt: string;
  updatedAt: string;
  // Denormalized read-model fields for performance
  displayName: string;
  primaryContactName?: string;
  primaryEmail?: string;  // Denormalized from entityContacts where isPrimary
  primaryPhone?: string;  // Denormalized from entityContacts where isPrimary
  entityContacts: EntityContact[]; // Denormalized contact data (FER-01)
  interests?: Partial<Module>[];
  currentStageName?: string;
  entityName?: string; // Snapshot for backward compatibility
  logoUrl?: string;
  initials?: string;
  slogan?: string;
  location?: { locationString?: string; zone?: { id: string; name: string } };
  locationString?: string; // Legacy/flat location fallback
  nominalRoll?: number;
  implementationDate?: string;
  zone?: { id: string; name: string };
  modules?: Partial<Module>[];
  slug?: string;
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
  // Migration tracking
  migrationStatus: MigrationStatus;
  // Legacy school data (for backward compatibility)
  schoolData?: School;
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
  entityId?: string; // Unified entity reference
  entityName?: string | null; // Snapshot of entity name
  entitySlug?: string; // URL slug for public page routing
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
  adminAlertsEnabled?: boolean;
  adminAlertChannel?: 'email' | 'sms' | 'both';
  adminAlertNotifyManager?: boolean;
  adminAlertSpecificUserIds?: string[];
  adminAlertEmailTemplateId?: string;
  adminAlertSmsTemplateId?: string;
  // Reminder configuration (Task 12)
  enabledReminders?: string[]; // Array of reminder type IDs (e.g., ['meeting_reminder_15min', 'meeting_reminder_1hour'])
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

export type MeetingRegistrantStatus = 'registered' | 'approved' | 'waitlisted' | 'cancelled' | 'attended' | 'no_show';

export interface MeetingRegistrant {
  id: string;
  meetingId: string;
  workspaceIds: string[];
  token: string;
  status: MeetingRegistrantStatus;
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
}

export interface SurveyEntityDefaults {
  currency?: string;
  subscriptionPackageName?: string;
  subscriptionRate?: number;
  contactTypeKey?: string;
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
  showCoverPage?: boolean;
  showIntroAsPage?: boolean;
  stepperVariant?: 'full' | 'simple';
  showSurveyTitles?: boolean;
  showBranding?: boolean;
  backgroundColor?: string;
  backgroundPattern?: 'none' | 'dots' | 'grid' | 'circuit' | 'topography' | 'cubes' | 'gradient';
  patternColor?: string;
  webhookEnabled?: boolean;
  webhookId?: string;
  showDebugProcessingModal?: boolean;
  adminAlertsEnabled?: boolean;
  adminAlertChannel?: 'email' | 'sms' | 'both';
  adminAlertNotifyManager?: boolean;
  adminAlertSpecificUserIds?: string[];
  adminAlertEmailTemplateId?: string;
  adminAlertSmsTemplateId?: string;
  externalAlertsEnabled?: boolean;
  externalAlertChannel?: 'email' | 'sms' | 'both';
  externalAlertContactTypes?: string[];
  externalAlertEmailTemplateId?: string;
  externalAlertSmsTemplateId?: string;
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
  enableScoring?: boolean;
  optionScores?: number[];
  yesScore?: number;
  noScore?: number;
  autoAdvance?: boolean;
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
}

export interface SurveyResultPage {
  id: string;
  name: string;
  isDefault: boolean;
  blocks: SurveyResultBlock[];
}

export interface SurveyResultBlock {
  id: string;
  type: 'heading' | 'text' | 'image' | 'video' | 'button' | 'quote' | 'divider' | 'score-card' | 'list' | 'logo' | 'header' | 'footer';
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
}

export interface SurveySummary {
  id: string;
  summary: string;
  createdAt: string;
  prompt?: string;
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
  adminAlertChannel?: 'email' | 'sms' | 'both';
  adminAlertNotifyManager?: boolean;
  adminAlertSpecificUserIds?: string[];
  adminAlertEmailTemplateId?: string;
  adminAlertSmsTemplateId?: string;
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
  assignedTo: string;
  assignedToName?: string;
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
  relatedEntityType?: 'SurveyResponse' | 'Submission' | 'Meeting' | 'School' | null;
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
  trigger: AutomationTrigger;
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
  type: 'SEND_MESSAGE' | 'CREATE_TASK' | 'UPDATE_FIELD' | 'WEBHOOK';
  // Legacy template ID (for backward compatibility)
  templateId?: string;
  // New template resolution by category/type (Task 15.2)
  templateCategory?: TemplateCategory;
  templateType?: string;
  senderProfileId?: string;
  recipientType?: 'fixed' | 'manager' | 'focal_person';
  fixedRecipient?: string;
  focalPersonType?: string;
  taskTitle?: string;
  taskDescription?: string;
  taskPriority?: TaskPriority;
  taskCategory?: TaskCategory;
  taskDueOffsetDays?: number;
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

export interface AutomationRun {
  id: string;
  automationId: string;
  automationName: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  finishedAt?: string;
  triggerData: Record<string, any>;
  error?: string;
  entityId?: string | null; // Unified entity reference
  entityType?: EntityType; // Type of entity
}

export interface AutomationJob {
  id: string;
  automationId: string;
  runId: string;
  targetNodeId: string;
  payload: Record<string, any>;
  executeAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
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

export type TemplateCategory =
  | 'forms'
  | 'surveys'
  | 'meetings'
  | 'agreements'
  | 'campaigns'
  | 'reminders'
  | 'general';

export type VariableContext =
  | 'meeting'
  | 'form'
  | 'survey'
  | 'agreement'
  | 'entity'
  | 'campaign'
  | 'common';

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
  triggerType: 'before_event' | 'after_event' | 'on_deadline';
  /** Minutes before/after the event. 0 = at event time. */
  offsetMinutes: number;
  offsetLabel: string;
  eventType: 'meeting' | 'form_deadline' | 'survey_deadline' | 'payment_due';
}

export interface ScheduledMessage {
  id: string;
  organizationId: string;
  workspaceId?: string;
  templateId: string;
  channel: 'email' | 'sms';
  recipientContact: string;   // email or phone
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
  TIME_UP:         { offsetMinutes: 0,    offsetLabel: 'At event time' },
} as const;

export interface MessageTemplate {
  id: string;

  // Two-tier scope
  scope: 'global' | 'organization';
  organizationId?: string;
  globalTemplateId?: string;

  // Categorization
  category: TemplateCategory;
  templateType: string;

  // Content
  name: string;
  channel: 'email' | 'sms';
  subject?: string;
  previewText?: string;
  body: string;
  blocks?: MessageBlock[];
  bodyBlocks?: MessageBlock[];

  // Variables
  variableContext: VariableContext;
  declaredVariables: string[];
  /** @deprecated use declaredVariables */
  variables?: string[];

  // Reminder config (reminders category only)
  reminderConfig?: ReminderConfig;

  // Status & lifecycle
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'archived';
  isActive: boolean;
  version: number;
  previousVersionId?: string;

  // Legacy / misc
  styleId?: string;
  workspaceIds?: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface MessageBlock {
  id: string;
  type: 'heading' | 'text' | 'image' | 'video' | 'button' | 'quote' | 'divider' | 'list' | 'logo' | 'header' | 'footer' | 'score-card';
  title?: string;
  content?: string;
  url?: string;
  link?: string;
  variant?: 'h1' | 'h2' | 'h3';
  listStyle?: 'ordered' | 'unordered';
  items?: string[];
  style?: {
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    backgroundColor?: string;
    color?: string;
    padding?: string;
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
  htmlWrapper: string;
  workspaceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SenderProfile {
  id: string;
  name: string;
  channel: 'email' | 'sms';
  identifier: string; // The from email or Sender ID
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
  channel: 'email' | 'sms';
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
}

export interface MessageJob {
  id: string;
  templateId: string;
  senderProfileId: string;
  channel: 'email' | 'sms';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalRecipients: number;
  processed: number;
  success: number;
  failed: number;
  createdBy: string;
  createdAt: string;
}

export interface MessageTask {
  id: string;
  recipient: string;
  variables: Record<string, any>;
  status: 'pending' | 'sent' | 'failed';
  providerId?: string;
  sentAt?: string;
  error?: string;
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
  // Studios
  { id: 'portals', label: 'Public Portals', category: 'Studios', icon: 'Globe', defaultEnabled: true },
  { id: 'media', label: 'Media Library', category: 'Studios', icon: 'Film', defaultEnabled: true },
  { id: 'surveys', label: 'Surveys', category: 'Studios', icon: 'ClipboardList', defaultEnabled: true },
  { id: 'pdfs', label: 'Doc Signing', category: 'Studios', icon: 'FileText', defaultEnabled: true },
  { id: 'messaging', label: 'Messaging', category: 'Studios', icon: 'MessageSquareText', defaultEnabled: true },
  { id: 'tags', label: 'Tags', category: 'Studios', icon: 'Tags', defaultEnabled: true },
  { id: 'forms', label: 'Forms', category: 'Studios', icon: 'ClipboardSignature', defaultEnabled: true },
  // Finance
  { id: 'agreements', label: 'Agreements', category: 'Finance', icon: 'FileCheck', defaultEnabled: true },
  { id: 'invoices', label: 'Invoices', category: 'Finance', icon: 'Receipt', defaultEnabled: true },
  { id: 'packages', label: 'Packages', category: 'Finance', icon: 'Package', defaultEnabled: true },
  { id: 'billing_periods', label: 'Billing Cycles', category: 'Finance', icon: 'Timer', defaultEnabled: true },
  { id: 'billing_setup', label: 'Billing Setup', category: 'Finance', icon: 'Settings2', defaultEnabled: true },
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

export type PageBlockType = 'hero' | 'text' | 'form' | 'cta' | 'faq' | 'columns' | 'container' | 'testimonial' | 'stats' | 'survey' | 'agreement' | 'html';

export interface PageBlock {
  id: string;
  type: PageBlockType;
  props: Record<string, any>;
  blocks?: PageBlock[]; // for nested layouts
}

export interface PageSection {
  id: string;
  type: 'section';
  props: Record<string, any>;
  blocks: PageBlock[];
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
  event: 'page_load' | 'block_click' | 'form_submitted' | 'on_exit' | 'scroll_to';
  targetBlockId?: string; // Which block fires this (for block_click/form_submitted)
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
  seo: {
    title: string;
    description: string;
    ogImageUrl?: string;
    noIndex: boolean;
  };
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
export interface AppField {
  id: string;
  workspaceId: string;
  organizationId: string;
  name: string; // Internal name
  label: string; // Display label
  variableName: string; // Used in liquid/mustache templates
  type: 'short_text' | 'long_text' | 'email' | 'phone' | 'number' | 'currency' | 'date' | 'datetime' | 'select' | 'multi_select' | 'radio' | 'checkbox' | 'yes_no' | 'address' | 'url' | 'hidden';
  section: 'common' | 'institution' | 'family' | 'child' | 'custom_admissions' | 'custom_marketing' | string;
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
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
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
  tags: string[]; // Appled immediately or post-creation
  automations: string[]; // Triggers 'form_submitted:<formId>' or these explicitly
  notifications: {
    internalUserIds: string[];
    respondentEmailField?: string; // which field holds the respondent's email
    sendConfirmationEmail?: boolean;
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
  submittedAt: string;
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
  accountStatus: 'lead' | 'trial' | 'active' | 'suspended' | 'churned';
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

/** Closed deal / transaction record for a property. */
export interface Deal {
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
