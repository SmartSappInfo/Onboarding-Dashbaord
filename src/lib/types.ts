
export const MEETING_TYPES = [
  { id: 'parent', name: 'Parent Engagement', slug: 'parent-engagement' },
  { id: 'kickoff', name: 'Kickoff', slug: 'kickoff' },
  { id: 'training', name: 'Training', slug: 'training' },
] as const;

export type MeetingType = typeof MEETING_TYPES[number];

export type FocalPersonType = 'Champion' | 'Accountant' | 'Administrator' | 'Principal' | 'School Owner' | string;

export type SchoolStatusState = 'Active' | 'Inactive' | 'Archived';

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
  | 'TAG_REMOVED';

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
  logoUrl?: string;
  primaryColor?: string;
  createdAt: string;
  updatedAt: string;
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
  scopeLocked?: boolean; // True once first entity is linked
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


export interface Zone {
  id: string;
  name: string;
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
  { id: 'system_admin', label: 'Full System Management', category: 'Management' },
  { id: 'system_user_switch', label: 'Switch User Context', category: 'Management' },
  { id: 'meetings_manage', label: 'Schedule & Edit Meetings', category: 'Operations' },
  { id: 'tasks_manage', label: 'Manage CRM Tasks', category: 'Operations' },
  { id: 'activities_view', label: 'View Audit Timeline', category: 'Management' },
  { id: 'tags_view', label: 'View Tags', category: 'Operations' },
  { id: 'tags_manage', label: 'Manage Tags', category: 'Operations' },
  { id: 'tags_apply', label: 'Apply Tags to Contacts', category: 'Operations' },
] as const;

export type AppPermissionId = typeof APP_PERMISSIONS[number]['id'];

export interface Role {
  id: string;
  organizationId: string; // Roles belong to an Org
  name: string;
  description: string;
  permissions: AppPermissionId[];
  workspaceIds: string[]; // Roles grant access to specific workspaces
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
  status: SchoolStatusState;
  schoolStatus: string;
  pipelineId: string;
  zone?: Zone;
  focalPersons: FocalPerson[];
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
  };
  stage?: {
    id: string;
    name: string;
    order: number;
    color?: string;
  };
  track?: string;
  lifecycleStatus?: LifecycleStatus;
  createdAt: string;
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
export interface Entity {
  id: string;
  organizationId: string;
  entityType: EntityType;
  name: string; // Display name (computed from firstName + lastName for person entities)
  slug?: string; // URL-safe identifier (for institution entities)
  contacts: FocalPerson[]; // Named contact persons
  globalTags: string[]; // Identity-level tags visible across all workspaces (Requirement 7)
  status?: 'active' | 'archived'; // Soft delete status
  createdAt: string;
  updatedAt: string;
  // Scope-specific data (only one will be populated based on entityType)
  institutionData?: InstitutionData;
  familyData?: FamilyData;
  personData?: PersonData;
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
  };
  status: 'active' | 'archived';
  workspaceTags: string[]; // Workspace-scoped operational tags (Requirement 7)
  lastContactedAt?: string;
  addedAt: string;
  updatedAt: string;
  // Denormalized read-model fields for performance
  displayName: string;
  primaryEmail?: string;
  primaryPhone?: string;
  currentStageName?: string;
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
  contacts: Array<{
    name: string;
    phone: string;
    email: string;
    type: string;
    isSignatory: boolean;
  }>;
  // Workspace-specific operational state
  pipelineId?: string;
  stageId?: string;
  stageName?: string;
  assignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  };
  status?: string;
  tags: string[]; // Workspace tags for the active workspace
  globalTags?: string[]; // Global identity tags (only for migrated entities)
  // Entity metadata
  entityType?: EntityType;
  entityId?: string;
  workspaceEntityId?: string;
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
  invoiceNumber: string;
  schoolId: string;
  schoolName: string;
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
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  workspaceIds: string[]; // Shared
  meetingTime: string;
  meetingLink: string;
  type: MeetingType;
  heroImageUrl?: string;
  recordingUrl?: string;
  brochureUrl?: string;
  adminAlertsEnabled?: boolean;
  adminAlertChannel?: 'email' | 'sms' | 'both';
  adminAlertNotifyManager?: boolean;
  adminAlertSpecificUserIds?: string[];
  adminAlertEmailTemplateId?: string;
  adminAlertSmsTemplateId?: string;
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

export interface Survey {
  id: string;
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
  showSurveyTitles?: boolean;
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
  schoolId?: string | null; // Legacy field for backward compatibility
  schoolName?: string | null; // Legacy field for backward compatibility
  entityId?: string | null; // New unified entity reference
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
    type: 'text' | 'long-text' | 'yes-no' | 'multiple-choice' | 'checkboxes' | 'dropdown' | 'rating' | 'date' | 'time' | 'file-upload' | 'email' | 'phone';
    title: string;
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
    schoolId?: string | null; // Legacy field for backward compatibility
    schoolName?: string | null; // Legacy field for backward compatibility
    entityId?: string | null; // New unified entity reference
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
    schoolId?: string | null;
}

export interface Contract {
    id: string;
    schoolId: string;
    schoolName: string;
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
  schoolId?: string; // Legacy field for backward compatibility
  schoolName?: string; // Legacy field for backward compatibility
  schoolSlug?: string; // Legacy field for backward compatibility
  entityId?: string; // New unified entity reference
  entityType?: EntityType; // Type of entity
  displayName?: string; // Denormalized entity name at time of logging
  entitySlug?: string; // Denormalized slug for historical readability
  userId?: string | null;
  type: string;
  source: string;
  timestamp: string;
  description: string;
  metadata?: any;
}

export interface Task {
  id: string;
  organizationId?: string; // Organization context for multi-tenant support
  workspaceId: string; // Strictly confined
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  assignedTo: string;
  assignedToName?: string;
  schoolId?: string | null; // Legacy field for backward compatibility
  schoolName?: string | null; // Legacy field for backward compatibility
  entityId?: string | null; // New unified entity reference
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
export type TaskCategory = 'call' | 'visit' | 'document' | 'training' | 'general';

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
  templateId?: string;
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

export interface MessageTemplate {
    id: string;
    name: string;
    category: 'general' | 'meetings' | 'surveys' | 'forms' | 'finance' | 'contracts';
    channel: 'email' | 'sms';
    subject?: string;
    previewText?: string;
    body: string;
    blocks?: MessageBlock[];
    variables: string[];
    styleId?: string;
    isActive: boolean;
    workspaceIds: string[];
    createdAt: string;
    updatedAt: string;
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
    schoolId: string | null; // Legacy field for backward compatibility
    entityId?: string | null; // New unified entity reference
    entityType?: EntityType; // Type of entity
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
