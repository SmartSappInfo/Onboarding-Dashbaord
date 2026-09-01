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
  | 'in_range'
  | 'has_any_tag'
  | 'has_all_tags';

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
  | 'redirect_campaign';

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
  redirectUrl?: string;
  delayMinutes?: number; // 0 = immediate, 60 = 1h delay, etc.
}

export interface SurveyDecisionRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
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
  | 'sla_breach';

export interface SystemDecisionPlaybook {
  id: string;
  name: string;
  description: string;
  category: DecisionPlaybookCategory;
  isProtected: boolean;
  rule: Omit<SurveyDecisionRule, 'id'>;
}
