import {
  handleCreateDeal,
  handleUpdateDealStage,
  handleUpdateDealValue,
  handleUpdateDealStatus,
} from './deal-automation-actions';
import { resolveConfigVariables } from '../variables';
import type { ExecutionContext } from '../execution-types';
import { handleSendMessage, handleDirectMessage } from './message-actions';
import { handleCreateTask, handleUpdateTask } from './task-actions';
import { handleUpdateEntity, handleAssignEntity, handleAddNote, handleCreateEntity, handleCreateContactForEntity, handleUpdateContact } from './entity-actions';
import { handleTriggerOutboundWebhook } from './webhook-actions';
import { handleRunAutomation } from './run-automation';
import { handleSendNotification } from './notification-actions';
import { logAutomationEvent } from '../../automation-log';
import { handleUpdateLeadScore } from './score-automation-actions';

export async function processActionNode(
  node: { data?: { actionType?: string; config?: Record<string, unknown> } },
  context: ExecutionContext
): Promise<any> {
  const actionType = node.data?.actionType;
  const config = node.data?.config || {};
  if (!actionType) return;

  const resolvedConfig = resolveConfigVariables(config, context.payload);

  switch (actionType) {
    case 'SEND_MESSAGE':
      return await handleSendMessage(resolvedConfig, context);
    case 'DIRECT_EMAIL':
    case 'DIRECT_SMS':
      return await handleDirectMessage(actionType, resolvedConfig, context);
    case 'SEND_NOTIFICATION_EMAIL':
    case 'SEND_NOTIFICATION_SMS':
    case 'SEND_NOTIFICATION_IN_APP':
    case 'SEND_NOTIFICATION_PUSH':
      return await handleSendNotification(actionType, resolvedConfig, context);
    case 'CREATE_TASK':
      return await handleCreateTask(resolvedConfig, context);
    case 'UPDATE_ENTITY':
      return await handleUpdateEntity(resolvedConfig, context);
    case 'ASSIGN_ENTITY':
      return await handleAssignEntity(resolvedConfig, context);
    case 'ADD_NOTE':
      return await handleAddNote(resolvedConfig, context);
    case 'TRIGGER_OUTBOUND_WEBHOOK':
      return await handleTriggerOutboundWebhook(resolvedConfig, context);
    case 'UPDATE_TASK':
      return await handleUpdateTask(resolvedConfig, context);
    case 'RUN_AUTOMATION':
      return await handleRunAutomation(resolvedConfig, context);
    case 'CREATE_DEAL':
      return await handleCreateDeal(resolvedConfig, context);
    case 'UPDATE_DEAL_STAGE':
      return await handleUpdateDealStage(resolvedConfig, context);
    case 'UPDATE_DEAL_VALUE':
      return await handleUpdateDealValue(resolvedConfig, context);
    case 'CREATE_ENTITY':
      return await handleCreateEntity(resolvedConfig, context);
    case 'ADD_CONTACT_TO_ENTITY':
      return await handleCreateContactForEntity(resolvedConfig, context);
    case 'UPDATE_CONTACT':
      return await handleUpdateContact(resolvedConfig, context);
    case 'ADD_TO_CALL_CAMPAIGN': {
      try {
        const { CallCentreService } = await import('../../services/call-centre-service');
        const campaignId = String(resolvedConfig.campaignId || '');
        const contactScope = String(resolvedConfig.contactScope || 'primary');
        if (!campaignId) {
          throw new Error('No campaignId specified for ADD_TO_CALL_CAMPAIGN automation step.');
        }

        if (!context.entityId) {
          throw new Error('No entityId available in automation context.');
        }

        // Derives contact overrides if we need custom signaling, or just call service.
        // Resolve scope and run. We pass target entityId from context.
        const result = await CallCentreService.addContactsToCampaign(
          campaignId,
          [context.entityId],
          context.workspaceId,
          'automation-actor',
          undefined, // overrides derived automatically or passed
          contactScope as 'primary' | 'signatories' | 'all'
        );

        if (!result.success) {
          throw new Error(result.error || 'Failed to add contact to campaign');
        }
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown execution failure';
        await logAutomationEvent('error', 'action_failed', {
          automationId: context.automationId,
          runId: context.runId,
          workspaceId: context.workspaceId,
          entityId: context.entityId,
          error: message
        });
        throw err;
      }
    }
    case 'UPDATE_LEAD_SCORE':
      return await handleUpdateLeadScore(resolvedConfig, context);
    case 'END_AUTOMATION':
      await logAutomationEvent('info', 'automation_completed_action', {
        automationId: context.automationId,
        runId: context.runId,
        workspaceId: context.workspaceId,
        entityId: context.entityId,
      });
      try {
        const { adminDb } = await import('../../firebase-admin');
        await adminDb.collection('automation_runs').doc(context.runId).update({
          status: 'completed',
          finishedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to update run status to completed:', err);
      }
      try {
        const { triggerAutomationProtocols } = await import('../../automation-processor');
        await triggerAutomationProtocols('AUTOMATION_COMPLETED', {
          automationId: context.automationId,
          runId: context.runId,
          workspaceId: context.workspaceId,
          entityId: context.entityId,
          entityType: context.entityType,
          completedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to trigger AUTOMATION_COMPLETED:', err);
      }
      break;
  }
}
