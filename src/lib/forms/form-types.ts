/**
 * SmartSapp Forms 2.0 Core Platform Types
 * 
 * Defines canonical domain models for Forms 2.0:
 * Form, FormVersion, FormPage, FormComponent, FormField, FormSession, FormEvent,
 * FormSettings, FormThemeConfig, and related types.
 */

import type { Timestamp } from 'firebase/firestore';
import type { 
  AppField, 
  FormFieldInstance, 
  FormThemeConfig, 
  FormSuccessBehavior, 
  FormSubmissionActions,
  SeoConfig,
} from '@/lib/types';

export type FormPurpose =
  | 'lead_capture'
  | 'contact'
  | 'qualification'
  | 'application'
  | 'registration'
  | 'onboarding'
  | 'feedback'
  | 'assessment'
  | 'research'
  | 'booking_intake'
  | 'payment'
  | 'support'
  | 'internal_request'
  | 'data_update'
  | 'custom';

export type AudienceMode =
  | 'anonymous'
  | 'known_contact'
  | 'crm_bound'
  | 'authenticated'
  | 'mixed';

export type FormLifecycleStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'paused'
  | 'archived';

export type FieldSemanticType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'url'
  | 'date'
  | 'time'
  | 'datetime'
  | 'select'
  | 'multi_select'
  | 'radio'
  | 'checkbox'
  | 'rating'
  | 'ranking'
  | 'slider'
  | 'matrix'
  | 'likert'
  | 'address'
  | 'location'
  | 'file'
  | 'image'
  | 'signature'
  | 'otp'
  | 'contact'
  | 'institution'
  | 'family'
  | 'deal'
  | 'owner'
  | 'tag'
  | 'hidden'
  | 'formula'
  | 'consent'
  | 'payment'
  | 'calendar';

export type FormComponentType =
  | 'field'
  | 'section'
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'video'
  | 'divider'
  | 'button'
  | 'card'
  | 'accordion'
  | 'field_group'
  | 'consent'
  | 'payment'
  | 'signature'
  | 'file'
  | 'calendar';

export interface FormValidationRule {
  type: 'required' | 'min' | 'max' | 'regex' | 'email' | 'url' | 'phone' | 'custom';
  value?: string | number | boolean;
  message?: string;
}

export interface FormFieldOption {
  label: string;
  value: string;
  description?: string;
  icon?: string;
  isDefault?: boolean;
}

export interface CrmFieldMapping {
  entityType: 'person' | 'family' | 'institution' | 'deal' | 'task';
  appFieldId: string;
  variableName: string;
  updateStrategy: 'always' | 'if_empty' | 'append';
}

export interface FormField {
  id: string;
  versionId?: string;
  appFieldId?: string;
  semanticType: FieldSemanticType;
  label: string;
  description?: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  hidden: boolean;
  readonly?: boolean;
  defaultValue?: string | number | boolean | string[] | null;
  options?: FormFieldOption[];
  validation?: FormValidationRule[];
  crmMapping?: CrmFieldMapping;
  settings?: Record<string, unknown>;
}

export interface FormComponent {
  id: string;
  type: FormComponentType;
  order: number;
  fieldId?: string;
  field?: FormField;
  parentComponentId?: string;
  layout: {
    width: 'full' | 'half' | 'third';
    alignment?: 'left' | 'center' | 'right';
  };
  content?: {
    title?: string;
    text?: string;
    mediaUrl?: string;
    altText?: string;
    buttonLabel?: string;
    buttonAction?: 'next' | 'submit' | 'link';
    buttonUrl?: string;
    consentText?: string;
    consentUrl?: string;
  };
  style?: Record<string, string | number>;
}

export interface FormPage {
  id: string;
  versionId?: string;
  title?: string;
  description?: string;
  order: number;
  components: FormComponent[];
  analyticsLabel?: string;
  progressWeight?: number;
}

export interface FormVersion {
  id: string;
  formId: string;
  versionNumber: number;
  status: 'draft' | 'in_review' | 'approved' | 'published' | 'superseded';
  schemaVersion: string;
  pages: FormPage[];
  themeVersionId?: string;
  checksum?: string;
  createdBy?: string;
  createdAt: string;
  publishedBy?: string;
  publishedAt?: string;
  supersededAt?: string;
}

export interface FormSettings {
  allowResubmission?: boolean;
  maxSubmissionsPerRespondent?: number;
  submissionWindow?: {
    startsAt?: string;
    endsAt?: string;
  };
  saveProgress?: boolean;
  allowResume?: boolean;
  showProgress?: boolean;
  progressStyle?: 'percentage' | 'steps' | 'bar' | 'none';
  confirmation?: {
    type: 'inline' | 'modal' | 'thank_you_page' | 'redirect';
    message?: string;
    redirectUrl?: string;
    countdownSeconds?: number;
  };
  localeDetection?: boolean;
  timezoneMode?: 'respondent' | 'workspace' | 'fixed';
  accessibilityMode?: 'standard' | 'enhanced';
  spamProtection?: {
    enabled: boolean;
    provider?: string;
    threshold?: number;
  };
}

export interface FormSession {
  id: string;
  formId: string;
  versionId?: string;
  workspaceId: string;
  organizationId: string;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  pagesViewed?: string[];
  lastActivePageId?: string;
  ipAddress?: string;
  userAgent?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  device?: 'desktop' | 'tablet' | 'mobile';
}

export interface FormEvent {
  id: string;
  sessionId: string;
  formId: string;
  eventType: 'session_start' | 'page_view' | 'field_focus' | 'field_blur' | 'field_change' | 'page_next' | 'page_back' | 'form_submit' | 'form_abandon';
  pageId?: string;
  fieldId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
