/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 6: CRM Intelligence Types
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Deep two-way integration between Survey Responses and CRM (Contacts, Entities, Deals, Tasks, Activities).
 * 2. Strict typing across all mapping rules, sync payloads, and timeline models.
 */

export type CrmTargetEntityType = 'contact' | 'entity' | 'deal';

export type CrmFieldWriteMode = 'fill_if_empty' | 'always_overwrite' | 'append_history';

export type CrmFieldTransform = 'none' | 'trim' | 'lowercase' | 'uppercase' | 'number' | 'boolean' | 'date';

export interface SurveyCrmFieldMapping {
  id: string;
  questionId: string;
  targetType: CrmTargetEntityType;
  targetField: string; // e.g. 'firstName', 'email', 'customFields.budget', 'customData.grade'
  targetFieldLabel?: string;
  writeMode: CrmFieldWriteMode;
  transform?: CrmFieldTransform;
  isRequired?: boolean;
}

export type CrmTaskTriggerCondition =
  | 'always'
  | 'score_below'
  | 'score_above'
  | 'sentiment_negative'
  | 'nps_detractor'
  | 'outcome_matched';

export interface SurveyCrmTaskRule {
  id: string;
  triggerOn: CrmTaskTriggerCondition;
  thresholdValue?: number; // e.g. score < 50 or nps <= 6
  matchedOutcomeId?: string;
  taskTitleTemplate: string; // e.g. 'Follow up with {{contact.name}} regarding low survey satisfaction'
  taskDescriptionTemplate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueInHours: number; // e.g. 24 for +24h due date
  assignTo: 'survey_owner' | 'deal_owner' | 'entity_owner' | 'specific_user';
  assignedUserId?: string;
  autoTagIds?: string[];
}

export interface SurveyCrmDealRule {
  id: string;
  triggerOn: 'always' | 'score_above' | 'outcome_matched';
  thresholdValue?: number;
  matchedOutcomeId?: string;
  pipelineId: string;
  stageId: string;
  dealTitleTemplate: string; // e.g. 'Inquiry: {{contact.name}} - Survey Lead'
  dealValueQuestionId?: string; // If a question captures expected budget/deal amount
  fixedDealValue?: number;
  createIfNoOpenDeal: boolean;
  assignedUserId?: string;
}

export type CrmInboundTriggerEvent =
  | 'deal_won'
  | 'deal_stage_changed'
  | 'meeting_completed'
  | 'contact_created'
  | 'lead_status_changed';

export interface SurveyCrmInboundTriggerRule {
  id: string;
  enabled: boolean;
  event: CrmInboundTriggerEvent;
  pipelineId?: string;
  stageId?: string;
  leadStatus?: string;
  delayDays?: number; // e.g. 0 (immediate), 7 (after 7 days), 14
  channel: 'email' | 'sms' | 'whatsapp';
  customMessage?: string;
}

export interface SurveyCrmInboundTriggerConfig {
  enabled: boolean;
  rules: SurveyCrmInboundTriggerRule[];
}

export interface SurveyCrmConfig {
  enabled: boolean;
  autoUpsertContact: boolean;
  autoUpsertEntity: boolean;
  fieldMappings: SurveyCrmFieldMapping[];
  taskRules: SurveyCrmTaskRule[];
  dealRules: SurveyCrmDealRule[];
  inboundTriggers?: SurveyCrmInboundTriggerConfig;
  leadScoreAdjustment?: {
    enabled?: boolean;
    pointsPerSurveyCompleted?: number;
    pointsForPromoter?: number;
    pointsForDetractor?: number;
  };
  timelineLoggingEnabled: boolean;
}

export interface SurveyCrmFieldDefinition {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'select' | 'array';
  group: 'Standard Contact' | 'Entity Custom Fields' | 'Deal Fields';
  targetType: CrmTargetEntityType;
  description?: string;
}

export interface SurveyActivityTimelinePayload {
  activityId?: string;
  type: 'survey_submission';
  surveyId: string;
  surveyTitle: string;
  surveyVersion?: number;
  responseId: string;
  score?: number;
  maxScore?: number;
  percentageScore?: number;
  sentimentPolarity?: 'positive' | 'mostly_positive' | 'neutral' | 'mostly_negative' | 'negative' | 'mixed';
  netSentimentScore?: number;
  submittedAt: string;
  durationSeconds?: number;
  channel?: string;
  answerHighlights: Array<{
    questionId: string;
    questionTitle: string;
    answerValue: string;
  }>;
  reviewUrl: string; // Direct relative deep-link: /admin/surveys/[id]/results/[responseId]
  respondentName?: string | null;
  respondentEmail?: string | null;
  respondentPhone?: string | null;
}

export interface SystemCrmFieldMappingTemplate {
  id: string;
  archetype: string; // e.g. 'nps', 'ces', 'lead_generation', 'parent_satisfaction'
  standardQuestionTitle: string;
  suggestedTargetType: CrmTargetEntityType;
  suggestedTargetField: string;
  suggestedWriteMode: CrmFieldWriteMode;
  isProtected?: boolean;
}
