import type { AutomationTrigger } from './types';
import { buildAutomationPayload } from './automation-payload';

/**
 * Maps campaign hook events (snake_case) to blueprint automation triggers.
 * Model A: hooks run bound automations; orchestrator also runs workspace blueprints.
 */
export const CAMPAIGN_HOOK_EVENT_TO_TRIGGER: Record<string, AutomationTrigger> = {
  campaign_delivered: 'CAMPAIGN_DELIVERED',
  campaign_failed: 'CAMPAIGN_FAILED',
  campaign_not_delivered: 'CAMPAIGN_NOT_DELIVERED',
  campaign_opened: 'CAMPAIGN_OPENED',
  campaign_clicked: 'CAMPAIGN_CLICKED',
};

export function resolveCampaignAutomationTrigger(
  hookEvent: string
): AutomationTrigger | undefined {
  return CAMPAIGN_HOOK_EVENT_TO_TRIGGER[hookEvent];
}

/**
 * Fires workspace automations whose top-level trigger matches the campaign event.
 * Skips automations already executed via an explicit campaign hook binding.
 */
export async function dispatchCampaignBlueprintTriggers(params: {
  hookEvent: string;
  payload: Record<string, unknown>;
  excludeAutomationIds?: string[];
}): Promise<void> {
  const trigger = resolveCampaignAutomationTrigger(params.hookEvent);
  if (!trigger || !params.payload.workspaceId) return;

  const { triggerAutomationProtocols } = await import('./automation-processor');

  const standardized = buildAutomationPayload({
    organizationId: String(params.payload.organizationId || ''),
    workspaceId: String(params.payload.workspaceId),
    entityId: (params.payload.entityId as string) || '',
    entityType: params.payload.entityType as 'institution' | 'family' | 'person' | undefined,
    action: params.hookEvent,
    actorId: null,
    campaignId: params.payload.campaignId,
    campaignName: params.payload.campaignName,
    channel: params.payload.channel,
    event: params.hookEvent,
  });

  await triggerAutomationProtocols(trigger, standardized, {
    excludeAutomationIds: params.excludeAutomationIds,
  });
}
