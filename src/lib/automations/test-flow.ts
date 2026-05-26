'use server';

import { buildAutomationPayload } from '../automation-payload';
import { logAutomationEvent } from '../automation-log';
import {
  assertAutomationManagePermission,
  loadAutomationForAuth,
} from '../automation-permissions';
import { assertAutomationUserId, toAutomationClientError } from './errors';
import type { AutomationActionResult } from './service';
import type { EntityType } from '../types';

export interface TestAutomationFlowInput {
  workspaceId: string;
  entityId: string;
  entityType?: EntityType;
  organizationId?: string;
}

/**
 * Runs an automation once with a synthetic payload (manual QA / Test Flow button).
 */
export async function testAutomationFlow(
  automationId: string,
  userId: string,
  input: TestAutomationFlowInput
): Promise<AutomationActionResult> {
  try {
    assertAutomationUserId(userId);

    const automation = await loadAutomationForAuth(automationId);
    if (!automation) {
      return { success: false, error: 'Automation not found.' };
    }

    await assertAutomationManagePermission(userId, automation.workspaceIds, 'edit');

    if (!input.workspaceId?.trim() || !input.entityId?.trim()) {
      return { success: false, error: 'Workspace ID and entity ID are required for test runs.' };
    }

    const trigger = automation.trigger;
    if (!trigger) {
      return { success: false, error: 'Automation has no top-level trigger configured.' };
    }

    const payload = buildAutomationPayload({
      organizationId: input.organizationId || '',
      workspaceId: input.workspaceId,
      entityId: input.entityId,
      entityType: input.entityType || 'institution',
      action: `test_flow:${trigger}`,
      actorId: userId,
      metadata: { testRun: true, triggeredBy: userId },
    });

    const { runAutomationById } = await import('../automation-processor');
    await runAutomationById(automationId, payload);

    logAutomationEvent('info', 'test_flow_completed', {
      automationId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
    });

    return {
      success: true,
      message: 'Test run started. Check the Automation Hub ledger for execution trace.',
    };
  } catch (error) {
    logAutomationEvent('error', 'test_flow_failed', { automationId, error });
    return { success: false, error: toAutomationClientError(error) };
  }
}
