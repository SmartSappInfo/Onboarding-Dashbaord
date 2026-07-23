import { adminDb } from '../firebase-admin';
import { logAutomationEvent } from '../automation-log';
import { FieldsVariablesService } from '../services/fields-variables-service-impl';
import {
  normalizeMessageNodeConfig,
  type MessageDeliveryStatusEvent,
  type MessageStatusActionConfig,
  type MessageStatusRule,
} from '../types';

export interface ExecuteMessageStatusAutomationsInput {
  automationId: string;
  nodeId: string;
  eventStatus: MessageDeliveryStatusEvent;
  entityId: string;
  contactId?: string;
  recipient?: string;
  workspaceId: string;
  userId?: string;
  runId?: string;
}

export interface ExecuteMessageStatusAutomationsResult {
  success: boolean;
  executedCount: number;
  error?: string;
  skippedDuplicate?: boolean;
}

/**
 * Idempotently executes configured per-message status rules (e.g. opened, clicked, bounced)
 * for a specific lead/contact when a delivery milestone or manual action occurs.
 */
export async function executeMessageStatusAutomations(
  input: ExecuteMessageStatusAutomationsInput
): Promise<ExecuteMessageStatusAutomationsResult> {
  const {
    automationId,
    nodeId,
    eventStatus,
    entityId,
    contactId,
    recipient,
    workspaceId,
    userId = 'system',
    runId = 'manual',
  } = input;

  if (!automationId || !nodeId || !eventStatus || !entityId || !workspaceId) {
    return { success: false, executedCount: 0, error: 'Missing required parameters.' };
  }

  const effectiveContactId = contactId || recipient || entityId;
  const dedupKey = `${runId}_${nodeId}_${eventStatus}_${entityId}_${effectiveContactId}`.replace(/[/\\#?%]/g, '_');

  try {
    // 1. Atomic Idempotency Check in Firestore
    const dedupRef = adminDb.collection('automation_message_event_executions').doc(dedupKey);
    const dedupSnap = await dedupRef.get();
    if (dedupSnap.exists && dedupSnap.data()?.status === 'completed') {
      return { success: true, executedCount: 0, skippedDuplicate: true };
    }

    // 2. Fetch Automation Node Config
    const autoSnap = await adminDb.collection('automations').doc(automationId).get();
    if (!autoSnap.exists) {
      return { success: false, executedCount: 0, error: 'Automation document not found.' };
    }

    const autoData = autoSnap.data() as { nodes?: Array<{ id: string; type: string; data?: { config?: Record<string, unknown> } }> };
    const matchingNode = autoData.nodes?.find((n) => n.id === nodeId);
    if (!matchingNode || !matchingNode.data?.config) {
      return { success: true, executedCount: 0 };
    }

    const normalizedConfig = normalizeMessageNodeConfig(matchingNode.data.config);
    const rules = (normalizedConfig.statusRules || []) as MessageStatusRule[];
    const activeRules = rules.filter((r) => r.enabled && r.event === eventStatus);

    if (activeRules.length === 0) {
      return { success: true, executedCount: 0 };
    }

    // Gather all actions to execute
    const actionsToExecute: MessageStatusActionConfig[] = [];
    activeRules.forEach((rule) => {
      if (Array.isArray(rule.actions)) {
        actionsToExecute.push(...rule.actions);
      }
    });

    if (actionsToExecute.length === 0) {
      return { success: true, executedCount: 0 };
    }

    let executedCount = 0;

    // 3. Execute Actions safely
    for (const action of actionsToExecute) {
      try {
        switch (action.type) {
          case 'add_tags': {
            if (action.tagIds && action.tagIds.length > 0) {
              const { addTagsToContactAction } = await import('../tag-actions');
              for (const tagId of action.tagIds) {
                await addTagsToContactAction({
                  contactId: effectiveContactId,
                  contactType: 'workspace_entity',
                  tagId,
                  userId,
                });
              }
              executedCount++;
            }
            break;
          }

          case 'remove_tags': {
            if (action.tagIds && action.tagIds.length > 0) {
              const { removeTagsFromContactAction } = await import('../tag-actions');
              for (const tagId of action.tagIds) {
                await removeTagsFromContactAction({
                  contactId: effectiveContactId,
                  contactType: 'workspace_entity',
                  tagId,
                  userId,
                });
              }
              executedCount++;
            }
            break;
          }

          case 'add_to_campaign': {
            if (action.campaignId) {
              const { addContactsToCallCampaignAction } = await import('../call-centre-actions');
              await addContactsToCallCampaignAction(action.campaignId, [entityId], workspaceId, userId);
              executedCount++;
            }
            break;
          }

          case 'move_deal': {
            if (action.pipelineId && action.stageId) {
              const { bulkCreateDealsAction } = await import('../../app/actions/bulk-deal-actions');
              await bulkCreateDealsAction({
                entityIds: [entityId],
                pipelineId: action.pipelineId,
                stageId: action.stageId,
                title: 'Automated Event Deal',
                value: 0,
                workspaceId,
                userId,
              });
              executedCount++;
            }
            break;
          }

          case 'enroll_automation': {
            if (action.automationId) {
              const { enrollContactsInAutomationAction } = await import('../automation-actions');
              await enrollContactsInAutomationAction(action.automationId, [entityId], workspaceId, userId);
              executedCount++;
            }
            break;
          }

          case 'assign_user': {
            if (action.assignedUserId) {
              const entityRef = adminDb.collection('workspace_entities').doc(entityId);
              await entityRef.update({
                assignedUserId: action.assignedUserId,
                updatedAt: new Date().toISOString(),
              });
              executedCount++;
            }
            break;
          }

          case 'create_task': {
            if (action.taskTitle) {
              const resolvedTitle = FieldsVariablesService.resolveTemplateVariables(
                action.taskTitle,
                { entityId, contactId: effectiveContactId }
              );
              const resolvedDesc = FieldsVariablesService.resolveTemplateVariables(
                action.taskDescription || '',
                { entityId, contactId: effectiveContactId }
              );

              const { bulkCreateTasksAction } = await import('../../app/actions/bulk-task-actions');
              await bulkCreateTasksAction({
                entityIds: [entityId],
                title: resolvedTitle,
                description: resolvedDesc,
                assignedToUserId: action.assignedUserId || userId,
                workspaceId,
                userId,
              });
              executedCount++;
            }
            break;
          }

          case 'send_meeting': {
            if (action.meetingTypeId) {
              const { bulkRegisterParticipantsAction } = await import('../../app/actions/bulk-meeting-actions');
              await bulkRegisterParticipantsAction({
                entityIds: [entityId],
                meetingTypeId: action.meetingTypeId,
                workspaceId,
                userId,
              });
              executedCount++;
            }
            break;
          }

          default:
            break;
        }
      } catch (actionErr: unknown) {
        const msg = actionErr instanceof Error ? actionErr.message : String(actionErr);
        console.error(`[EVENT-AUTOMATION] Action ${action.type} failed:`, msg);
      }
    }

    // 4. Mark Idempotency Record
    await dedupRef.set({
      automationId,
      nodeId,
      eventStatus,
      entityId,
      contactId: effectiveContactId,
      workspaceId,
      executedCount,
      status: 'completed',
      executedAt: new Date().toISOString(),
    });

    // 5. Log Audit Event
    logAutomationEvent('info', 'message_event_automation_executed', {
      automationId,
      nodeId,
      eventStatus,
      entityId,
      executedCount,
      workspaceId,
    });

    return { success: true, executedCount };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[EVENT-AUTOMATION] Failed to execute message status automations:', errMsg);
    return { success: false, executedCount: 0, error: errMsg };
  }
}
