
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

export type AutomationTrigger = 
  | 'SCHOOL_CREATED' 
  | 'SCHOOL_STAGE_CHANGED' 
  | 'TASK_COMPLETED' 
  | 'SURVEY_SUBMITTED' 
  | 'PDF_SIGNED' 
  | 'WEBHOOK_RECEIVED' 
  | 'MEETING_CREATED';

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
  schoolId?: string | null;
  schoolName?: string | null;
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
    schoolId?: string | null;
    schoolName?: string | null;
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
  workspaceId: string; // Strictly confined
  schoolId?: string;
  schoolName?: string;
  schoolSlug?: string;
  userId?: string | null;
  type: string;
  source: string;
  timestamp: string;
  description: string;
  metadata?: any;
}

export interface Task {
  id: string;
  workspaceId: string; // Strictly confined
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  assignedTo: string;
  assignedToName?: string;
  schoolId?: string | null;
  schoolName?: string | null;
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
    schoolId: string | null;
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
