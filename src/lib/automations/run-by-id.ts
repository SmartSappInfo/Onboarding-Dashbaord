import { logAutomationEvent } from '../automation-log';
import { executeAutomation } from './executor';

/**
 * Trigger an explicit automation by ID (manual runs, campaign hooks, bulk actions).
 */
export async function runAutomationById(
  automationId: string,
  triggerPayload: Record<string, unknown>
): Promise<void> {
  try {
    const { getAutomationById } = await import('./repository');
    const automation = await getAutomationById(automationId);
    if (!automation?.isActive) return;

    await executeAutomation(automation, triggerPayload);
  } catch (error) {
    logAutomationEvent('error', 'run_by_id_failed', {
      automationId,
      workspaceId: triggerPayload.workspaceId as string,
      error,
    });
  }
}
