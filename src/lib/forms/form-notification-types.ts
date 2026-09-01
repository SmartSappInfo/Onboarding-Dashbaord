/**
 * SmartSapp Forms 2.0: 3-Tier Multi-Channel Notification Types
 * 
 * Defines domain models for internal team alerts (Tier 1), respondent
 * confirmations & auto-responders (Tier 2), and external stakeholders (Tier 3).
 */

export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'in_app' | 'push';

export interface AutoResponderCondition {
  fieldId?: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: string | number;
}

export interface AutoResponderRule {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: 'immediate' | 'score_threshold' | 'conditional';
  minScore?: number;
  condition?: AutoResponderCondition;
  channel: 'email' | 'sms' | 'whatsapp';
  templateId: string;
}

export interface InternalAlertConfig {
  enabled: boolean;
  userIds?: string[];
  notifyDealOwner?: boolean;
  emailTemplateId?: string;
  smsTemplateId?: string;
  whatsappTemplateId?: string;
  inAppTemplateId?: string;
  pushTemplateId?: string;
}

export interface RespondentAlertConfig {
  enabled: boolean;
  respondentEmailField?: string;
  respondentPhoneField?: string;
  emailTemplateId?: string;
  smsTemplateId?: string;
  whatsappTemplateId?: string;
  autoResponderRules?: AutoResponderRule[];
}

export interface ExternalAlertConfig {
  enabled: boolean;
  emailAddresses?: string[];
  emailTemplateId?: string;
  includeSubmissionSummary?: boolean;
}

export interface FormNotificationSettings {
  /** @deprecated Use internalAlerts.userIds */
  internalUserIds?: string[];
  /** @deprecated Use respondentAlerts */
  sendConfirmationEmail?: boolean;
  internalAlerts?: InternalAlertConfig;
  respondentAlerts?: RespondentAlertConfig;
  externalAlerts?: ExternalAlertConfig;
}

export interface TestNotificationPayload {
  channel: 'email' | 'sms' | 'whatsapp';
  templateId: string;
  recipient: string;
  workspaceId: string;
  organizationId: string;
  formTitle: string;
  sampleAnswers?: Record<string, string | number | boolean>;
}
