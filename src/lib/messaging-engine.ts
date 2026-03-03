'use server';

import { adminDb } from './firebase-admin';
import type { MessageTemplate, SenderProfile, MessageStyle, MessageLog, VariableDefinition, School } from './types';
import { resolveVariables, renderBlocksToHtml } from './messaging-utils';
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
 * Upgraded to handle structured blocks for high-fidelity emails and automatic sender fallback.
 */
export async function sendMessage(input: SendMessageInput): Promise<{ success: boolean; error?: string; logId?: string }> {
  const { templateId, senderProfileId, recipient, variables, attachments, schoolId, scheduledAt } = input;

  try {
    // 1. Fetch Template
    const templateSnap = await adminDb.collection('message_templates').doc(templateId).get();
    if (!templateSnap.exists) throw new Error(`Template not found: ${templateId}`);
    const template = { id: templateSnap.id, ...templateSnap.data() } as MessageTemplate;

    // 2. Resolve Sender Profile (with intelligent fallback for 'default' or missing IDs)
    let senderProfileSnap;
    if (senderProfileId === 'default' || !senderProfileId || senderProfileId === 'none') {
        const defaultSnap = await adminDb.collection('sender_profiles')
            .where('channel', '==', template.channel)
            .where('isDefault', '==', true)
            .where('isActive', '==', true)
            .limit(1)
            .get();
        
        if (defaultSnap.empty) {
            const anyActiveSnap = await adminDb.collection('sender_profiles')
                .where('channel', '==', template.channel)
                .where('isActive', '==', true)
                .limit(1)
                .get();
            
            if (anyActiveSnap.empty) throw new Error(`No active sender profile found for ${template.channel}`);
            senderProfileSnap = anyActiveSnap.docs[0];
        } else {
            senderProfileSnap = defaultSnap.docs[0];
        }
    } else {
        senderProfileSnap = await adminDb.collection('sender_profiles').doc(senderProfileId).get();
    }

    if (!senderProfileSnap.exists) throw new Error(`Sender Profile not found: ${senderProfileId}`);
    const sender = { id: senderProfileSnap.id, ...senderProfileSnap.data() } as SenderProfile;

    if (!sender.isActive) throw new Error(`Sender Profile "${sender.name}" is inactive.`);
    if (!template.isActive) throw new Error(`Template "${template.name}" is inactive.`);
    if (template.channel !== sender.channel) throw new Error(`Channel mismatch: ${template.channel} vs ${sender.channel}.`);

    // 3. Initialize Final Variables with passed values
    const finalVariables = { ...variables };

    // 4. Resolve School Context if schoolId is provided (High Priority)
    if (schoolId) {
        const schoolSnap = await adminDb.collection('schools').doc(schoolId).get();
        if (schoolSnap.exists) {
            const schoolData = schoolSnap.data() as School;
            const schoolVars = {
                school_name: schoolData.name,
                school_initials: schoolData.initials,
                school_location: schoolData.location,
                school_phone: schoolData.phone,
                school_email: schoolData.email,
                school_contact_name: schoolData.contactPerson,
            };
            // Merge school vars without overwriting already present keys (e.g. if the form already provided school_name)
            Object.entries(schoolVars).forEach(([k, v]) => {
                if (finalVariables[k] === undefined) finalVariables[k] = v;
            });
            // Fallback for contact_name if not provided by form
            if (finalVariables.contact_name === undefined) finalVariables.contact_name = schoolData.contactPerson;
        }
    }

    // 5. Resolve Global Constants (Lowest Priority - only if key is missing)
    const constantsSnap = await adminDb.collection('messaging_variables').where('source', '==', 'constant').get();
    constantsSnap.forEach(doc => {
        const v = doc.data() as VariableDefinition;
        if (v.constantValue !== undefined && finalVariables[v.key] === undefined) {
            finalVariables[v.key] = v.constantValue;
        }
    });

    // 6. Render Body
    let resolvedBody = '';
    if (template.channel === 'email' && template.blocks && template.blocks.length > 0) {
        resolvedBody = renderBlocksToHtml(template.blocks, finalVariables);
    } else {
        resolvedBody = resolveVariables(template.body, finalVariables);
    }

    // 7. Resolve Metadata (Email only)
    let resolvedSubject = template.channel === 'email' ? resolveVariables(template.subject || '', finalVariables) : null;
    let resolvedPreviewText = template.channel === 'email' ? resolveVariables(template.previewText || '', finalVariables) : null;

    // 8. Apply Legacy Style Wrapper (if no blocks)
    if (template.channel === 'email' && template.styleId && !template.blocks?.length) {
      const styleSnap = await adminDb.collection('message_styles').doc(template.styleId).get();
      if (styleSnap.exists) {
        const style = styleSnap.data() as MessageStyle;
        if (style.htmlWrapper.includes('{{content}}')) {
          resolvedBody = style.htmlWrapper.replace('{{content}}', resolvedBody);
        }
      }
    }

    // 9. Perform Delivery
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

    // 10. Create Audit Log
    const logData: Omit<MessageLog, 'id'> = {
      title: template.name,
      templateId: template.id,
      templateName: template.name,
      senderProfileId: sender.id,
      senderName: sender.name,
      channel: sender.channel,
      recipient,
      subject: resolvedSubject || null,
      previewText: resolvedPreviewText || null,
      body: resolvedBody,
      status: scheduledAt ? 'scheduled' : 'sent',
      sentAt: scheduledAt || new Date().toISOString(),
      variables: JSON.parse(JSON.stringify(finalVariables)),
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

    // 11. Sync Activity Timeline
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
            scheduledAt: scheduledAt
        }
    });

    return { success: true, logId: logRef.id };

  } catch (error: any) {
    console.error(">>> [MESSAGING] DISPATCH ERROR:", error.message);
    return { success: false, error: error.message };
  }
}