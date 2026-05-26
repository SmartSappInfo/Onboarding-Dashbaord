import { createHash } from 'node:crypto';

export interface CampaignAutomationJobPayload {
  entityId: string;
  workspaceId: string;
  organizationId: string;
  campaignId: string;
  campaignName: string;
  event: string;
  channel?: string;
  action: string;
}

/**
 * Standard campaign → automation job payload (entity-first).
 */
export function buildCampaignAutomationJobPayload(input: {
  entityId: string;
  workspaceId: string;
  organizationId: string;
  campaignId: string;
  campaignName: string;
  event: string;
  channel?: string;
}): CampaignAutomationJobPayload {
  return {
    entityId: input.entityId,
    workspaceId: input.workspaceId,
    organizationId: input.organizationId || '',
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    event: input.event,
    channel: input.channel,
    action: input.event,
  };
}

/**
 * Deterministic job document ID for idempotent campaign fan-out (P1-C5).
 */
export function campaignAutomationJobDocId(
  campaignId: string,
  event: string,
  automationId: string,
  entityId: string
): string {
  const raw = `${campaignId}|${event}|${automationId}|${entityId}`;
  return `cj_${createHash('sha256').update(raw).digest('hex').slice(0, 32)}`;
}
