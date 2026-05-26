import type { ExecutionContext } from '../execution-types';

export async function handleTriggerOutboundWebhook(
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  if (!config.webhookId) throw new Error('Outbound webhook action missing webhookId.');
  const { dispatchWebhook } = await import('../../webhook-engine');
  await dispatchWebhook({
    webhookIdOrUrl: config.webhookId as string,
    payload: context.payload,
    workspaceId: context.workspaceId,
    organizationId: (context.payload.organizationId as string) || 'default',
    entityId: context.entityId || null,
    source: 'automation',
    description: `Triggered by automation ${context.automationId}`,
  });
}
