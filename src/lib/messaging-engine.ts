
'use server';

import { adminDb } from './firebase-admin';
import type { MessageTemplate, SenderProfile, MessageStyle, MessageLog, VariableDefinition, School, Contract } from './types';
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
  schoolId?: string | null;
  scheduledAt?: string; // ISO string
}

/**
 * Main entry point for sending a single message via the messaging engine.
 * Upgraded to handle multi-workspace log binding and intelligent sender resolution.
 */
export async function sendMessage(input: SendMessageInput): Promise<{ success: boolean; error?: string; logId?: string }> {
  const { templateId, senderProfileId, recipient, variables, attachments, schoolId, scheduledAt } = input;

  try {
    // 1. Fetch Template
    const templateSnap = await adminDb.collection('message_templates').doc(templateId).get();
    if (!templateSnap.exists) throw new Error(`Template not found: ${templateId}`);
    const template = { id: templateSnap.id, ...templateSnap.data() } as MessageTemplate;

    // 2. Resolve Sender Profile
    let senderProfileSnap;
    if (senderProfileId && senderProfileId !== 'default' && senderProfileId !== 'none') {
        senderProfileSnap = await adminDb.collection('sender_profiles').doc(senderProfileId).get();
    }

    if (!senderProfileSnap || !senderProfileSnap.exists) {
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
    }

    const sender = { id: senderProfileSnap.id, ...senderProfileSnap.data() } as SenderProfile;

    // 3. Resolve Operational Workspace context
    let workspaceIds: string[] = template.workspaceIds || ['onboarding'];
    const finalVariables = { ...variables };

    // 4. Resolve School Context (Record Priority)
    if (schoolId) {
        const schoolSnap = await adminDb.collection('schools').doc(schoolId).get();
        if (schoolSnap.exists) {
            const schoolData = schoolSnap.data() as School;
            const signatory = (schoolData.focalPersons || []).find(p => p.isSignatory);
            
            // Logs inherit workspace visibility from the school
            if (schoolData.workspaceIds?.length) workspaceIds = schoolData.workspaceIds;

            const schoolVars: any = {
                school_name: schoolData.name,
                school_initials: schoolData.initials,
                school_location: schoolData.location,
                school_phone: schoolData.phone,
                school_email: schoolData.email,
                contact_name: signatory?.name || '',
                contact_email: signatory?.email || '',
                contact_phone: signatory?.phone || '',
                contact_position: signatory?.type || '',
            };
            
            const contractSnap = await adminDb.collection('contracts').where('schoolId', '==', schoolId).limit(1).get();
            if (!contractSnap.empty) {
                const contractData = contractSnap.docs[0].data() as Contract;
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onboarding.smartsapp.com';
                schoolVars.agreement_url = `${baseUrl}/forms/${contractData.pdfId}?schoolId=${schoolId}`;
            }

            Object.entries(schoolVars).forEach(([k, v]) => {
                if (finalVariables[k] === undefined) finalVariables[k] = v;
            });
        }
    }

    // 5. Resolve Global Constants
    const constantsSnap = await adminDb.collection('messaging_variables').where('source', '==', 'constant').get();
    constantsSnap.forEach(doc => {
        const v = doc.data() as VariableDefinition;
        if (v.constantValue !== undefined && finalVariables[v.key] === undefined) {
            finalVariables[v.key] = v.constantValue;
        }
    });

    // 6. Resolve Style Wrapper
    let styleWrapper = '';
    if (template.styleId && template.styleId !== 'none') {
        const styleSnap = await adminDb.collection('message_styles').doc(template.styleId).get();
        if (styleSnap.exists) {
            styleWrapper = (styleSnap.data() as MessageStyle).htmlWrapper;
        }
    }

    // 7. Render Content
    let resolvedBody = '';
    if (template.channel === 'email' && template.blocks?.length) {
        resolvedBody = renderBlocksToHtml(template.blocks, finalVariables, {
            wrapper: styleWrapper || undefined
        });
    } else {
        resolvedBody = resolveVariables(template.body, finalVariables);
        if (template.channel === 'email' && styleWrapper && styleWrapper.includes('{{content}}')) {
            resolvedBody = styleWrapper.replace('{{content}}', resolvedBody);
        }
    }

    let resolvedSubject = template.channel === 'email' ? resolveVariables(template.subject || '', finalVariables) : null;
    let resolvedPreviewText = template.channel === 'email' ? resolveVariables(template.previewText || '', finalVariables) : null;
    let resolvedLogTitle = resolveVariables(template.name, finalVariables);

    // 8. Gateway Delivery
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
            from: `${sender.name} <${sender.identifier}>`, 
            to: recipient,
            subject: resolvedSubject || 'SmartSapp Notification',
            html: resolvedBody,
            attachments: attachments,
            scheduledAt: scheduledAt
        });
        providerId = providerResponse?.id;
    }

    // 9. Audit Log Generation
    const logData: Omit<MessageLog, 'id'> = {
      title: resolvedLogTitle,
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
      workspaceIds: workspaceIds, // Bind to institutional track(s)
      schoolId: schoolId || null,
      providerId: providerId || null,
      providerStatus: providerStatus || null,
      hasAttachments: !!(attachments && attachments.length > 0),
      attachmentCount: attachments?.length || 0,
    };

    const logRef = await adminDb.collection('message_logs').add(logData);

    await logActivity({
        schoolId: schoolId || '',
        userId: null, 
        workspaceIds: workspaceIds,
        type: 'notification_sent',
        source: 'system',
        description: `${scheduledAt ? 'Scheduled' : 'Sent'} ${template.channel} "${resolvedLogTitle}" to ${recipient}`,
        metadata: { logId: logRef.id, channel: template.channel, providerId }
    });

    return { success: true, logId: logRef.id };

  } catch (error: any) {
    console.error(">>> [MESSAGING] Logic Error:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sends a raw message without a predefined template.
 */
export async function sendRawMessage(input: {
    channel: 'email' | 'sms',
    recipient: string,
    body: string,
    subject?: string,
    senderProfileId?: string,
    variables?: Record<string, any>,
    workspaceIds?: string[]
}) {
    const { channel, recipient, body, subject, senderProfileId, variables = {}, workspaceIds = ['onboarding'] } = input;

    try {
        let senderProfileSnap;
        if (senderProfileId && senderProfileId !== 'default') {
            senderProfileSnap = await adminDb.collection('sender_profiles').doc(senderProfileId).get();
        }

        if (!senderProfileSnap || !senderProfileSnap.exists) {
            const defaultSnap = await adminDb.collection('sender_profiles')
                .where('channel', '==', channel)
                .where('isDefault', '==', true)
                .where('isActive', '==', true)
                .limit(1)
                .get();
            
            if (defaultSnap.empty) throw new Error(`No active sender profile found for ${channel}`);
            senderProfileSnap = defaultSnap.docs[0];
        }

        const sender = senderProfileSnap.data() as SenderProfile;
        const resolvedBody = resolveVariables(body, variables);
        const resolvedSubject = subject ? resolveVariables(subject, variables) : 'Institutional Alert — SmartSapp';

        if (channel === 'sms') {
            await sendSms({ recipient, message: resolvedBody, sender: sender.identifier });
        } else {
            await sendEmail({ from: `${sender.name} <${sender.identifier}>`, to: recipient, subject: resolvedSubject, html: resolvedBody });
        }

        return { success: true };
    } catch (error: any) {
        console.error(">>> [MESSAGING] Raw Dispatch Error:", error.message);
        return { success: false, error: error.message };
    }
}
