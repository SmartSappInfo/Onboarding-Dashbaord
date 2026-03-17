
export const MEETING_TYPES = [
  { id: 'parent', name: 'Parent Engagement', slug: 'parent-engagement' },
  { id: 'kickoff', name: 'Kickoff', slug: 'kickoff' },
  { id: 'training', name: 'Training', slug: 'training' },
] as const;

export type MeetingType = typeof MEETING_TYPES[number];

export type FocalPersonType = 'Champion' | 'Accountant' | 'Administrator' | 'Principal' | 'School Owner' | string;

export type SchoolStatusState = 'Active' | 'Inactive' | 'Archived';

/**
 * Defines a managed Workspace.
 */
export interface Workspace {
  id: string;
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

export type InstitutionalTrack = 'onboarding' | 'prospect' | string;

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
}

export interface Zone {
  id: string;
  name: string;
}

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  workspaceId: string; 
  stageIds: string[];
  accessRoles: string[];
  columnWidth?: number;
  createdAt: string;
  updatedAt?: string;
}

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
  workspaceIds: string[]; 
  color: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
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
  workspaceIds: string[]; 
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
  createdAt: string;
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
  workspaceIds: string[]; 
  meetingTime: string;
  meetingLink: string;
  type: MeetingType;
  heroImageUrl?: string;
  recordingUrl?: string;
  brochureUrl?: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  originalName?: string;
  url: string;
  fullPath?: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'link';
  workspaceIds: string[]; 
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  format?: 'jpeg' | 'png' | 'webp';
  uploadedBy: string;
  createdAt: string;
  linkTitle?: string;
  linkDescription?: string;
  previewImageUrl?: string;
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
  workspaceIds: string[]; 
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
  schoolId?: string | null;
  schoolName?: string | null;
}

export type SurveyElement = SurveyQuestion | SurveyLayoutBlock | SurveyLogicBlock;

export interface PDFForm {
    id: string;
    name: string;
    publicTitle: string;
    slug: string;
    originalFileName: string;
    storagePath: string;
    downloadUrl: string;
    status: 'draft' | 'published' | 'archived';
    workspaceIds: string[]; 
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

export interface Activity {
  id: string;
  schoolId: string;
  schoolName?: string;
  schoolSlug?: string;
  workspaceIds: string[]; 
  userId?: string | null;
  type: 'note' | 'call' | 'visit' | 'email' | 'school_created' | 'school_assigned' | 'meeting_created' | 'pipeline_stage_changed' | 'school_updated' | 'form_submission' | 'notification_sent' | 'pdf_uploaded' | 'pdf_published' | 'pdf_form_submitted' | 'pdf_status_changed' | 'task_created' | 'task_completed';
  source: 'manual' | 'user_action' | 'system' | 'public';
  timestamp: string;
  description: string;
  metadata?: any;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  workspaceId: string; 
  schoolId?: string | null;
  schoolName?: string | null;
  assignedTo: string;
  assignedToName?: string;
  startDate?: string;
  dueDate: string;
  completedAt?: string;
  updatedAt?: string;
  createdAt: string;
  reminders: any[];
  notes?: any[];
  attachments?: any[];
  source: 'manual' | 'automation' | 'system';
  automationId?: string;
  relatedEntityId?: string | null;
  relatedEntityType?: 'SurveyResponse' | 'Submission' | 'Meeting' | 'School' | null;
  relatedParentId?: string | null;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'waiting' | 'review' | 'done';
export type TaskCategory = 'call' | 'visit' | 'document' | 'training' | 'general';

export interface Automation {
  id: string;
  name: string;
  description?: string;
  trigger: AutomationTrigger;
  workspaceId: string; 
  nodes: any[];
  edges: any[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type AutomationTrigger = 'SCHOOL_CREATED' | 'SCHOOL_STAGE_CHANGED' | 'TASK_COMPLETED' | 'SURVEY_SUBMITTED' | 'PDF_SIGNED' | 'WEBHOOK_RECEIVED' | 'MEETING_CREATED';

export interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  channel: 'sms' | 'email';
  workspaceIds: string[]; 
  subject?: string;
  body: string;
  blocks?: any[];
  styleId?: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageStyle {
  id: string;
  name: string;
  htmlWrapper: string;
  workspaceIds: string[]; 
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
  workspaceIds: string[]; 
  schoolId?: string | null;
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
  workspaceIds: string[]; 
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
