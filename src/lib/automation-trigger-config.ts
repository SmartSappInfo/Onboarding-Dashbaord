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

  if (automation.trigger === 'ENTITY_FIELD_CHANGED') {
    if (config.fieldPath && config.fieldPath !== payload.fieldPath) return false;
  }

  if (automation.trigger === 'SCORE_CHANGED') {
    const scoreType = (config.scoreType as string) || 'overallScore';
    const operator = (config.operator as string) || 'any_change';
    const threshold = (config.threshold as number) ?? 50;

    const newValue = payload[scoreType] as number | undefined;
    if (newValue === undefined) return false;

    if (operator === 'greater_than' && !(newValue > threshold)) return false;
    if (operator === 'less_than' && !(newValue < threshold)) return false;
  }

  if (automation.trigger === 'WEBPAGE_VISITED') {
    const urlPattern = config.urlPattern as string | undefined;
    const visitedUrl = payload.url as string | undefined;
    if (urlPattern && visitedUrl && !visitedUrl.includes(urlPattern) && urlPattern !== '*') {
      return false;
    }
  }

  if (automation.trigger === 'EVENT_RECORDED') {
    if (config.eventName && config.eventName !== payload.eventName) return false;
  }

  return true;
}
