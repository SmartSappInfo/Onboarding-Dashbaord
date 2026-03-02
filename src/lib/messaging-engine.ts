
'use server';

import { adminDb } from './firebase-admin';
import type { MessageTemplate, SenderProfile, MessageStyle, MessageLog, VariableDefinition } from './types';
import { resolveVariables } from './messaging-utils';
import { logActivity } from './activity-logger';
import { sendSms } from './mnotify-service';
import { sendEmail, type EmailAttachment } from './resend-service';

interface SendMessageInput {
  templateId: string;
  senderProfileId: string;
  recipient: string;
  variables: Record<string, any>;
  attachments?: EmailAttachment[];
  schoolId?: string;
  scheduledAt?: string; // ISO string
}

/**
 * Main entry point for sending a single message via the messaging engine.
 * Decouples the application logic from the underlying gateways (mNotify & Resend).
 */
export async function sendMessage(input: SendMessageInput): Promise<{ success: boolean; error?: string; logId?: string }> {
  const { templateId, senderProfileId, recipient, variables, attachments, schoolId, scheduledAt } = input;

  try {
    // 1. Fetch Core Assets & Constants
    const [templateSnap, senderSnap, constantsSnap] = await Promise.all([
      adminDb.collection('message_templates').doc(templateId).get(),
      adminDb.collection('sender_profiles').doc(senderProfileId).get(),
      adminDb.collection('messaging_variables').where('source', '==', 'constant').get()
    ]);

    if (!templateSnap.exists) throw new Error(`Template not found: ${templateId}`);
    if (!senderSnap.exists) throw new Error(`Sender Profile not found: ${senderProfileId}`);

    const template = { id: templateSnap.id, ...templateSnap.data() } as MessageTemplate;
    const sender = { id: senderSnap.id, ...senderSnap.data() } as SenderProfile;

    if (!sender.isActive) throw new Error(`Sender Profile "${sender.name}" is inactive.`);
    if (!template.isActive) throw new Error(`Template "${template.name}" is inactive.`);
    if (template.channel !== sender.channel) throw new Error(`Channel mismatch: ${template.channel} vs ${sender.channel}.`);

    // 2. AUTO-RESOLUTION: Merge Global Constants into the variables map
    const finalVariables = { ...variables };
    constantsSnap.forEach(doc => {
        const v = doc.data() as VariableDefinition;
        if (v.constantValue !== undefined) {
            finalVariables[v.key] = v.constantValue;
        }
    });

    // 3. Resolve Subject & Body
    let resolvedSubject = template.channel === 'email' ? resolveVariables(template.subject || '', finalVariables) : null;
    let resolvedBody = resolveVariables(template.body, finalVariables);

    // 4. Apply Style (Email only)
    if (template.channel === 'email' && template.styleId) {
      const styleSnap = await adminDb.collection('message_styles').doc(template.styleId).get();
      if (styleSnap.exists) {
        const style = styleSnap.data() as MessageStyle;
        if (style.htmlWrapper.includes('{{content}}')) {
          resolvedBody = style.htmlWrapper.replace('{{content}}', resolvedBody);
        }
      }
    }

    // 5. Perform Actual Delivery
    let providerId = null;
    let providerStatus = null;

    if (template.channel === 'sms') {
        const providerResponse = await sendSms({
            recipient,
            message: resolvedBody,
            sender: sender.identifier,
            scheduleDate: scheduledAt ? new Date(scheduledAt) : undefined
        });
        providerId = providerResponse?.summary?._id;
        providerStatus = providerResponse?.status;
    } else {
        const providerResponse = await sendEmail({
            from: sender.identifier, 
            to: recipient,
            subject: resolvedSubject || 'Notification',
            html: resolvedBody,
            attachments: attachments,
            scheduledAt: scheduledAt
        });
        providerId = providerResponse?.id;
    }

    // 6. Create Audit Log
    const cleanedVariables = JSON.parse(JSON.stringify(finalVariables));

    const logData: Omit<MessageLog, 'id'> = {
      templateId: template.id,
      templateName: template.name,
      senderProfileId: sender.id,
      senderName: sender.name,
      channel: sender.channel,
      recipient,
      subject: resolvedSubject || null,
      body: resolvedBody,
      status: scheduledAt ? 'scheduled' : 'sent',
      sentAt: scheduledAt || new Date().toISOString(),
      variables: cleanedVariables,
      schoolId: schoolId || finalVariables.schoolId || finalVariables.school_id || null,
      providerId: providerId || null,
      providerStatus: providerStatus || null,
      hasAttachments: !!(attachments && attachments.length > 0),
      attachmentCount: attachments?.length || 0,
    };

    const sanitizedLogData = Object.fromEntries(
        Object.entries(logData).filter(([_, v]) => v !== undefined)
    );

    const logRef = await adminDb.collection('message_logs').add(sanitizedLogData);

    // 7. Sync with Activity Timeline
    await logActivity({
        schoolId: (logData.schoolId as string) || '',
        userId: null, 
        type: 'notification_sent',
        source: 'system',
        description: `${scheduledAt ? 'Scheduled' : 'Sent'} ${template.channel} "${template.name}" to ${recipient}`,
        metadata: { 
            logId: logRef.id, 
            channel: template.channel, 
            templateName: template.name,
            providerId: providerId,
            scheduledAt: scheduledAt,
            hasAttachments: logData.hasAttachments
        }
    });

    return { success: true, logId: logRef.id };

  } catch (error: any) {
    console.error(">>> [MESSAGING] DISPATCH ERROR:", error.message);
    return { success: false, error: error.message };
  }
}
