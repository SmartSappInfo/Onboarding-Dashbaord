import type { AutomationTrigger } from './types';

/**
 * Maps activity `type` values to automation engine triggers.
 * Single source of truth — import in activity-logger and tests.
 */
export const ACTIVITY_TO_AUTOMATION_TRIGGER: Record<string, AutomationTrigger> = {
  entity_created: 'ENTITY_CREATED',
  entity_updated: 'ENTITY_UPDATED',
  entity_assigned: 'ENTITY_ASSIGNED',
  pipeline_stage_changed: 'ENTITY_STAGE_CHANGED',
  workspace_entity_updated: 'WORKSPACE_ENTITY_UPDATED',
  entity_linked_to_workspace: 'ENTITY_LINKED',
  entity_unlinked_from_workspace: 'ENTITY_UNLINKED',
  pdf_form_submitted: 'PDF_SIGNED',
  form_submission: 'SURVEY_SUBMITTED',
  form_submitted: 'FORM_SUBMITTED',
  task_created: 'TASK_CREATED',
  task_completed: 'TASK_COMPLETED',
  meeting_created: 'MEETING_CREATED',
  meeting_registrant_added: 'MEETING_REGISTRANT_ADDED',
  meeting_registrant_attended: 'MEETING_REGISTRANT_ATTENDED',
  meeting_registrant_no_show: 'MEETING_REGISTRANT_NO_SHOW',
  tag_added: 'TAG_ADDED',
  tag_removed: 'TAG_REMOVED',
  deal_created: 'DEAL_CREATED',
  deal_stage_changed: 'DEAL_STAGE_CHANGED',
  deal_status_changed: 'DEAL_STATUS_CHANGED',
  deal_value_changed: 'DEAL_VALUE_CHANGED',
  page_conversion: 'CAMPAIGN_PAGE_SUBMITTED',
  entity_field_changed: 'ENTITY_FIELD_CHANGED',
  date_reached: 'DATE_REACHED',
  task_overdue: 'TASK_OVERDUE',
  webpage_visited: 'WEBPAGE_VISITED',
  event_recorded: 'EVENT_RECORDED',
  email_bounced: 'EMAIL_BOUNCED',
  score_changed: 'SCORE_CHANGED',
  deal_owner_changed: 'DEAL_OWNER_CHANGED',
  entity_inactive: 'ENTITY_INACTIVE',
};

export function resolveAutomationTrigger(activityType: string): AutomationTrigger | undefined {
  return ACTIVITY_TO_AUTOMATION_TRIGGER[activityType];
}
