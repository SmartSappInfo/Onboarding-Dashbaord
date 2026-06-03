'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { ScheduledMessage, MessageTemplate, MessageStyle } from '@/lib/types';
import { buildVariableMap } from '@/lib/template-resolver';
import { resolveVariables, renderBlocksToHtml, plainTextToHtml } from '@/lib/messaging-utils';
import { sendRawMessage } from '@/lib/messaging-engine';

export async function renderScheduledMessageAction(messageId: string) {
  try {
    const msgSnap = await adminDb.collection('scheduled_messages').doc(messageId).get();
    if (!msgSnap.exists) {
      throw new Error('Scheduled message not found');
    }
    const message = msgSnap.data() as ScheduledMessage;
    
    // Fallbacks if template resolution fails
    let fallbackSubject = 'Preview Unavailable';
    
    try {
      const templateSnap = await adminDb.collection('message_templates').doc(message.templateId).get();
      if (!templateSnap.exists) {
        throw new Error(`Template ${message.templateId} not found`);
      }
      const template = { id: templateSnap.id, ...templateSnap.data() } as MessageTemplate;

      // Determine context for variable map building
      const resolutionCtx: any = {};
      if (message.variables) {
         if (message.variables.meetingId) resolutionCtx.meetingId = message.variables.meetingId;
         if (message.variables.formId) resolutionCtx.formId = message.variables.formId;
         if (message.variables.surveyId) resolutionCtx.surveyId = message.variables.surveyId;
      }
      if (message.sourceEventType === 'meeting' && message.sourceEventId) {
        resolutionCtx.meetingId = message.sourceEventId;
      }
      
      // We pass the stored variables as extraVars to override anything
      resolutionCtx.extraVars = message.variables || {};

      let vars: Record<string, any> = {};
      try {
        vars = await buildVariableMap(template.variableContext || 'meeting', resolutionCtx);
      } catch (varErr: any) {
        console.warn('Could not fully build variable map, proceeding with raw stored variables:', varErr.message);
        vars = message.variables || {};
      }
      
      // Inject organization branding vars if possible
      const orgId = message.organizationId || '';
      if (orgId) {
          try {
              const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
              if (orgSnap.exists) {
                  const org = orgSnap.data() as Record<string, any>;
                  const orgVars: Record<string, string> = {
                      org_name: org.name || '',
                      org_logo_url: org.logoUrl || '',
                      org_email: org.email || '',
                      org_phone: org.phone || '',
                      org_address: org.address || '',
                      org_website: org.website || '',
                      current_year: new Date().getFullYear().toString(),
                      meeting_timezone: org.settings?.defaultTimezone || 'UTC',
                  };
                  vars = { ...orgVars, ...vars };
              }
          } catch (e) {}
      }

      let styleWrapper = '';
      if (template.styleId && template.styleId !== 'none') {
          const styleSnap = await adminDb.collection('message_styles').doc(template.styleId).get();
          if (styleSnap.exists) {
              styleWrapper = (styleSnap.data() as MessageStyle).htmlWrapper || '';
          }
      }

      let resolvedBody = '';
      const useBlocks = template.contentMode === 'rich_builder' || (!template.contentMode && template.channel === 'email' && template.blocks?.length);

      if (useBlocks && template.blocks?.length) {
          resolvedBody = renderBlocksToHtml(template.blocks, vars, {
              wrapper: styleWrapper || undefined
          });
      } else {
          resolvedBody = resolveVariables(template.body, vars);
          if (template.channel === 'email') {
              if (styleWrapper && styleWrapper.includes('{{content}}')) {
                  resolvedBody = resolveVariables(styleWrapper, vars).replace('{{content}}', resolvedBody);
              } else if (template.contentMode === 'plain_text' || !template.contentMode) {
                  resolvedBody = plainTextToHtml(resolvedBody);
              }
          }
      }

      const resolvedSubject = template.channel === 'email' ? resolveVariables(template.subject || 'No Subject', vars) : null;

      return {
        success: true,
        subject: resolvedSubject,
        body: resolvedBody,
        channel: message.channel,
        recipient: message.recipientContact,
        templateId: template.id
      };
    } catch (e: any) {
      console.warn('Template preview render failed:', e.message);
      return {
        success: true,
        subject: fallbackSubject,
        body: `<div style="padding: 20px; font-family: sans-serif; color: #dc2626; border: 1px solid #fca5a5; background: #fef2f2; border-radius: 8px;"><strong>Preview Warning:</strong> ${e.message}<br/><br/>The message might still send correctly during actual dispatch if variables are resolved correctly at that time.</div>`,
        channel: message.channel,
        recipient: message.recipientContact
      };
    }
  } catch (err: any) {
    console.error('[renderScheduledMessageAction]', err);
    return { success: false, error: err.message };
  }
}

export async function sendTestMessageAction(
  channel: 'email' | 'sms' | 'in_app' | 'push',
  recipient: string,
  body: string,
  subject?: string,
  workspaceIds: string[] = ['onboarding']
) {
  try {
    if (!recipient) {
      throw new Error('Test recipient is required');
    }
    
    if (channel === 'email' && !recipient.includes('@')) {
      throw new Error('Invalid email format for test dispatch');
    }

    const result = await sendRawMessage({
      channel,
      recipient,
      body,
      subject: subject || 'Test Message Preview',
      workspaceIds
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to send test message');
    }

    return { success: true, message: `Test message successfully sent to ${recipient}` };
  } catch (err: any) {
    console.error('[sendTestMessageAction]', err);
    return { success: false, error: err.message };
  }
}

export async function rescheduleMessageAction(id: string, dateIsoString: string) {
  try {
    const { ScheduledMessageRepository } = await import('@/lib/scheduled-message-repository');
    await ScheduledMessageRepository.updateSchedule(id, new Date(dateIsoString));
    return { success: true };
  } catch (err: any) {
    console.error('[rescheduleMessageAction]', err);
    return { success: false, error: err.message };
  }
}

export async function cancelMessageAction(id: string) {
  try {
    const { ScheduledMessageRepository } = await import('@/lib/scheduled-message-repository');
    await ScheduledMessageRepository.cancel(id);
    return { success: true };
  } catch (err: any) {
    console.error('[cancelMessageAction]', err);
    return { success: false, error: err.message };
  }
}

export async function sendMessageNowAction(id: string) {
  try {
    const { ScheduledMessageRepository } = await import('@/lib/scheduled-message-repository');
    return await ScheduledMessageRepository.sendNow(id);
  } catch (err: any) {
    console.error('[sendMessageNowAction]', err);
    return { success: false, error: err.message };
  }
}

export async function updateScheduledMessageContentAction(id: string, subject: string | null, body: string | null) {
  try {
    const { ScheduledMessageRepository } = await import('@/lib/scheduled-message-repository');
    await ScheduledMessageRepository.updateContent(id, subject, body);
    return { success: true };
  } catch (err: any) {
    console.error('[updateScheduledMessageContentAction]', err);
    return { success: false, error: err.message };
  }
}
