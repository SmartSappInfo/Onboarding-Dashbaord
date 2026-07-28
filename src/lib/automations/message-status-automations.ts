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
  /**
   * Organization ID for multi-tenant boundary enforcement.
   * CAUTION: Must be forwarded to all downstream deal/task creation actions
   * to prevent cross-tenant data leakage. If omitted, downstream actions
   * will receive an empty string which is still valid but limits scoping.
   */
  organizationId?: string;
  /** Optional message subject line / title for populating deal engagement summary */
  messageSubject?: string | null;
  /** Optional preheader / preview text for populating deal engagement summary */
  messagePreviewText?: string | null;
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
 *
 * ARCHITECTURAL GUIDELINES & CAUTION:
 * - When rule is 'move_deal', we trigger `bulkCreateDealsAction` passing entityId, effectiveContactId,
 *   messageSubject, and messagePreviewText so created deals are properly linked to focal contacts
 *   and carry the email open summary in description.
 * - Testability: Ensure `bulkCreateDealsAction` receives non-empty contactId and email metadata.
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
    organizationId = '',
    messageSubject,
    messagePreviewText,
  } = input;

  if (!automationId || !nodeId || !eventStatus || !entityId || !workspaceId) {
    return { success: false, executedCount: 0, error: 'Missing required parameters.' };
  }

  const effectiveContactId = contactId || recipient || entityId;
  const dedupKey = `${runId}_${nodeId}_${eventStatus}_${entityId}_${effectiveContactId}`.replace(/[/\\#?%]/g, '_');

  try {
    // 1. ATOMIC EARLY DEDUPLICATION GUARD
    // CAUTION: This is the primary concurrency protection for webhook-driven automations.
    // Firestore's `create()` fails atomically with error code 6 (ALREADY_EXISTS) if the
    // document already exists. By calling create() BEFORE executing any side effects,
    // we guarantee exactly-once execution even under rapid concurrent webhook delivery.
    // DO NOT replace this with get()+set() — that pattern has a race window.
    const dedupRef = adminDb.collection('automation_message_event_executions').doc(dedupKey);
    try {
      await dedupRef.create({
        status: 'processing',
        automationId,
        nodeId,
        eventStatus,
        entityId,
        contactId: effectiveContactId,
        workspaceId,
        organizationId,
        createdAt: new Date().toISOString(),
      });
    } catch (createErr: unknown) {
      // CAUTION: Error code 6 = ALREADY_EXISTS in Firestore/gRPC.
      // Any other error code is unexpected and should propagate.
      const errCode = (createErr as { code?: number })?.code;
      if (errCode === 6) {
        return { success: true, executedCount: 0, skippedDuplicate: true };
      }
      throw createErr;
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
              const { applyTagsAction } = await import('../tag-actions');
              await applyTagsAction(entityId, 'entity', action.tagIds, userId);
              executedCount++;
            }
            break;
          }

          case 'remove_tags': {
            if (action.tagIds && action.tagIds.length > 0) {
              const { removeTagsAction } = await import('../tag-actions');
              await removeTagsAction(entityId, 'entity', action.tagIds, userId);
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
            if (action.pipelineId) {
              // ARCHITECTURAL GUIDELINE & CAUTION:
              // Event-driven pipeline deal handling:
              // 1. Search for an existing open deal for this entityId in the target pipeline.
              // 2. If an open deal exists: transition its stage to targetStageId (if specified and different)
              //    using updateDealStageAction, maintaining focal contacts and existing deal state.
              // 3. If no open deal exists: create a deal via bulkCreateDealsAction targeting stageId with
              //    dynamic deal name pattern reflecting the event (Opened, Clicked, Replied, Bounced).
              const targetStageId = action.stageId;

              const existingDealsSnap = await adminDb
                .collection('deals')
                .where('workspaceId', '==', workspaceId)
                .where('entityId', '==', entityId)
                .where('pipelineId', '==', action.pipelineId)
                .where('status', '==', 'open')
                .orderBy('updatedAt', 'desc')
                .limit(1)
                .get();

              if (!existingDealsSnap.empty) {
                const openDealDoc = existingDealsSnap.docs[0];
                const currentStageId = openDealDoc.data().stageId as string | undefined;

                if (targetStageId && currentStageId !== targetStageId) {
                  const { updateDealStageAction } = await import('../../app/actions/deal-actions');
                  const updateResult = await updateDealStageAction(openDealDoc.id, targetStageId);
                  if (updateResult.error) {
                    console.error(`[EVENT-AUTOMATION] Failed to update deal ${openDealDoc.id} stage to ${targetStageId}: ${updateResult.error}`);
                  }
                }
              } else {
                const dynamicPattern = eventStatus === 'clicked'
                  ? '{{entityName}} - Clicked Link'
                  : eventStatus === 'replied'
                  ? '{{entityName}} - Replied Message'
                  : eventStatus === 'bounced'
                  ? '{{entityName}} - Delivery Failed'
                  : '{{entityName}} - Opened Email';

                const { bulkCreateDealsAction } = await import('../../app/actions/bulk-deal-actions');
                // CAUTION: organizationId MUST be forwarded here for multi-tenant isolation.
                // Using '' as fallback is safe but limits cross-org query scoping.
                await bulkCreateDealsAction({
                  entityIds: [entityId],
                  workspaceId,
                  organizationId,
                  pipelineId: action.pipelineId,
                  stageId: targetStageId,
                  dealNamePattern: dynamicPattern,
                  value: 0,
                  assignmentStrategy: 'unassigned',
                  contactId: effectiveContactId,
                  messageSubject,
                  messagePreviewText,
                });
              }
              executedCount++;
            }
            break;
          }

          case 'enroll_automation': {
            if (action.automationId) {
              const { enrollContactsInAutomationAction } = await import('../automation-actions');
              await enrollContactsInAutomationAction([entityId], action.automationId, workspaceId, userId);
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
              const resolvedTitle = await FieldsVariablesService.resolveTemplateVariables(
                action.taskTitle,
                { workspaceId, entityId, recipientContact: effectiveContactId }
              );
              const resolvedDesc = await FieldsVariablesService.resolveTemplateVariables(
                action.taskDescription || '',
                { workspaceId, entityId, recipientContact: effectiveContactId }
              );

              const { bulkCreateTasksAction } = await import('../../app/actions/bulk-task-actions');
              // CAUTION: organizationId MUST be forwarded here for multi-tenant isolation.
              await bulkCreateTasksAction({
                entityIds: [entityId],
                workspaceId,
                organizationId,
                title: resolvedTitle,
                description: resolvedDesc,
                priority: 'high',
                category: 'Automation Follow-up',
                dueDaysOffset: 1,
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
                meetingId: action.meetingTypeId,
                workspaceId,
                sendInvites: true,
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

    // 4. Mark Idempotency Record as completed
    // CAUTION: This updates the document created by the atomic lock above.
    // The document already exists from step 1, so we use update() here, not set().
    await dedupRef.update({
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
