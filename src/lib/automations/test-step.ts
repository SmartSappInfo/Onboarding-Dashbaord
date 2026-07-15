import { buildAutomationPayload } from '../automation-payload';
import { logAutomationEvent } from '../automation-log';
import {
  assertAutomationManagePermission,
  loadAutomationForAuth,
} from '../automation-permissions';
import { assertAutomationUserId, toAutomationClientError } from './errors';
import type { AutomationActionResult } from './service';
import type { ExecutionContext } from './execution-types';
import { processActionNode } from './actions';
import { processTagActionNode, evaluateTagConditionNode } from './nodes/tag-nodes';
import { evaluateConditionNode } from '../automation-condition';
import { adminDb } from '../firebase-admin';
import { enrichExecutionContext } from './nodes/traverse';
import type { TagConditionNode } from '../types';
import { nodeChecksMessageActions } from './payload-enricher';

export interface TestAutomationStepInput {
  workspaceId: string;
  entityId: string;
  entityType?: 'institution' | 'individual' | string;
  nodeType: string;
  nodeDataOverride: any;
}

/**
 * Runs a single node execution in isolation with the draft configuration data (QA / Test Step action).
 */
export async function testAutomationStep(
  automationId: string,
  nodeId: string,
  entityId: string,
  nodeDataOverride: any,
  userId: string
): Promise<AutomationActionResult & { evaluation?: boolean; responseData?: any }> {
  try {
    assertAutomationUserId(userId);

    const automation = await loadAutomationForAuth(automationId);
    if (!automation) {
      return { success: false, error: 'Automation not found.' };
    }

    await assertAutomationManagePermission(userId, automation.workspaceIds, 'edit');

    if (!entityId?.trim()) {
      return { success: false, error: 'Target entity ID is required for step testing.' };
    }

    // Scopes to the first configured workspace constraints
    let workspaceId = automation.workspaceIds?.[0];
    if (!workspaceId) {
      const userSnap = await adminDb.collection('users').doc(userId).get();
      workspaceId = userSnap.data()?.workspaceIds?.[0] || 'onboarding';
    }

    // Fetch the captured webhook from triggers config, trigger node data, or root
    const triggerNode = automation.nodes?.find((n: any) => n.type === 'triggerNode');
    const triggerNodeTriggers = triggerNode?.data?.triggers as any[];
    const latestCapturedWebhook = 
      (automation as any).latestCapturedWebhook || 
      (automation as any).triggers?.find((t: any) => t.type === 'WEBHOOK_RECEIVED')?.config?.capturedPayload ||
      triggerNodeTriggers?.find((t: any) => t.type === 'WEBHOOK_RECEIVED')?.config?.capturedPayload ||
      triggerNode?.data?.config?.capturedPayload;

    // Formulate a custom test action key referencing the target node ID
    const payload = buildAutomationPayload({
      organizationId: '',
      workspaceId,
      entityId,
      entityType: nodeDataOverride.entityType || 'institution',
      action: `test_step:${nodeDataOverride.actionType || nodeDataOverride.type || nodeId}`,
      actorId: userId,
      metadata: { testStepRun: true, triggeredBy: userId, nodeId },
    });

    if (latestCapturedWebhook) {
      payload.source = 'external_webhook';
      payload.ingressId = automationId;
      payload.body = latestCapturedWebhook.body || {};
      payload.headers = latestCapturedWebhook.headers || {};
      payload.query = latestCapturedWebhook.query || {};
      payload.files = latestCapturedWebhook.files || [];
    }

    console.log('[testAutomationStep] Resolved latestCapturedWebhook:', JSON.stringify(latestCapturedWebhook, null, 2));
    console.log('[testAutomationStep] Initial Payload:', JSON.stringify(payload, null, 2));

    const context: ExecutionContext = {
      entityId,
      entityType: (nodeDataOverride.entityType || 'institution') as any,
      workspaceId,
      payload,
      automationId,
      runId: `test_step_run_${Date.now()}`,
      chainDepth: 0,
    };

    // Enrich variables
    await enrichExecutionContext(context);
    console.log('[testAutomationStep] Enriched context.payload:', JSON.stringify(context.payload, null, 2));

    // Formulate the simulated mock node in memory merging any custom draft configs
    const originalNode = automation.nodes?.find((n: any) => n.id === nodeId);
    const testNode = {
      id: nodeId,
      type: originalNode?.type || nodeDataOverride.type || 'actionNode',
      position: originalNode?.position || { x: 0, y: 0 },
      data: {
        ...(originalNode?.data || {}),
        ...nodeDataOverride,
      },
    };

    let executionResult: any = null;
    let evaluation: boolean | undefined = undefined;

    // Run step execution according to the corresponding node categories
    if (testNode.type === 'actionNode') {
      await processActionNode(testNode, context);
      executionResult = { message: 'Action executed successfully.' };
    } else if (testNode.type === 'tagActionNode') {
      await processTagActionNode(testNode, context);
      executionResult = { message: 'Tag action executed successfully.' };
    } else if (testNode.type === 'conditionNode') {
      let evalPayload = payload;
      if (context.entityId && context.workspaceId && nodeChecksMessageActions(testNode)) {
        const logsSnap = await adminDb.collection('message_logs')
          .where('entityId', '==', context.entityId)
          .where('workspaceId', '==', context.workspaceId)
          .get();
        const messageLogs: any[] = [];
        logsSnap.forEach((doc) => {
          messageLogs.push({ id: doc.id, ...doc.data() });
        });
        evalPayload = { ...payload, messageLogs };
      }
      evaluation = await evaluateConditionNode(
        testNode,
        evalPayload,
        async (audienceId) => {
          const snap = await adminDb.collection('message_audiences').doc(audienceId).get();
          return snap.exists ? snap.data() : null;
        },
        async (eId, aId, operator) => {
          if (operator === 'currently_in') {
            const snap = await adminDb.collection('automation_runs')
              .where('entityId', '==', eId)
              .where('automationId', '==', aId)
              .where('status', '==', 'running')
              .limit(1)
              .get();
            return !snap.empty;
          }
          if (operator === 'has_entered') {
            const snap = await adminDb.collection('automation_runs')
              .where('entityId', '==', eId)
              .where('automationId', '==', aId)
              .limit(1)
              .get();
            return !snap.empty;
          }
          if (operator === 'has_completed') {
            const snap = await adminDb.collection('automation_runs')
              .where('entityId', '==', eId)
              .where('automationId', '==', aId)
              .where('status', '==', 'completed')
              .limit(1)
              .get();
            return !snap.empty;
          }
          if (operator === 'not_entered') {
            const snap = await adminDb.collection('automation_runs')
              .where('entityId', '==', eId)
              .where('automationId', '==', aId)
              .limit(1)
              .get();
            return snap.empty;
          }
          return false;
        }
      );
      executionResult = { message: `Condition evaluated to ${evaluation ? 'TRUE' : 'FALSE'}.` };
    } else if (testNode.type === 'tagConditionNode') {
      const matched = await evaluateTagConditionNode(testNode as unknown as TagConditionNode, context);
      evaluation = matched.length > 0 && !matched.includes('false') && !matched.includes('none');
      executionResult = { message: `Tag split routed to: ${matched.join(', ')}` };
    } else if (testNode.type === 'delayNode') {
      const config = testNode.data?.config || {};
      executionResult = {
        message: 'Delay step simulated.',
        delay: `${config.value || 5} ${config.unit || 'Minutes'}`,
      };
    } else if (testNode.type === 'jumpToNode') {
      let evalPayload = payload;
      if (context.entityId && context.workspaceId && nodeChecksMessageActions(testNode as any)) {
        const logsSnap = await adminDb.collection('message_logs')
          .where('entityId', '==', context.entityId)
          .where('workspaceId', '==', context.workspaceId)
          .get();
        const messageLogs: any[] = [];
        logsSnap.forEach((doc) => {
          messageLogs.push({ id: doc.id, ...doc.data() });
        });
        evalPayload = { ...payload, messageLogs };
      }
      evaluation = await evaluateConditionNode(
        testNode as unknown as Parameters<typeof evaluateConditionNode>[0],
        evalPayload,
        async (audienceId) => {
          const snap = await adminDb.collection('message_audiences').doc(audienceId).get();
          return snap.exists ? snap.data() : null;
        },
        async (eId, aId, operator) => {
          if (operator === 'currently_in') {
            const snap = await adminDb.collection('automation_runs')
              .where('entityId', '==', eId)
              .where('automationId', '==', aId)
              .where('status', '==', 'running')
              .limit(1)
              .get();
            return !snap.empty;
          }
          if (operator === 'has_entered') {
            const snap = await adminDb.collection('automation_runs')
              .where('entityId', '==', eId)
              .where('automationId', '==', aId)
              .limit(1)
              .get();
            return !snap.empty;
          }
          if (operator === 'has_completed') {
            const snap = await adminDb.collection('automation_runs')
              .where('entityId', '==', eId)
              .where('automationId', '==', aId)
              .where('status', '==', 'completed')
              .limit(1)
              .get();
            return !snap.empty;
          }
          if (operator === 'not_entered') {
            const snap = await adminDb.collection('automation_runs')
              .where('entityId', '==', eId)
              .where('automationId', '==', aId)
              .limit(1)
              .get();
            return snap.empty;
          }
          return false;
        }
      );
      executionResult = { message: `Goal conditions evaluated to ${evaluation ? 'TRUE' : 'FALSE'}.` };
    } else if (testNode.type === 'triggerNode') {
      executionResult = { message: 'Trigger node check completed (entry point).' };
    } else {
      return { success: false, error: `Step type "${testNode.type}" is not executable in isolation.` };
    }

    logAutomationEvent('info', 'test_step_completed', {
      automationId,
      nodeId,
      entityId,
      nodeType: testNode.type,
    });

    return {
      success: true,
      message: executionResult?.message || 'Step test run completed.',
      evaluation,
      responseData: executionResult,
    };
  } catch (error) {
    logAutomationEvent('error', 'test_step_failed', { automationId, nodeId, error });
    return { success: false, error: toAutomationClientError(error) };
  }
}
