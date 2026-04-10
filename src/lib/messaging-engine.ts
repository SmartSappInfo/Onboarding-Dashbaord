
'use server';

import { adminDb } from './firebase-admin';
import type { MessageTemplate, SenderProfile, MessageStyle, MessageLog, VariableDefinition, School, Contract } from './types';
import { resolveVariables, renderBlocksToHtml } from './messaging-utils';
import { logActivity } from './activity-logger';
import { sendSms } from './mnotify-service';
import { sendEmail, type EmailAttachment } from './resend-service';
import { getSchoolEmail, getSchoolPhone, getSignatory } from './school-helpers';
import { getPrimaryWorkspaceId } from './workspace-helpers';
import { resolveTagVariables } from './messaging-actions';
import { resolveContact } from './contact-adapter';
import { getContactEmail, getContactPhone, getContactSignatory, getRecipientContact } from './migration-status-utils';

interface SendMessageInput {
  templateId: string;
  senderProfileId: string;
  recipient: string;
  variables: Record<string, any>;
  attachments?: EmailAttachment[];
  entityId?: string | null;
  entityType?: 'institution' | 'family' | 'person'; // Entity type
  workspaceId?: string; // Workspace context for message (Requirement 11)
  scheduledAt?: string; // ISO string
}

/**
 * @fileOverview Main entry point for sending a single message via the messaging engine.
 * 
 * SCHEDULING LOGIC (Composer):
 * When 'scheduledAt' is provided, this function delegates the "waiting" period to 
 * the external providers (mNotify/Resend). The providers are responsible for 
 * maintaining the queue and firing the message at the requested time.
 * 
 * Updated to use the Contact Adapter Layer for backward compatibility (Requirement 18)
 */
export async function sendMessage(input: SendMessageInput): Promise<{ success: boolean; error?: string; logId?: string }> {
  const { templateId, senderProfileId, recipient, variables, attachments, entityId, entityType, workspaceId, scheduledAt } = input;

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

    // 3. Resolve Operational Workspace context (Requirement 11)
    // Priority: explicit workspaceId > template workspaceIds > contact workspaceIds > default
    let resolvedWorkspaceId = workspaceId;
    let workspaceIds: string[] = template.workspaceIds || ['onboarding'];
    const finalVariables = { ...variables };

    // 4. Resolve Contact Context using Adapter Layer (Requirement 18)
    // Support dual-write: accept either entityId or entityId (Requirement 15.1, 15.2)
    let resolvedEntityId = entityId;
    let resolvedEntityType = entityType;

    if (entityId) {
        // Use adapter to resolve contact from either schools or entities + workspace_entities
        const contextWorkspaceId = resolvedWorkspaceId || workspaceIds[0] || 'onboarding';
        const contact = await resolveContact(entityId || '', contextWorkspaceId);
        
        if (contact) {
            const signatory = getRecipientContact(contact, recipient);
            
            // Populate identifiers
            if (contact.schoolData?.id && !resolvedEntityId) {
                resolvedEntityId = contact.schoolData.id;
            }
            if (contact.entityId) {
                resolvedEntityId = contact.entityId;
                resolvedEntityType = contact.entityType || 'institution';
            }
            
            // Logs inherit workspace visibility from the contact
            if (contact.schoolData?.workspaceIds?.length) {
                workspaceIds = contact.schoolData.workspaceIds;
            }

            // If no explicit workspaceId provided, use the primary workspace from contact
            if (!resolvedWorkspaceId) {
                resolvedWorkspaceId = workspaceIds[0] || 'onboarding';
            }

            const contactVars: any = {
                school_name: contact.name,
                school_initials: contact.schoolData?.initials || '',
                school_location: contact.schoolData?.location || '',
                school_phone: getContactPhone(contact) || '',
                school_email: getContactEmail(contact) || '',
                contact_name: signatory?.name || '',
                contact_email: signatory?.email || '',
                contact_phone: signatory?.phone || '',
                contact_position: signatory?.type || '',
                // Standard Aliases (Task: Automatic Binding)
                name: signatory?.name || contact.name || '',
                email: signatory?.email || getContactEmail(contact) || '',
                phone: signatory?.phone || getContactPhone(contact) || '',
                first_name: (signatory?.name || contact.name || '').split(' ')[0],
                id: resolvedEntityId || '',
            };
            
            const contractSnap = await adminDb.collection('contracts').where('entityId', '==', resolvedEntityId).limit(1).get();
            if (!contractSnap.empty) {
                const contractData = contractSnap.docs[0].data() as Contract;
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onboarding.smartsapp.com';
                contactVars.agreement_url = `${baseUrl}/forms/${contractData.pdfId}?entityId=${resolvedEntityId}`;
            }

            Object.entries(contactVars).forEach(([k, v]) => {
                if (finalVariables[k] === undefined) finalVariables[k] = v;
            });

            // Resolve tag variables for this contact (FR5.2.1, FR5.2.2, Requirement 7, Requirement 11, Requirement 18)
            // Pass workspaceId to resolve workspace-scoped tags from workspace_entities.workspaceTags
            const tagVars = await resolveTagVariables(resolvedEntityId || '', 'school', resolvedWorkspaceId);
            Object.entries(tagVars).forEach(([k, v]) => {
                if (finalVariables[k] === undefined) finalVariables[k] = v;
            });
        }
    }

    // 4.5 Resolve Personalized Meeting Link (Webinar Lifecycle Phase 2)
    // If a _meetingId is passed, check if the recipient is a registrant and append their token
    const meetingId = finalVariables._meetingId;
    if (meetingId && (finalVariables.meeting_link || finalVariables.link)) {
        let registrantDoc = null;
        
        // Try email match
        const targetEmail = finalVariables.contact_email || recipient;
        if (targetEmail && targetEmail.includes('@')) {
            const emailQuery = await adminDb.collection(`meetings/${meetingId}/registrants`).where('email', '==', targetEmail).limit(1).get();
            if (!emailQuery.empty) registrantDoc = emailQuery.docs[0];
        }

        // Try phone match
        if (!registrantDoc) {
            const targetPhone = finalVariables.contact_phone || recipient;
            if (targetPhone) {
                const phoneQuery = await adminDb.collection(`meetings/${meetingId}/registrants`).where('phone', '==', targetPhone).limit(1).get();
                if (!phoneQuery.empty) registrantDoc = phoneQuery.docs[0];
            }
        }

        if (registrantDoc) {
            const token = registrantDoc.data().token;
            if (token) {
                if (finalVariables.meeting_link) {
                    const sep = finalVariables.meeting_link.includes('?') ? '&' : '?';
                    finalVariables.meeting_link = `${finalVariables.meeting_link}${sep}token=${token}`;
                }
                if (finalVariables.link) {
                    const sep = finalVariables.link.includes('?') ? '&' : '?';
                    finalVariables.link = `${finalVariables.link}${sep}token=${token}`;
                }
            }
        }
    }

    // If still no workspaceId resolved, use template default or fallback
    if (!resolvedWorkspaceId) {
        resolvedWorkspaceId = workspaceIds[0] || 'onboarding';
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

    // 9. Audit Log Generation (Requirement 11 - Record workspaceId, Requirement 15.2 - Dual-write)
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
      workspaceId: resolvedWorkspaceId, // Primary workspace context (Requirement 11)
      entityId: resolvedEntityId || null, // New unified entity reference
      entityType: resolvedEntityType, // Entity type
      providerId: providerId || null,
      providerStatus: providerStatus || null,
      hasAttachments: !!(attachments && attachments.length > 0),
      attachmentCount: attachments?.length || 0,
    };

    const logRef = await adminDb.collection('message_logs').add(logData);

    await logActivity({
        entityId: resolvedEntityId || null,
        entityType: resolvedEntityType,
        organizationId: 'default',
        userId: null, 
        workspaceId: resolvedWorkspaceId,
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
