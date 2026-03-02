
export const MEETING_TYPES = [
  { id: 'parent', name: 'Parent Engagement', slug: 'parent-engagement' },
  { id: 'kickoff', name: 'Kickoff', slug: 'kickoff' },
  { id: 'training', name: 'Training', slug: 'training' },
] as const;

export type MeetingType = typeof MEETING_TYPES[number];

export type FocalPersonType = 'Champion' | 'Accountant' | 'Administrator' | 'Principal' | 'School Owner';

export type SchoolStatus = 'Active' | 'Inactive' | 'Archived';

export interface FocalPerson {
  name: string;
  phone: string;
  email: string;
  type: FocalPersonType;
}

export interface Zone {
  id: string;
  name: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  photoURL?: string;
  color?: string;
  isAuthorized: boolean;
  createdAt: string; // ISO string
}

export interface DashboardLayout {
  componentIds: string[];
}

export interface OnboardingStage {
  id: string;
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
  contactPerson?: string; // Kept for legacy/migration support
  email?: string; // Kept for legacy/migration support
  phone?: string; // Kept for legacy/migration support
  status: SchoolStatus;
  zone?: Zone;
  focalPersons?: FocalPerson[];
  location?: string;
  nominalRoll?: number;
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

export interface Meeting {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  meetingTime: string; // ISO string
  meetingLink: string;
  type: MeetingType;
  recordingUrl?: string;
  brochureUrl?: string;
  // Internal Notifications
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
    textAlign?: 'left' | 'center' | 'right';
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
    textAlign?: 'left' | 'center' | 'right';
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
    operator: 'isEqualTo' | 'isNotEqualTo' | 'contains' | 'doesNotContain' | 'startsWith' | 'doesNotStartWith' | 'endsWith' | 'doesNotEndWith' | 'isEmpty' | 'isNotEmpty' | 'isGreaterThan' | 'isLessThan';
    targetValue?: any;
    action: SurveyLogicAction;
  }[];
}

export type SurveyElement = SurveyQuestion | SurveyLayoutBlock | SurveyLogicBlock;

export interface SurveyResultBlock {
    id: string;
    type: 'heading' | 'text' | 'image' | 'video' | 'button' | 'quote' | 'divider' | 'score-card';
    title?: string;
    content?: string;
    url?: string;
    link?: string;
    openInNewTab?: boolean;
    variant?: 'h1' | 'h2' | 'h3';
    style?: {
        textAlign?: 'left' | 'center' | 'right';
        variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost' | 'link';
        color?: string;
        backgroundColor?: string;
        padding?: string;
        borderRadius?: string;
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
    // Respondent Messaging
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
  maxScore?: number;
  resultRules?: SurveyResultRule[];
  startButtonText?: string;
  showCoverPage?: boolean;
  showSurveyTitles?: boolean;
  webhookId?: string;
  webhookEnabled?: boolean;
  // Internal Notifications (Upgraded)
  adminAlertsEnabled?: boolean;
  adminAlertChannel?: 'email' | 'sms' | 'both';
  adminAlertNotifyManager?: boolean;
  adminAlertSpecificUserIds?: string[];
  adminAlertEmailTemplateId?: string;
  adminAlertSmsTemplateId?: string;
  // Legacy (Preserved for migration)
  adminSmsNotificationEnabled?: boolean;
  adminSmsTemplateId?: string;
  adminSmsSenderProfileId?: string;
  adminSmsRecipient?: string;
  adminEmailNotificationEnabled?: boolean;
  adminEmailTemplateId?: string;
  adminEmailSenderProfileId?: string;
  adminEmailRecipient?: string;
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
  userId?: string | null;
  type: 'note' | 'call' | 'visit' | 'email' | 'school_created' | 'school_assigned' | 'meeting_created' | 'pipeline_stage_changed' | 'school_updated' | 'form_submission' | 'notification_sent' | 'pdf_uploaded' | 'pdf_published' | 'pdf_form_submitted' | 'pdf_status_changed';
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
  type: 'text' | 'signature' | 'date' | 'dropdown' | 'phone' | 'email' | 'time' | 'photo';
  label?: string;
  placeholder?: string;
  pageNumber: number;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  alignment?: 'left' | 'center' | 'right';
  verticalAlignment?: 'top' | 'center' | 'bottom';
  required?: boolean;
  options?: string[];
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
    // Internal Notifications
    adminAlertsEnabled?: boolean;
    adminAlertChannel?: 'email' | 'sms' | 'both';
    adminAlertNotifyManager?: boolean;
    adminAlertSpecificUserIds?: string[];
    adminAlertEmailTemplateId?: string;
    adminAlertSmsTemplateId?: string;
}

export interface Submission {
  id: string;
  pdfId: string;
  submittedAt: string;
  formData: { [key: string]: any };
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
  mNotifyStatus?: string;
  resendStatus?: string;
}

export interface MessageStyle {
  id: string;
  name: string;
  htmlWrapper: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: 'forms' | 'surveys' | 'meetings' | 'general';
  channel: 'sms' | 'email';
  subject?: string;
  body: string;
  styleId?: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageLog {
  id: string;
  templateId: string;
  templateName: string;
  senderProfileId: string;
  senderName: string;
  channel: 'sms' | 'email';
  recipient: string;
  subject?: string;
  body: string;
  status: 'sent' | 'failed' | 'scheduled';
  error?: string;
  sentAt: string;
  variables: Record<string, any>;
  schoolId?: string;
  providerId?: string; // Provider-specific ID (e.g. mNotify Campaign ID)
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
