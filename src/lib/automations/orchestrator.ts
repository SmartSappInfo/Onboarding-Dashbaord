import { after } from 'next/server';
import { evaluateTriggerConfig } from '../automation-trigger-config';
import { logAutomationEvent } from '../automation-log';
import type { AutomationTrigger } from '../types';
import { executeAutomation } from './executor';

/**
 * Polls for active automations matching a trigger and executes them (workspace-scoped).
 */
export async function triggerAutomationProtocols(
  trigger: AutomationTrigger,
  payload: Record<string, unknown>,
  options?: { excludeAutomationIds?: string[] }
): Promise<void> {
  try {
    if (!payload.workspaceId) {
      logAutomationEvent('warn', 'trigger_missing_workspace', { trigger });
      return;
    }

    const workspaceId = payload.workspaceId as string;
    const { findActiveAutomationsByTrigger } = await import('./repository');
    const automations = await findActiveAutomationsByTrigger(trigger);

    for (const automation of automations) {
      if (options?.excludeAutomationIds?.includes(automation.id)) {
        continue;
      }
      if (automation.workspaceIds?.length && !automation.workspaceIds.includes(workspaceId)) {
        continue;
      }

      // Enrich payload with the currently-firing trigger type so
      // evaluateTriggerConfig can look up the correct AutomationTriggerDef
      const enrichedPayload = { ...payload, _firingTrigger: trigger };

      if (!evaluateTriggerConfig(automation, enrichedPayload)) {
        continue;
      }

      await executeAutomation(automation, enrichedPayload);
    }

    after(async () => {
      try {
        const { dispatchWebhooksByTrigger } = await import('../webhook-engine');
        const { adminDb } = await import('../firebase-admin');
        const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
        const organizationId = wsSnap.data()?.organizationId || 'default';
        await dispatchWebhooksByTrigger({
          trigger,
          payload,
          workspaceId,
          organizationId,
          entityId: (payload.entityId as string) || null,
        });
      } catch (webhookError) {
        logAutomationEvent('error', 'webhook_dispatch_failed', {
          trigger,
          workspaceId,
          error: webhookError,
        });
      }
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logAutomationEvent('error', 'trigger_poll_failed', {
      trigger,
      workspaceId: payload.workspaceId as string,
      error: errMsg,
    });
    // Also log to console so server logs surface the issue clearly
    console.error(`[AUTOMATION ORCHESTRATOR] trigger_poll_failed: ${trigger} workspace=${payload.workspaceId} — ${errMsg}`);
  }
}
