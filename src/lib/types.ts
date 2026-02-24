export const MEETING_TYPES = [
  { id: 'parent', name: 'Parent Engagement', slug: 'parent-engagement' },
  { id: 'kickoff', name: 'Kickoff', slug: 'kickoff' },
  { id: 'training', name: 'Training', slug: 'training' },
] as const;

export type MeetingType = typeof MEETING_TYPES[number];


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
  contactPerson?: string;
  email?: string;
  phone?: string;
  additionalEmails?: string[];
  additionalPhones?: string[];
  location?: string;
  nominalRoll?: number;
  modules?: {
    id: string;
    name: string;
    abbreviation: string;
    color: string;
  }[];
  moduleRequestNotes?: string;
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
  type: 'text' | 'long-text' | 'yes-no' | 'multiple-choice' | 'checkboxes' | 'dropdown' | 'rating' | 'date' | 'time' | 'file-upload';
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
  title?: string; // For heading and section
  description?: string; // For section
  stepperTitle?: string; // For section progress tracking
  text?: string; // For description
  url?: string; // For media types
  html?: string; // For embed
  hidden?: boolean;
  renderAsPage?: boolean;
  variant?: 'h1' | 'h2' | 'h3'; // For headings
  style?: {
    textAlign?: 'left' | 'center' | 'right';
  };
}

export interface SurveyLogicAction {
  type: 'jump' | 'require' | 'show' | 'hide' | 'disableSubmit';
  targetElementId?: string; // For 'jump'
  targetElementIds?: string[]; // For 'require', 'show', 'hide'
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
    content?: string; // Rich text / HTML
    url?: string;
    link?: string;
    openInNewTab?: boolean;
    variant?: 'h1' | 'h2' | 'h3'; // Added for headings
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
}

export interface Survey {
  id: string;
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
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  thankYouTitle?: string;
  thankYouDescription?: string;
  scoringEnabled?: boolean;
  maxScore?: number;
  resultRules?: SurveyResultRule[];
  startButtonText?: string;
  showCoverPage?: boolean;
  showSurveyTitles?: boolean;
}

export interface SurveyResponse {
  id:string;
  surveyId: string;
  submittedAt: string; // ISO string
  score?: number;
  answers: {
    questionId: string;
    value: any; // Can be string, string[], number, or object for checkboxes with 'other'
  }[];
}

export interface SurveySummary {
  id: string;
  summary: string;
  createdAt: string; // ISO string
  prompt?: string;
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
  userId?: string | null;
  type: 'note' | 'call' | 'visit' | 'email' | 'school_created' | 'school_assigned' | 'meeting_created' | 'pipeline_stage_changed' | 'school_updated' | 'form_submission' | 'notification_sent' | 'pdf_uploaded' | 'pdf_published' | 'pdf_form_submitted' | 'pdf_status_changed';
  source: 'manual' | 'user_action' | 'system' | 'public';
  timestamp: string; // ISO string
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
  required?: boolean;
  options?: string[];
}
    
export interface PDFForm {
    id: string;
    name: string;
    slug: string;
    originalFileName: string;
    storagePath: string;
    downloadUrl: string;
    status: 'draft' | 'published' | 'archived';
    createdBy: string;
    createdAt: string; // ISO String
    updatedAt: string; // ISO String
    fields: PDFFormField[];
    namingFieldId?: string | null;
    displayFieldIds?: string[];
    password?: string;
    passwordProtected?: boolean;
    resultsShared?: boolean;
    resultsPassword?: string;
}

export interface Submission {
  id: string;
  pdfId: string;
  submittedAt: string; // ISO String
  formData: { [key: string]: any };
}
