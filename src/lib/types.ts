
export const MEETING_TYPES = [
  { id: 'parent', name: 'Parent Engagement', slug: 'parent-engagement' },
  { id: 'kickoff', name: 'Kickoff', slug: 'kickoff' },
  { id: 'training', name: 'Training', slug: 'training' },
] as const;

export type MeetingType = typeof MEETING_TYPES[number];

export type FocalPersonType = 'Champion' | 'Accountant' | 'Administrator' | 'Principal' | 'School Owner' | string;

export type SchoolStatus = 'Active' | 'Inactive' | 'Archived';
export type LifecycleStatus = 'Onboarding' | 'Active' | 'Churned';

/**
 * Defines a managed Perspective (formerly hardcoded track).
 */
export interface Perspective {
  id: string;
  name: string;
  description?: string;
  icon?: string; // Lucide icon name
  color?: string; // HSL or Hex
  status: 'active' | 'archived';
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
  isBillingOfficer?: boolean;
  notes?: { id: string; content: string; createdAt: string }[];
  attachments?: { id: string; name: string; url: string; type: string; createdAt: string }[];
}

export interface Zone {
  id: string;
  name: string;
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  perspectiveId: string; // Linked to Perspective
  stageIds: string[];
  accessRoles: string[];
  createdAt: string;
}

export type UserRole = 'admin' | 'finance' | 'supervisor' | 'cse' | 'trainer' | 'sales_rep' | 'sales_supervisor' | string;

export const APP_PERMISSIONS = [
  { id: 'schools_view', label: 'View Schools', category: 'Operations' },
  { id: 'schools_edit', label: 'Edit Profiles', category: 'Operations' },
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
  name: string;
  description: string;
  permissions: AppPermissionId[];
  color: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  photoURL?: string;
  color?: string;
  isAuthorized: boolean;
  roles: string[]; // Array of Role IDs
  permissions?: AppPermissionId[]; // Flattened permissions
  createdAt: string; // ISO string
}

export interface DashboardLayout {
  componentIds: string[];
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
  perspectiveId: string; // Dynamic Perspective Link
  status: SchoolStatus;
  lifecycleStatus: LifecycleStatus;
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
  billingTerm?: string;
  nominalRoll?: number;
  arrearsBalance?: number;
  creditBalance?: number;
  modules?: {
    id: string;
    name: string;
    abbreviation: string;
    color: string;
  }[];
  implementationDate?: string; // ISO string
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
  createdAt: string; // ISO string
}

export interface SubscriptionPackage {
  id: string;
  name: string;
  description: string;
  ratePerStudent: number;
  billingTerm: 'term' | 'semester' | 'year';
  currency: string;
  isActive: boolean;
}

export interface BillingPeriod {
  id: string;
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
}

export interface BillingSettings {
  id: string;
  levyPercent: number;
  vatPercent: number;
  defaultDiscount: number;
  paymentInstructions: string;
  signatureName: string;
  signatureDesignation: string;
  signatureUrl?: string;
}

export interface Meeting {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  meetingTime: string; // ISO string
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
  originalName?: string;
  url: string;
  fullPath?: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'link';
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  format?: 'jpeg' | 'png' | 'webp';
  uploadedBy: string;
  createdAt: string; // ISO string
  linkTitle?: string;
  linkDescription?: string;
  previewImageUrl?: string;
}

export interface SurveyQuestion {
  id: string;
  title: string;
  type: 'text' | 'long-text' | 'yes-no' | 'multiple-choice' | 'checkboxes' | 'dropdown' | 'rating' | 'date' | 'time' | 'file-upload' | 'email' | 'phone';
  options?: string[];
  allowOther?: boolean;
  isRequired: boolean;
  hidden?: boolean;
  placeholder?: string;
  defaultValue?: any;
  minLength?: number;
  maxLength?: number;
  enableScoring?: boolean;
  optionScores?: number[];
  yesScore?: number;
  noScore?: number;
  autoAdvance?: boolean;
  style?: {
    textAlign?: 'left' | 'center' | 'right' | 'justify';
  };
}

export interface SurveyLayoutBlock {
  id: string;
  type: 'heading' | 'description' | 'divider' | 'image' | 'video' | 'audio' | 'document' | 'embed' | 'section';
  title?: string;
  description?: string;
  stepperTitle?: string;
  text?: string;
  url?: string;
  html?: string;
  hidden?: boolean;
  renderAsPage?: boolean;
  validateBeforeNext?: boolean;
  variant?: 'h1' | 'h2' | 'h3';
  style?: {
    textAlign?: 'left' | 'center' | 'right' | 'justify';
  };
}

export interface SurveyLogicAction {
  type: 'jump' | 'require' | 'show' | 'hide' | 'disableSubmit';
  targetElementId?: string;
  targetElementIds?: string[];
}

export interface SurveyLogicBlock {
  id: string;
  type: 'logic';
  rules: {
    sourceQuestionId: string;
    operator: 'isEqualTo' | 'isNotEqualTo' | 'contains' | 'doesNotContain' | 'isGreaterThan' | 'isLessThan' | 'isEmpty' | 'isNotEmpty' | 'startsWith' | 'doesNotStartWith' | 'endsWith' | 'doesNotEndWith';
    targetValue?: any;
    action: SurveyLogicAction;
  }[];
}

export type SurveyElement = SurveyQuestion | SurveyLayoutBlock | SurveyLogicBlock;

export interface SurveyResultBlock {
    id: string;
    type: 'heading' | 'text' | 'image' | 'video' | 'button' | 'quote' | 'divider' | 'score-card' | 'list';
    title?: string;
    content?: string;
    url?: string;
    link?: string;
    openInNewTab?: boolean;
    variant?: 'h1' | 'h2' | 'h3';
    items?: string[];
    listStyle?: 'ordered' | 'unordered';
    style?: {
        textAlign?: 'left' | 'center' | 'right' | 'justify';
        variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost' | 'link';
        color?: string;
        backgroundColor?: string;
        padding?: string;
        borderRadius?: string;
        width?: string;
        animate?: boolean;
    };
}

export interface SurveyResultPage {
    id: string;
    name: string;
    isDefault: boolean;
    blocks: SurveyResultBlock[];
}

export interface SurveyResultRule {
    id: string;
    label: string;
    minScore: number;
    maxScore: number;
    priority: number;
    pageId: string;
    emailTemplateId?: string;
    smsTemplateId?: string;
    emailSenderProfileId?: string;
    smsSenderProfileId?: string;
}

export interface Survey {
  id: string;
  internalName: string;
  title: string;
  description: string;
  slug: string;
  logoUrl?: string;
  bannerImageUrl?: string;
  videoUrl?: string;
  videoThumbnailUrl?: string;
  videoCaption?: string;
  backgroundColor?: string;
  backgroundPattern?: 'none' | 'dots' | 'grid' | 'circuit' | 'topography' | 'cubes' | 'gradient';
  patternColor?: string;
  status: 'draft' | 'published' | 'archived';
  elements: SurveyElement[];
  createdAt: string;
  updatedAt: string;
  thankYouTitle?: string;
  thankYouDescription?: string;
  scoringEnabled?: boolean;
  scoreDisplayMode?: 'points' | 'percentage';
  maxScore?: number;
  resultRules?: SurveyResultRule[];
  startButtonText?: string;
  showCoverPage?: boolean;
  showSurveyTitles?: boolean;
  webhookId?: string;
  webhookEnabled?: boolean;
  showDebugProcessingModal?: boolean;
  adminAlertsEnabled?: boolean;
  adminAlertChannel?: 'email' | 'sms' | 'both';
  adminAlertNotifyManager?: boolean;
  adminAlertSpecificUserIds?: string[];
  adminAlertEmailTemplateId?: string;
  adminAlertSmsTemplateId?: string;
  automationMessagingEnabled?: boolean;
  schoolId?: string | null;
  schoolName?: string | null;
}

export interface SurveyResponse {
  id:string;
  surveyId: string;
  submittedAt: string;
  score?: number;
  answers: {
    questionId: string;
    value: any;
  }[];
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

export interface CampaignSession {
  id: string;
  campaignId: string;
  selectedOption: 'school' | 'parent' | null;
  createdAt: string;
  updatedAt: string;
}

export interface SurveySummary {
  id: string;
  summary: string;
  createdAt: string;
  prompt?: string;
}
    
export interface Webhook {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Module {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  description: string;
  order: number;
}

export interface Activity {
  id: string;
  schoolId: string;
  schoolName?: string;
  schoolSlug?: string;
  perspectiveId: string; // Dynamic perspective context
  userId?: string | null;
  type: 'note' | 'call' | 'visit' | 'email' | 'school_created' | 'school_assigned' | 'meeting_created' | 'pipeline_stage_changed' | 'school_updated' | 'form_submission' | 'notification_sent' | 'pdf_uploaded' | 'pdf_published' | 'pdf_form_submitted' | 'pdf_status_changed' | 'task_created' | 'task_completed';
  source: 'manual' | 'user_action' | 'system' | 'public';
  timestamp: string;
  description: string;
  metadata?: {
    from?: string;
    to?: string;
    meetingId?: string;
    content?: string;
    relatedId?: string;
    [key: string]: any;
  };
}

export interface PDFFormField {
  id: string;
  type: 'text' | 'signature' | 'date' | 'dropdown' | 'phone' | 'email' | 'time' | 'photo' | 'static-text' | 'variable';
  label?: string;
  placeholder?: string;
  staticText?: string;
  variableKey?: string;
  pageNumber: number;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  alignment?: 'left' | 'center' | 'right';
  verticalAlignment?: 'top' | 'center' | 'bottom';
  required?: boolean;
  options?: string[];
  textTransform?: 'none' | 'uppercase' | 'capitalize';
}
    
export interface PDFForm {
    id: string;
    name: string;
    publicTitle: string;
    slug: string;
    originalFileName: string;
    storagePath: string;
    downloadUrl: string;
    status: 'draft' | 'published' | 'archived';
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    fields: PDFFormField[];
    namingFieldId?: string | null;
    displayFieldIds?: string[];
    password?: string;
    passwordProtected?: boolean;
    resultsShared?: boolean;
    resultsPassword?: string;
    schoolId?: string | null;
    schoolName?: string | null;
    logoUrl?: string;
    backgroundColor?: string;
    backgroundPattern?: 'none' | 'dots' | 'grid' | 'circuit' | 'topography' | 'cubes' | 'gradient';
    patternColor?: string;
    webhookId?: string;
    webhookEnabled?: boolean;
    confirmationMessagingEnabled?: boolean;
    confirmationTemplateId?: string;
    confirmationSenderProfileId?: string;
    adminAlertsEnabled?: boolean;
    adminAlertChannel?: 'email' | 'sms' | 'both';
    adminAlertNotifyManager?: boolean;
    adminAlertSpecificUserIds?: string[];
    adminAlertEmailTemplateId?: string;
    adminAlertSmsTemplateId?: string;
    isContractDocument?: boolean;
}

export interface Submission {
  id: string;
  pdfId: string;
  submittedAt: string;
  formData: { [key: string]: any };
}

export type ContractStatus = 'no_contract' | 'draft' | 'sent' | 'signed' | 'partially_signed';

export interface Contract {
    id: string;
    schoolId: string;
    schoolName: string;
    pdfId: string; // The template used
    pdfName: string;
    status: ContractStatus;
    submissionId?: string; // The final signed record
    sentAt?: string;
    signedAt?: string;
    updatedAt: string;
    emailTemplateId?: string;
    smsTemplateId?: string;
    recipients: { name: string; email?: string; phone?: string; type: string }[];
}

export interface SenderProfile {
  id: string;
  name: string;
  channel: 'sms' | 'email';
  identifier: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  mNotifyStatus?: 'approved' | 'pending' | 'not_registered' | 'unknown';
  mNotifyMessage?: string;
  resendStatus?: 'verified' | 'pending' | 'not_registered' | 'unknown';
}

export interface MessageStyle {
  id: string;
  name: string;
  htmlWrapper: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageBlockRule {
  variableKey: string;
  operator: 'isEqualTo' | 'isNotEqualTo' | 'contains' | 'doesNotContain' | 'isGreaterThan' | 'isLessThan' | 'isEmpty' | 'isNotEmpty';
  value: string;
}

export interface MessageBlock {
  id: string;
  type: 'heading' | 'text' | 'image' | 'video' | 'button' | 'quote' | 'divider' | 'list' | 'columns' | 'header' | 'footer' | 'logo' | 'score-card';
  title?: string;
  content?: string;
  url?: string;
  link?: string;
  openInNewTab?: boolean;
  variant?: 'h1' | 'h2' | 'h3';
  items?: string[];
  listStyle?: 'ordered' | 'unordered';
  columns?: { blocks: MessageBlock[] }[];
  visibilityLogic?: {
    rules: MessageBlockRule[];
    matchType: 'all' | 'any';
  };
  style?: {
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost' | 'link';
    color?: string;
    backgroundColor?: string;
    padding?: string;
    borderRadius?: string;
    width?: string;
  };
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: 'forms' | 'surveys' | 'meetings' | 'general' | 'contracts' | 'finance';
  channel: 'sms' | 'email';
  subject?: string;
  previewText?: string;
  body: string; 
  blocks?: MessageBlock[]; 
  styleId?: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageLog {
  id: string;
  title?: string;
  templateId: string;
  templateName: string;
  senderProfileId: string;
  senderName: string;
  channel: 'sms' | 'email';
  recipient: string;
  subject?: string;
  previewText?: string;
  body: string;
  status: 'sent' | 'failed' | 'scheduled';
  error?: string;
  sentAt: string;
  variables: Record<string, any>;
  schoolId?: string;
  providerId?: string; 
  providerStatus?: string;
  updatedAt?: string;
  hasAttachments?: boolean;
  attachmentCount?: number;
  openedCount?: number;
  clickedCount?: number;
}

export interface MessageJob {
  id: string;
  templateId: string;
  senderProfileId: string;
  channel: 'sms' | 'email';
  createdBy: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalRecipients: number;
  processed: number;
  success: number;
  failed: number;
  createdAt: string;
}

export interface MessageTask {
  id: string;
  recipient: string;
  variables: Record<string, any>;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  sentAt?: string;
}

export interface VariableDefinition {
  id: string;
  key: string;
  label: string;
  category: 'general' | 'meetings' | 'surveys' | 'forms' | 'finance';
  source: 'static' | 'survey' | 'pdf' | 'constant';
  sourceId?: string; 
  sourceName?: string; 
  entity: 'School' | 'Meeting' | 'SurveyResponse' | 'Submission' | 'Global';
  path: string; 
  type: 'string' | 'number' | 'boolean' | 'date';
  constantValue?: string; 
  hidden?: boolean;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'review' | 'done';
export type TaskCategory = 'call' | 'visit' | 'document' | 'training' | 'general';

export interface TaskReminder {
  reminderTime: string; // ISO string
  channels: ('notification' | 'email' | 'sms')[];
  sent: boolean;
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

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  perspectiveId: string; // dynamic perspective link
  schoolId?: string | null;
  schoolName?: string | null;
  assignedTo: string; // userId
  assignedToName?: string;
  startDate?: string; // ISO string
  dueDate: string; // ISO string
  completedAt?: string; // ISO string
  updatedAt?: string; // ISO string
  createdAt: string; // ISO string
  reminderSent: boolean; // Legacy
  reminders: TaskReminder[];
  notes?: TaskNote[];
  attachments?: TaskAttachment[];
  source: 'manual' | 'automation' | 'system';
  automationId?: string;
  
  // Rich Data Interlinking
  relatedEntityId?: string | null;
  relatedEntityType?: 'SurveyResponse' | 'Submission' | 'Meeting' | 'School' | null;
  relatedParentId?: string | null; // e.g. SurveyId for a Response
}

export type AutomationTrigger = 'SCHOOL_CREATED' | 'SCHOOL_STAGE_CHANGED' | 'SURVEY_SUBMITTED' | 'PDF_SIGNED' | 'TASK_DUE_SOON' | 'INVOICE_OVERDUE' | 'PAYMENT_RECEIVED' | 'TASK_COMPLETED' | 'WEBHOOK_RECEIVED' | 'MEETING_CREATED';

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface AutomationAction {
  type: 'SEND_MESSAGE' | 'CREATE_TASK' | 'UPDATE_RECORD' | 'WEBHOOK' | 'UPDATE_SCHOOL';
  templateId?: string;
  senderProfileId?: string;
  recipientType?: 'manager' | 'fixed' | 'focal_person' | 'respondent';
  focalPersonType?: FocalPersonType;
  fixedRecipient?: string;
  taskTitle?: string;
  taskDescription?: string;
  taskPriority?: TaskPriority;
  taskCategory?: TaskCategory;
  taskDueOffsetDays?: number;
}

export interface Automation {
  id: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  perspectiveId?: string; // Dynamic perspective link
  nodes: any[];
  edges: any[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  automationName: string;
  status: 'running' | 'completed' | 'failed';
  triggerData: any;
  startedAt: string;
  finishedAt?: string;
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

export interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
