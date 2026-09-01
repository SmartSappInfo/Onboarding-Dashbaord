/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 7: Automation & Decisioning Engine Types
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Multi-Condition Logic Engine:
 *    - Strict typing for conditions across Score, NPS category, Sentiment, Question answers, Tags, and Anomalies.
 * 2. Multi-Action Dispatch Pipeline:
 *    - Strict typing for CRM actions, tag management, pipeline moves, task dispatches, and AI prescriptions.
 * 3. Platform Playbooks:
 *    - Reusable enterprise automation templates.
 * 4. Strict Zero-Any Invariant.
 */

export type SurveyDecisionTriggerType =
  | 'survey_submitted'
  | 'survey_started'
  | 'survey_abandoned'
  | 'question_answered'
  | 'quota_reached'
  | 'anomaly_flagged';

export type SurveyDecisionConditionType =
  | 'score'
  | 'nps_category'
  | 'sentiment'
  | 'question_answer'
  | 'quota_reached'
  | 'drop_off'
  | 'anomaly_detected'
  | 'contact_tag';

export type SurveyDecisionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'does_not_contain'
  | 'starts_with'
  | 'in_range'
  | 'has_any_tag'
  | 'has_all_tags'
  | 'has_any_option'
  | 'has_all_options'
  | 'is_empty'
  | 'is_not_empty';

export interface SurveyDecisionCondition {
  id: string;
  type: SurveyDecisionConditionType;
  operator: SurveyDecisionOperator;
  field?: string; // Question ID, metadata field, or custom key
  value: string | number | boolean | string[];
  secondaryValue?: number; // Used for 'in_range' (e.g. min/max)
}

export type SurveyDecisionActionType =
  | 'apply_tags'
  | 'remove_tags'
  | 'move_pipeline_stage'
  | 'assign_user'
  | 'adjust_lead_score'
  | 'create_deal'
  | 'dispatch_message'
  | 'create_task'
  | 'trigger_ai_prescription'
  | 'redirect_campaign'
  | 'trigger_webhook';

export interface SurveyDecisionDealConfig {
  titleTemplate?: string;
  valueQuestionId?: string;
  defaultValue?: number;
}

export interface SurveyDecisionMessageConfig {
  channel: 'email' | 'sms' | 'whatsapp';
  templateId?: string;
  subject?: string;
  bodyTemplate?: string;
}

export interface SurveyDecisionTaskConfig {
  titleTemplate: string;
  descriptionTemplate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueInHours?: number;
}

export interface SurveyDecisionAiPrescriptionConfig {
  generateActionPlan: boolean;
  notifyOwner: boolean;
  playbookArchetype?: string;
}

export interface SurveyDecisionWebhookConfig {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  customPayload?: Record<string, unknown>;
}

export interface SurveyDecisionAction {
  id: string;
  type: SurveyDecisionActionType;
  targetType?: 'contact' | 'entity' | 'deal' | 'system';
  tagIds?: string[];
  pipelineId?: string;
  stageId?: string;
  assignedUserId?: string;
  scoreDelta?: number;
  dealConfig?: SurveyDecisionDealConfig;
  messageConfig?: SurveyDecisionMessageConfig;
  taskConfig?: SurveyDecisionTaskConfig;
  aiPrescriptionConfig?: SurveyDecisionAiPrescriptionConfig;
  webhookConfig?: SurveyDecisionWebhookConfig;
  redirectUrl?: string;
  delayMinutes?: number; // 0 = immediate, 60 = 1h delay, 1440 = 24h delay, etc.
}

export interface SurveyDecisionRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggerType?: SurveyDecisionTriggerType;
  conditionLogic: 'AND' | 'OR';
  conditions: SurveyDecisionCondition[];
  actions: SurveyDecisionAction[];
}

export interface SurveyDecisionConfig {
  enabled: boolean;
  rules: SurveyDecisionRule[];
  defaultActions?: SurveyDecisionAction[];
}

export interface SurveyDecisionExecutionLog {
  id: string;
  surveyId: string;
  responseId: string;
  ruleId: string;
  ruleName: string;
  matched: boolean;
  actionsExecuted: string[];
  timestamp: string;
  error?: string;
}

export type DecisionPlaybookCategory =
  | 'detractor_recovery'
  | 'promoter_upsell'
  | 'lead_qualification'
  | 'retention_intervention'
  | 'sla_breach'
  | 'dropoff_reengagement';

export interface SystemDecisionPlaybook {
  id: string;
  name: string;
  description: string;
  category: DecisionPlaybookCategory;
  isProtected: boolean;
  rule: Omit<SurveyDecisionRule, 'id'>;
}

export interface SurveyDecisionSimulationResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  evaluatedConditions: Array<{
    conditionId: string;
    type: SurveyDecisionConditionType;
    passed: boolean;
    reason: string;
  }>;
  prescribedActions: Array<{
    actionId: string;
    type: SurveyDecisionActionType;
    summary: string;
    delayMinutes?: number;
  }>;
}

export interface SurveyDecisionContext {
  survey: import('../types').Survey;
  responseId: string;
  score?: number;
  sentimentPolarity?: string;
  answers: Array<{ questionId: string; value: string | string[] | number | boolean | Record<string, unknown> }>;
  workspaceId: string;
  organizationId?: string;
  contactId?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactName?: string | null;
  contactTags?: string[];
  entityId?: string | null;
  entityName?: string | null;
  isAnomaly?: boolean;
  isDropOff?: boolean;
  quotaReached?: boolean;
}
