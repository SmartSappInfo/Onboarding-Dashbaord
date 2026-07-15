import { after } from 'next/server';
import { evaluateTriggerConfig } from '../automation-trigger-config';
import { logAutomationEvent } from '../automation-log';
import type { AutomationTrigger } from '../types';
import { executeAutomation } from './executor';

interface BufferedTriggerItem {
  trigger: AutomationTrigger;
  payload: Record<string, unknown>;
  options?: { excludeAutomationIds?: string[]; sync?: boolean };
  resolve: (value: void | PromiseLike<void>) => void;
  reject: (reason?: unknown) => void;
}

const triggerBuffer: BufferedTriggerItem[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

function runAfter(fn: () => void | Promise<void>) {
  try {
    after(fn);
  } catch {
    // Fallback: run asynchronously outside Next.js request scope (e.g. in tests)
    Promise.resolve().then(fn).catch(err => {
      console.error("runAfter fallback execution failed:", err);
    });
  }
}

async function processTriggerSync(
  trigger: AutomationTrigger,
  payload: Record<string, unknown>,
  options?: { excludeAutomationIds?: string[] }
): Promise<void> {
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

    const enrichedPayload = { ...payload, _firingTrigger: trigger };

    if (!evaluateTriggerConfig(automation, enrichedPayload)) {
      continue;
    }

    await executeAutomation(automation, enrichedPayload);
  }

  runAfter(async () => {
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
}

async function enqueueBulkTriggers(
  trigger: AutomationTrigger,
  workspaceId: string,
  groupItems: BufferedTriggerItem[]
): Promise<void> {
  const { findActiveAutomationsByTrigger } = await import('./repository');
  const automations = await findActiveAutomationsByTrigger(trigger);

  if (automations.length === 0) return;

  const { adminDb } = await import('../firebase-admin');
  const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
  const organizationId = wsSnap.data()?.organizationId || 'default';

  const { scheduleBulkTriggerTask } = await import('../gcp-tasks-client');

  for (const automation of automations) {
    const targets = groupItems
      .filter(item => {
        if (item.options?.excludeAutomationIds?.includes(automation.id)) return false;
        if (automation.workspaceIds?.length && !automation.workspaceIds.includes(workspaceId)) return false;
        
        const enrichedPayload = { ...item.payload, _firingTrigger: trigger };
        return evaluateTriggerConfig(automation, enrichedPayload);
      })
      .map(item => ({
        entityId: (item.payload.entityId as string) || '',
        entityType: (item.payload.entityType as 'contact' | 'deal' | 'company') || 'contact',
        payload: item.payload,
      }));

    if (targets.length === 0) continue;

    // Split targets into batches of 100
    const batchSize = 100;
    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);
      await scheduleBulkTriggerTask({
        automationId: automation.id,
        workspaceId,
        organizationId,
        trigger,
        targets: batch,
      });
    }
  }

  runAfter(async () => {
    try {
      const { dispatchWebhooksByTrigger } = await import('../webhook-engine');
      for (const item of groupItems) {
        await dispatchWebhooksByTrigger({
          trigger,
          payload: item.payload,
          workspaceId,
          organizationId,
          entityId: (item.payload.entityId as string) || null,
        }).catch(e => console.error('[BulkTriggerWebhooks] Individual webhook dispatch error:', e));
      }
    } catch (err) {
      console.error('[BulkTriggerWebhooks] Webhook dispatch error:', err);
    }
  });
}

async function flushTriggerBuffer() {
  flushTimeout = null;
  const items = [...triggerBuffer];
  triggerBuffer.length = 0;

  const groups = new Map<string, {
    trigger: AutomationTrigger;
    workspaceId: string;
    items: BufferedTriggerItem[];
  }>();

  for (const item of items) {
    const workspaceId = (item.payload.workspaceId as string) || 'global';
    const key = `${item.trigger}_${workspaceId}`;
    if (!groups.has(key)) {
      groups.set(key, { trigger: item.trigger, workspaceId, items: [] });
    }
    groups.get(key)!.items.push(item);
  }

  for (const group of groups.values()) {
    const trigger = group.trigger;
    const workspaceId = group.workspaceId;
    const groupItems = group.items;

    const isTest = process.env.NODE_ENV === 'test';
    const hasSync = groupItems.some(i => i.options?.sync === true) || isTest;
    if (hasSync || groupItems.length <= 5) {
      for (const item of groupItems) {
        try {
          await processTriggerSync(item.trigger, item.payload, item.options);
          item.resolve();
        } catch (err) {
          item.reject(err);
        }
      }
      continue;
    }

    try {
      await enqueueBulkTriggers(trigger, workspaceId, groupItems);
      groupItems.forEach(i => i.resolve());
    } catch (err) {
      groupItems.forEach(i => i.reject(err));
    }
  }
}

export async function triggerAutomationProtocols(
  trigger: AutomationTrigger,
  payload: Record<string, unknown>,
  options?: { excludeAutomationIds?: string[]; sync?: boolean }
): Promise<void> {
  const isTest = process.env.NODE_ENV === 'test';
  const forceSync = options?.sync || isTest;

  return new Promise<void>((resolve, reject) => {
    triggerBuffer.push({
      trigger,
      payload,
      options,
      resolve,
      reject,
    });

    if (forceSync) {
      if (flushTimeout) {
        clearTimeout(flushTimeout);
      }
      void flushTriggerBuffer();
    } else if (!flushTimeout) {
      flushTimeout = setTimeout(() => {
        void flushTriggerBuffer();
      }, 20);
    }
  });
}
