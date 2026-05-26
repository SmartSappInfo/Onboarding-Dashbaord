import {
  handleCreateDeal,
  handleUpdateDealStage,
  handleUpdateDealValue,
  handleUpdateDealStatus,
} from './deal-automation-actions';
import { resolveConfigVariables } from '../variables';
import type { ExecutionContext } from '../execution-types';
import { handleSendMessage } from './message-actions';
import { handleCreateTask, handleUpdateTask } from './task-actions';
import { handleUpdateEntity, handleAssignEntity, handleAddNote } from './entity-actions';
import { handleTriggerOutboundWebhook } from './webhook-actions';
import { handleRunAutomation } from './run-automation';

export async function processActionNode(
  node: { data?: { actionType?: string; config?: Record<string, unknown> } },
  context: ExecutionContext
): Promise<void> {
  const actionType = node.data?.actionType;
  const config = node.data?.config || {};
  if (!actionType) return;

  const resolvedConfig = resolveConfigVariables(config, context.payload);

  switch (actionType) {
    case 'SEND_MESSAGE':
      await handleSendMessage(resolvedConfig, context);
      break;
    case 'CREATE_TASK':
      await handleCreateTask(resolvedConfig, context);
      break;
    case 'UPDATE_ENTITY':
      await handleUpdateEntity(resolvedConfig, context);
      break;
    case 'ASSIGN_ENTITY':
      await handleAssignEntity(resolvedConfig, context);
      break;
    case 'ADD_NOTE':
      await handleAddNote(resolvedConfig, context);
      break;
    case 'TRIGGER_OUTBOUND_WEBHOOK':
      await handleTriggerOutboundWebhook(resolvedConfig, context);
      break;
    case 'UPDATE_TASK':
      await handleUpdateTask(resolvedConfig, context);
      break;
    case 'RUN_AUTOMATION':
      await handleRunAutomation(resolvedConfig, context);
      break;
    case 'CREATE_DEAL':
      await handleCreateDeal(resolvedConfig, context);
      break;
    case 'UPDATE_DEAL_STAGE':
      await handleUpdateDealStage(resolvedConfig, context);
      break;
    case 'UPDATE_DEAL_VALUE':
      await handleUpdateDealValue(resolvedConfig, context);
      break;
    case 'UPDATE_DEAL_STATUS':
      await handleUpdateDealStatus(resolvedConfig, context);
      break;
  }
}
