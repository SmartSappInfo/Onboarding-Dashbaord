import {
  handleCreateDeal,
  handleUpdateDealStage,
  handleUpdateDealValue,
  handleUpdateDealStatus,
  handleAssignDealOwner,
  handleUpdateDealProbability,
  handleCreateDealTask,
  handleAddDealNote,
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

/**
 * Helper to check if an action node is marked as disabled/bypassed.
 * Supports isDisabled on node.data, node.data.config.isDisabled, or node.data.config.disabled.
 */
export function isNodeDisabled(node: { data?: { isDisabled?: boolean; config?: Record<string, unknown> } }): boolean {
  if (!node || !node.data) return false;
  if (node.data.config && typeof node.data.config.isDisabled === 'boolean') {
    return node.data.config.isDisabled;
  }
  if (node.data.config && typeof (node.data.config as Record<string, unknown>).disabled === 'boolean') {
    return Boolean((node.data.config as Record<string, unknown>).disabled);
  }
  if (typeof node.data.isDisabled === 'boolean') {
    return node.data.isDisabled;
  }
  return false;
}

export async function processActionNode(
  node: { id?: string; data?: { label?: string; actionType?: string; config?: Record<string, unknown>; isDisabled?: boolean } },
  context: ExecutionContext
): Promise<Record<string, unknown> | void> {
  const rawActionType = node.data?.actionType;
  const config = node.data?.config || {};
  if (!rawActionType) return;

  // Traversal Bypass Guard: If messaging/action step is disabled by designer, return safe default skipped payload
  if (isNodeDisabled(node)) {
    console.info(`[AUTOMATION] Bypassing disabled node "${node.data?.label || node.id}" (${rawActionType}) for run ${context.runId}`);
    return {
      skipped: true,
      isDisabled: true,
      reason: 'Messaging step disabled by designer',
      messageId: null,
      status: 'bypassed',
    };
  }

  const actionType = rawActionType.toUpperCase();
  const resolvedConfig = resolveConfigVariables(config, context.payload);

  switch (actionType) {
    case 'SEND_MESSAGE':
    case 'SEND_EMAIL':
    case 'SEND_SMS':
    case 'SEND_WHATSAPP': {
      const channel = actionType === 'SEND_EMAIL' ? 'email' 
        : actionType === 'SEND_SMS' ? 'sms' 
        : actionType === 'SEND_WHATSAPP' ? 'whatsapp' 
        : (resolvedConfig.channel || 'email');
      const enrichedConfig = { ...resolvedConfig, channel };
      return await handleSendMessage(enrichedConfig, context, node.id);
    }
    case 'DIRECT_EMAIL':
    case 'DIRECT_SMS':
    case 'DIRECT_WHATSAPP':
      return await handleDirectMessage(actionType as 'DIRECT_EMAIL' | 'DIRECT_SMS' | 'DIRECT_WHATSAPP', resolvedConfig, context, node.id);
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
    case 'UPDATE_DEAL_STATUS':
      return await handleUpdateDealStatus(resolvedConfig, context);
    case 'ASSIGN_DEAL_OWNER':
      return await handleAssignDealOwner(resolvedConfig, context);
    case 'UPDATE_DEAL_PROBABILITY':
      return await handleUpdateDealProbability(resolvedConfig, context);
    case 'CREATE_DEAL_TASK':
      return await handleCreateDealTask(resolvedConfig, context);
    case 'ADD_DEAL_NOTE':
      return await handleAddDealNote(resolvedConfig, context);
    case 'CREATE_ENTITY':
      return await handleCreateEntity(resolvedConfig, context);
    case 'ADD_CONTACT_TO_ENTITY':
      return await handleCreateContactForEntity(resolvedConfig, context);
    case 'UPDATE_CONTACT':
      return await handleUpdateContact(resolvedConfig, context);
    case 'ADD_TO_CALL_CAMPAIGN': {
      try {
        const { CallCentreService } = await import('../../services/call-centre-service');
        const { resolveContact } = await import('../../contact-adapter');
        const campaignId = String(resolvedConfig.campaignId || '');
        if (!campaignId) {
          throw new Error('No campaignId specified for ADD_TO_CALL_CAMPAIGN automation step.');
        }

        if (!context.entityId) {
          throw new Error('No entityId available in automation context.');
        }

        const targets = (resolvedConfig.recipientTargets || (resolvedConfig.contactScope ? [resolvedConfig.contactScope] : ['triggering'])) as string[];
        const roles = (resolvedConfig.recipientRoles || []) as string[];

        const contactOverrides: { entityId: string; contactId: string; contactName: string; phone: string; email: string }[] = [];
        const seenContactKeys = new Set<string>();

        const addOverride = (cId: string, name: string, phone: string, email: string) => {
          const key = `${cId}_${phone || email}`;
          if (!seenContactKeys.has(key)) {
            seenContactKeys.add(key);
            contactOverrides.push({
              entityId: context.entityId!,
              contactId: cId || 'primary',
              contactName: name || 'Contact',
              phone: phone || '',
              email: email || '',
            });
          }
        };

        const resolvedEntityContact = await resolveContact(context.entityId, context.workspaceId);
        const entityContacts = resolvedEntityContact?.entityContacts || [];

        if (targets.length > 0) {
          // 1. Triggering contact
          if (targets.includes('triggering')) {
            const triggerPhone = (context.payload?.phone || context.payload?.contactPhone || context.payload?.phoneNumber || '');
            const triggerEmail = (context.payload?.email || context.payload?.contactEmail || '');
            const triggerName = (context.payload?.name || context.payload?.contactName || context.payload?.displayName || '');
            const triggerContactId = (context.payload?.contactId || context.payload?.id || 'triggering');

            if (triggerPhone || triggerEmail) {
              addOverride(String(triggerContactId), String(triggerName || 'Triggering Contact'), String(triggerPhone), String(triggerEmail));
            } else {
              const primary = entityContacts.find(ec => ec.isPrimary) || entityContacts[0];
              if (primary) {
                addOverride(primary.id, primary.name, primary.phone || '', primary.email || '');
              } else if (resolvedEntityContact?.primaryContactPhone || resolvedEntityContact?.primaryContactEmail) {
                addOverride('primary', resolvedEntityContact.name || resolvedEntityContact.primaryContactName || 'Primary Contact', resolvedEntityContact.primaryContactPhone || '', resolvedEntityContact.primaryContactEmail || '');
              }
            }
          }

          // 2. Primary contact
          if (targets.includes('primary')) {
            const primary = entityContacts.find(ec => ec.isPrimary) || entityContacts[0];
            if (primary) {
              addOverride(primary.id, primary.name, primary.phone || '', primary.email || '');
            } else if (resolvedEntityContact?.primaryContactPhone || resolvedEntityContact?.primaryContactEmail) {
              addOverride('primary', resolvedEntityContact.name || resolvedEntityContact.primaryContactName || 'Primary Contact', resolvedEntityContact.primaryContactPhone || '', resolvedEntityContact.primaryContactEmail || '');
            }
          }

          // 3. Campus Signatories
          if (targets.includes('signatories')) {
            entityContacts.filter(ec => ec.isSignatory).forEach(ec => {
              addOverride(ec.id, ec.name, ec.phone || '', ec.email || '');
            });
          }

          // 4. Specific Role(s)
          if (targets.includes('roles') && roles.length > 0) {
            entityContacts.filter(ec => 
              ec.typeLabel && roles.some(r => r.toLowerCase() === ec.typeLabel?.toLowerCase() || r.toLowerCase() === ec.typeKey?.toLowerCase())
            ).forEach(ec => {
              addOverride(ec.id, ec.name, ec.phone || '', ec.email || '');
            });
          }

          // 5. All Contacts
          if (targets.includes('all')) {
            if (entityContacts.length > 0) {
              entityContacts.forEach(ec => {
                addOverride(ec.id, ec.name, ec.phone || '', ec.email || '');
              });
            } else {
              addOverride('primary', resolvedEntityContact?.name || resolvedEntityContact?.primaryContactName || 'Primary Contact', resolvedEntityContact?.primaryContactPhone || '', resolvedEntityContact?.primaryContactEmail || '');
            }
          }
        }

        const legacyScope = (resolvedConfig.contactScope as 'primary' | 'signatories' | 'all') || 'primary';

        const result = await CallCentreService.addContactsToCampaign(
          campaignId,
          [context.entityId],
          context.workspaceId,
          'automation-actor',
          contactOverrides.length > 0 ? contactOverrides : undefined,
          legacyScope
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
      return { __halt: true };
  }
}
