'use server';

/**
 * SmartSapp Forms 2.0: 3-Tier Multi-Channel Notification Server Actions
 * 
 * Provides notification settings persistence, template querying, test message
 * dispatching, and resilient fail-safe 3-tier notification execution.
 */

import { adminDb } from '@/lib/firebase-admin';
import { COLLECTIONS } from '@/lib/collection-constants';
import { sendMessage } from '@/lib/messaging-engine';
import { triggerInternalNotification } from '@/lib/notification-engine';
import type { Form, MessageTemplate } from '@/lib/types';
import type {
  FormNotificationSettings,
  TestNotificationPayload,
  AutoResponderRule,
} from './form-notification-types';

/**
 * Persists 3-tier notification configuration onto the form document.
 */
export async function saveFormNotificationSettingsAction(
  formId: string,
  settings: FormNotificationSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!formId) return { success: false, error: 'formId is required' };

    await adminDb.collection(COLLECTIONS.FORMS).doc(formId).update({
      'actions.notifications': settings,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Queries active message templates for a given workspace.
 */
export async function getWorkspaceNotificationTemplatesAction(
  workspaceId: string
): Promise<{ success: boolean; templates: MessageTemplate[]; error?: string }> {
  try {
    if (!workspaceId) return { success: true, templates: [] };

    const snap = await adminDb.collection('message_templates')
      .where('workspaceId', '==', workspaceId)
      .get();

    const templates: MessageTemplate[] = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as MessageTemplate));

    return { success: true, templates };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, templates: [], error: msg };
  }
}

/**
 * Dispatches an instant test notification to verify channel delivery.
 */
export async function sendTestFormNotificationAction(
  payload: TestNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const { channel: _channel, templateId, recipient, workspaceId, organizationId, formTitle, sampleAnswers } = payload;
    if (!recipient?.trim() || !templateId) {
      return { success: false, error: 'Recipient and template ID are required' };
    }

    const variables: Record<string, string | number | boolean> = {
      'form.title': formTitle,
      'form.submittedAt': new Date().toLocaleString(),
      'respondent.email': recipient,
      'respondent.fullName': 'Test Respondent',
      ...(sampleAnswers || {}),
    };

    await sendMessage({
      templateId,
      senderProfileId: 'default',
      organizationId,
      recipient: recipient.trim(),
      variables,
      workspaceId,
    });

    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Evaluates whether an auto-responder rule condition matches submission answers or scores.
 */
export function evaluateAutoResponderCondition(
  rule: AutoResponderRule,
  answers: Record<string, string | number | boolean>,
  totalScore?: number
): boolean {
  if (!rule.enabled) return false;

  if (rule.triggerType === 'immediate') {
    return true;
  }

  if (rule.triggerType === 'score_threshold') {
    if (typeof rule.minScore !== 'number') return true;
    return (totalScore || 0) >= rule.minScore;
  }

  if (rule.triggerType === 'conditional' && rule.condition) {
    const { fieldId, operator, value } = rule.condition;
    if (!fieldId) return false;

    const answerVal = answers[fieldId];
    if (answerVal === undefined || answerVal === null) return false;

    const answerStr = String(answerVal).toLowerCase();
    const targetStr = String(value).toLowerCase();

    switch (operator) {
      case 'equals':
        return answerStr === targetStr;
      case 'not_equals':
        return answerStr !== targetStr;
      case 'contains':
        return answerStr.includes(targetStr);
      case 'greater_than':
        return Number(answerVal) > Number(value);
      case 'less_than':
        return Number(answerVal) < Number(value);
      default:
        return false;
    }
  }

  return false;
}

/**
 * Dispatches 3-Tier Multi-Channel Notifications with fail-safe non-blocking execution.
 */
export async function dispatchFormNotifications(params: {
  form: Form;
  submissionId: string;
  submissionData: Record<string, string | number | boolean>;
  totalScore?: number;
  assignedDealOwnerId?: string;
  resolvedEntityId?: string;
  automationVars: Record<string, string | number | boolean | undefined | null>;
}): Promise<{ dispatchedTiers: string[]; errors: string[] }> {
  const { form, submissionId: _submissionId, submissionData, totalScore, assignedDealOwnerId, resolvedEntityId, automationVars } = params;
  const notifications = form.actions?.notifications;
  if (!notifications) return { dispatchedTiers: [], errors: [] };

  const dispatchedTiers: string[] = [];
  const errors: string[] = [];
  const dispatchPromises: Promise<unknown>[] = [];

  const { internalAlerts, respondentAlerts, externalAlerts } = notifications;

  // ── Tier 1: Internal Staff Alerts ──
  if (internalAlerts?.enabled) {
    dispatchPromises.push(
      (async () => {
        try {
          const targetUsers = [...(internalAlerts.userIds || [])];
          if (internalAlerts.notifyDealOwner && assignedDealOwnerId && !targetUsers.includes(assignedDealOwnerId)) {
            targetUsers.push(assignedDealOwnerId);
          }

          const varsWithWorkspace = {
            workspaceId: form.workspaceId,
            ...automationVars,
          };

          await triggerInternalNotification({
            specificUserIds: targetUsers,
            variables: varsWithWorkspace,
            emailTemplateId: internalAlerts.emailTemplateId,
            smsTemplateId: internalAlerts.smsTemplateId,
            whatsappTemplateId: internalAlerts.whatsappTemplateId,
            inAppTemplateId: internalAlerts.inAppTemplateId,
            pushTemplateId: internalAlerts.pushTemplateId,
            channel: 'all',
          });
          dispatchedTiers.push('tier_1_internal');
        } catch (err) {
          errors.push(`Tier 1 Internal Alert Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      })()
    );
  }

  // ── Tier 2: Respondent Confirmations & Auto-Responders ──
  if (respondentAlerts?.enabled) {
    dispatchPromises.push(
      (async () => {
        try {
          const rawEmail = respondentAlerts.respondentEmailField
            ? submissionData[respondentAlerts.respondentEmailField]
            : (submissionData.email || submissionData.primaryEmail || submissionData.emailAddress);
          const respondentEmail = rawEmail ? String(rawEmail).trim() : undefined;

          const rawPhone = respondentAlerts.respondentPhoneField
            ? submissionData[respondentAlerts.respondentPhoneField]
            : (submissionData.phone || submissionData.phoneNumber || submissionData.mobile);
          const respondentPhone = rawPhone ? String(rawPhone).trim() : undefined;

          // Default Multi-Channel Receipt
          if (respondentAlerts.emailTemplateId && respondentEmail && respondentEmail.includes('@')) {
            await sendMessage({
              templateId: respondentAlerts.emailTemplateId,
              senderProfileId: 'default',
              organizationId: form.organizationId,
              recipient: respondentEmail,
              variables: automationVars,
              entityId: resolvedEntityId,
              workspaceId: form.workspaceId,
            });
          }

          if (respondentAlerts.smsTemplateId && respondentPhone) {
            await sendMessage({
              templateId: respondentAlerts.smsTemplateId,
              senderProfileId: 'default',
              organizationId: form.organizationId,
              recipient: respondentPhone,
              variables: automationVars,
              entityId: resolvedEntityId,
              workspaceId: form.workspaceId,
            });
          }

          if (respondentAlerts.whatsappTemplateId && respondentPhone) {
            await sendMessage({
              templateId: respondentAlerts.whatsappTemplateId,
              senderProfileId: 'default',
              organizationId: form.organizationId,
              recipient: respondentPhone,
              variables: automationVars,
              entityId: resolvedEntityId,
              workspaceId: form.workspaceId,
            });
          }

          // Conditional Auto-Responder Rules
          if (respondentAlerts.autoResponderRules && respondentAlerts.autoResponderRules.length > 0) {
            for (const rule of respondentAlerts.autoResponderRules) {
              const isMatch = evaluateAutoResponderCondition(rule, submissionData, totalScore);
              if (isMatch) {
                const targetRecipient = rule.channel === 'email' ? respondentEmail : respondentPhone;
                if (targetRecipient) {
                  await sendMessage({
                    templateId: rule.templateId,
                    senderProfileId: 'default',
                    organizationId: form.organizationId,
                    recipient: targetRecipient,
                    variables: automationVars,
                    entityId: resolvedEntityId,
                    workspaceId: form.workspaceId,
                  });
                }
              }
            }
          }

          dispatchedTiers.push('tier_2_respondent');
        } catch (err) {
          errors.push(`Tier 2 Respondent Confirmation Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      })()
    );
  }

  // ── Tier 3: External Stakeholder Alerts ──
  if (externalAlerts?.enabled && externalAlerts.emailAddresses && externalAlerts.emailAddresses.length > 0) {
    dispatchPromises.push(
      (async () => {
        try {
          const templateId = externalAlerts.emailTemplateId;
          if (templateId) {
            const validEmails = (externalAlerts.emailAddresses || []).filter(e => e && e.includes('@'));
            await Promise.allSettled(
              validEmails.map(email =>
                sendMessage({
                  templateId,
                  senderProfileId: 'default',
                  organizationId: form.organizationId,
                  recipient: email.trim(),
                  variables: automationVars,
                  workspaceId: form.workspaceId,
                })
              )
            );
          }
          dispatchedTiers.push('tier_3_external');
        } catch (err) {
          errors.push(`Tier 3 External Alert Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      })()
    );
  }

  // Resilient non-blocking execution
  await Promise.allSettled(dispatchPromises);
  return { dispatchedTiers, errors };
}
