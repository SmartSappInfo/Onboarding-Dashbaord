import type { Automation, AutomationTrigger, AutomationTriggerDef } from './types';

/**
 * Resolves the config for the currently-firing trigger from the automation's triggers array.
 *
 * The orchestrator injects `_firingTrigger` into every payload so this function
 * knows which AutomationTriggerDef to use when an automation has multiple triggers,
 * each with its own isolated configuration.
 */
function getActiveTriggerConfig(
  automation: Automation,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const firingTrigger = payload._firingTrigger as AutomationTrigger | undefined;

  if (firingTrigger && automation.triggers?.length) {
    const def = automation.triggers.find((t) => t.type === firingTrigger);
    if (def?.config) return def.config;
  }

  // Fallback for single-trigger automations only: read config from the canvas
  // triggerNode. This path is intentionally NOT taken for multi-trigger automations
  // (see the guard in evaluateTriggerConfig below).
  const triggerNode = automation.nodes?.find((n: any) => n.type === 'triggerNode');
  return (triggerNode?.data?.config as Record<string, unknown>) ?? {};
}

/**
 * Filter logic for specialized trigger configurations (tags, stages, forms, meetings, campaigns).
 *
 * Returns true if the automation should fire for this payload.
 * Returns false to skip execution (config mismatch).
 */
export function evaluateTriggerConfig(
  automation: Automation,
  payload: Record<string, unknown>
): boolean {
  const firingTrigger =
    (payload._firingTrigger as AutomationTrigger | undefined) ??
    // Only take the single-trigger fallback when there is exactly one trigger.
    // For multi-trigger automations leave it undefined so the guard below can deny.
    ((automation.triggers?.length === 1
      ? automation.triggers[0].type
      : undefined) as AutomationTrigger | undefined);

  // Guard: if we cannot identify which trigger fired on a multi-trigger automation,
  // we cannot know which config constraints to validate. Deny to avoid incorrectly
  // firing with the wrong (or no) config. This should never happen in production
  // because the orchestrator always injects _firingTrigger, but protects against
  // direct/test call sites that omit it.
  if (!firingTrigger && (automation.triggers?.length ?? 0) > 1) {
    return false;
  }

  if (!firingTrigger) return true;

  const config = getActiveTriggerConfig(automation, payload);

  // ── Tag Triggers ──────────────────────────────────────────────────────────
  if (firingTrigger === 'TAG_ADDED' || firingTrigger === 'TAG_REMOVED') {
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

  // ── Stage / Pipeline Triggers ─────────────────────────────────────────────
  if (firingTrigger === 'DEAL_STAGE_CHANGED' || firingTrigger === 'ENTITY_STAGE_CHANGED') {
    if (config.pipelineId && config.pipelineId !== payload.pipelineId) return false;
    if (config.stageId && config.stageId !== payload.stageId) return false;
  }

  // ── Form / Survey / Campaign Page ─────────────────────────────────────────
  if (firingTrigger === 'FORM_SUBMITTED' && config.formId && config.formId !== payload.formId) {
    return false;
  }

  if (
    firingTrigger === 'SURVEY_SUBMITTED' &&
    config.surveyId &&
    config.surveyId !== payload.surveyId
  ) {
    return false;
  }

  // ── Meeting Triggers ──────────────────────────────────────────────────────
  const meetingTriggers: AutomationTrigger[] = [
    'MEETING_CREATED',
    'MEETING_REGISTRANT_ADDED',
    'MEETING_REGISTRANT_ATTENDED',
    'MEETING_REGISTRANT_NO_SHOW',
  ];
  if (
    meetingTriggers.includes(firingTrigger) &&
    config.meetingTypeId &&
    config.meetingTypeId !== payload.meetingTypeId
  ) {
    return false;
  }

  // ── Campaign Triggers ─────────────────────────────────────────────────────
  const campaignTriggers: AutomationTrigger[] = [
    'CAMPAIGN_DELIVERED',
    'CAMPAIGN_FAILED',
    'CAMPAIGN_NOT_DELIVERED',
    'CAMPAIGN_OPENED',
    'CAMPAIGN_CLICKED',
  ];
  if (
    campaignTriggers.includes(firingTrigger) &&
    config.campaignId &&
    config.campaignId !== payload.campaignId
  ) {
    return false;
  }

  // ── Entity Field Changed ──────────────────────────────────────────────────
  if (firingTrigger === 'ENTITY_FIELD_CHANGED') {
    if (config.fieldPath && config.fieldPath !== payload.fieldPath) return false;
  }

  // ── Score Changed ─────────────────────────────────────────────────────────
  if (firingTrigger === 'SCORE_CHANGED') {
    const scoreType = (config.scoreType as string) || 'overallScore';
    const operator = (config.operator as string) || 'any_change';
    const threshold = (config.threshold as number) ?? 50;

    const newValue = payload[scoreType] as number | undefined;
    if (newValue === undefined) return false;

    if (operator === 'greater_than' && !(newValue > threshold)) return false;
    if (operator === 'less_than' && !(newValue < threshold)) return false;
  }

  // ── Webpage Visited ───────────────────────────────────────────────────────
  if (firingTrigger === 'WEBPAGE_VISITED') {
    const urlPattern = config.urlPattern as string | undefined;
    const visitedUrl = payload.url as string | undefined;
    if (urlPattern && visitedUrl && !visitedUrl.includes(urlPattern) && urlPattern !== '*') {
      return false;
    }
  }

  // ── Custom Event ──────────────────────────────────────────────────────────
  if (firingTrigger === 'EVENT_RECORDED') {
    if (config.eventName && config.eventName !== payload.eventName) return false;
  }

  // ── Automation Chain Triggers ─────────────────────────────────────────────
  if (
    firingTrigger === 'AUTOMATION_ENTERED' ||
    firingTrigger === 'AUTOMATION_COMPLETED'
  ) {
    const watchAutomationId = config.watchAutomationId as string | undefined;
    if (
      watchAutomationId &&
      watchAutomationId !== 'all' &&
      watchAutomationId !== payload.automationId
    ) {
      return false;
    }
  }

  return true;
}
