import type { Automation, AutomationTrigger } from './types';

/**
 * Filter logic for specialized triggers (tags, stages, forms, meetings, campaigns).
 */
export function evaluateTriggerConfig(
  automation: Automation,
  payload: Record<string, unknown>
): boolean {
  const triggerNode = automation.nodes.find((n) => n.type === 'triggerNode');
  if (!triggerNode || !triggerNode.data?.config) return true;

  const config = triggerNode.data.config as Record<string, unknown>;

  if (automation.trigger === 'TAG_ADDED' || automation.trigger === 'TAG_REMOVED') {
    const tagIds = config.tagIds as string[] | undefined;
    if (tagIds?.length && !tagIds.includes(payload.tagId as string)) return false;

    if (config.entityType && config.entityType !== payload.entityType) return false;

    if (config.appliedBy) {
      const appliedBy = payload.appliedBy as string | undefined;
      const isAutomatic =
        appliedBy === 'automation' || (appliedBy && appliedBy.startsWith('system'));
      if (config.appliedBy === 'manual' && isAutomatic) return false;
      if (config.appliedBy === 'automatic' && !isAutomatic) return false;
    }
  }

  if (automation.trigger === 'DEAL_STAGE_CHANGED' || automation.trigger === 'ENTITY_STAGE_CHANGED') {
    if (config.pipelineId && config.pipelineId !== payload.pipelineId) return false;
    if (config.stageId && config.stageId !== payload.stageId) return false;
  }

  if (automation.trigger === 'FORM_SUBMITTED' && config.formId && config.formId !== payload.formId) {
    return false;
  }

  if (
    automation.trigger === 'SURVEY_SUBMITTED' &&
    config.surveyId &&
    config.surveyId !== payload.surveyId
  ) {
    return false;
  }

  if (
    (automation.trigger === 'MEETING_CREATED' ||
      automation.trigger === 'MEETING_REGISTRANT_ADDED' ||
      automation.trigger === 'MEETING_REGISTRANT_ATTENDED' ||
      automation.trigger === 'MEETING_REGISTRANT_NO_SHOW') &&
    config.meetingTypeId &&
    config.meetingTypeId !== payload.meetingTypeId
  ) {
    return false;
  }

  const campaignTriggers: AutomationTrigger[] = [
    'CAMPAIGN_DELIVERED',
    'CAMPAIGN_FAILED',
    'CAMPAIGN_NOT_DELIVERED',
    'CAMPAIGN_OPENED',
    'CAMPAIGN_CLICKED',
  ];
  if (
    campaignTriggers.includes(automation.trigger) &&
    config.campaignId &&
    config.campaignId !== payload.campaignId
  ) {
    return false;
  }

  return true;
}
