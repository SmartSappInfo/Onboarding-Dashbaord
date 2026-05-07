
'use server';

import { adminDb } from './firebase-admin';
import type { MessageTemplate, SenderProfile, MessageStyle, MessageLog, VariableDefinition, School, Contract } from './types';
import { resolveVariables, renderBlocksToHtml } from './messaging-utils';
import { logActivity } from './activity-logger';
import { sendSms } from './mnotify-service';
import { sendEmail, type EmailAttachment } from './resend-service';
import { sendPushNotification } from './onesignal-service';
import { resolveTagVariables } from './messaging-actions';
import { resolveContact } from './contact-adapter';
import { getRecipientContact } from './migration-status-utils';
import { getContactVariables } from './entity-contact-helpers';

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
  // Task 15.1: Allow overriding template content
  body?: string; // Override template body
  tags?: { name: string; value: string }[]; // Optional provider-specific tags (Requirement 7)
  trackLinks?: boolean; // Phase 7: Whether to track URLs in the body
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
  const { templateId, senderProfileId, recipient, variables, attachments, entityId, entityType, workspaceId, scheduledAt, tags, trackLinks } = input;

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

            // FER-01: Dynamic contact variable generation from entityContacts
            // All contact identity is resolved through getContactVariables —
            // no direct schoolData field reads for contact/location/initials.
            const contactVars: Record<string, any> = {
                school_name: contact.name,
                entity_name: contact.name, // Unified name
                id: resolvedEntityId || '',
                initials: contact.initials || '',
                referee: contact.referee || '',
                location_string: contact.locationString || '',
                zone_name: contact.zoneName || '',
            };

            // FER-02: Generate all role/primary/signatory variables from entityContacts
            const dynamicVars = getContactVariables({ entityContacts: contact.entityContacts || [] });
            Object.assign(contactVars, dynamicVars);
            
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

            // Phase 6: Merge Dynamic Data Buckets
            const buckets = [
                contact.financeData,
                contact.industryData,
                contact.personData,
                contact.familyData,
                contact.customData
            ];

            buckets.forEach(bucket => {
                if (bucket) {
                    Object.entries(bucket).forEach(([k, v]) => {
                        if (finalVariables[k] === undefined) finalVariables[k] = v;
                    });
                }
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

    // 5. Resolve Global Fields & Constants from the new Registry
    const fieldsSnap = await adminDb.collection('app_fields')
        .where('workspaceId', '==', resolvedWorkspaceId)
        .where('status', '==', 'active')
        .get();

    fieldsSnap.forEach(doc => {
        const field = doc.data() as any;
        // Use defaultValue as the constant value if it's a global/common field
        if (field.defaultValue !== undefined && finalVariables[field.variableName] === undefined) {
            finalVariables[field.variableName] = field.defaultValue;
        }
    });

    // 5.5 Inject Organization Branding Variables (Dynamic Org Branding)
    // These variables power dynamic logos, footers, and style wrappers.
    // Resolution priority: variables already set > org record > empty string fallback.
    const orgId = template.organizationId || variables.organizationId || '';
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
                };
                // Only set if not already provided by the caller
                Object.entries(orgVars).forEach(([k, v]) => {
                    if (finalVariables[k] === undefined) finalVariables[k] = v;
                });
            }
        } catch (e) {
            console.warn('>>> [MSG-ENGINE] Org branding lookup skipped:', (e as Error).message);
        }
    }
    // Ensure current_year is always available even without an org
    if (finalVariables.current_year === undefined) {
        finalVariables.current_year = new Date().getFullYear().toString();
    }

    // Phase 7: Inject Unsubscribe Link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://onboarding.smartsapp.com';
    const unsubId = resolvedEntityId || recipient;
    finalVariables.unsubscribe_link = `${baseUrl}/unsubscribe/${encodeURIComponent(unsubId)}?ws=${resolvedWorkspaceId}&c=${template.channel}`;

    // 6. Resolve Style Wrapper (styleId is optional — null/undefined/'' means no wrapper)
    let styleWrapper = '';
    if (template.styleId && template.styleId !== 'none') {
        const styleSnap = await adminDb.collection('message_styles').doc(template.styleId).get();
        if (styleSnap.exists) {
            styleWrapper = (styleSnap.data() as MessageStyle).htmlWrapper;
        }
    }

    // 7. Render Content (contentMode-aware routing)
    // - 'rich_builder': Render blocks array into HTML with optional style wrapper
    // - 'plain_text' / 'html_code': Resolve variables in body, apply style wrapper if present
    // Fallback: if contentMode is missing (legacy), use blocks?.length heuristic
    let resolvedBody = '';
    const useBlocks = template.contentMode === 'rich_builder'
        || (!template.contentMode && template.channel === 'email' && template.blocks?.length);

    if (useBlocks && template.blocks?.length) {
        resolvedBody = renderBlocksToHtml(template.blocks, finalVariables, {
            wrapper: styleWrapper || undefined
        });
    } else {
        resolvedBody = resolveVariables(template.body, finalVariables);
        if (template.channel === 'email' && styleWrapper && styleWrapper.includes('{{content}}')) {
            resolvedBody = resolveVariables(styleWrapper, finalVariables).replace('{{content}}', resolvedBody);
        }
    }

    // Phase 7: Branded Link Tracking
    if (trackLinks) {
        const { transformBodyWithTracking } = await import('./link-tracking');
        // Find jobId and taskId from tags to associate the link
        const jobId = tags?.find(t => t.name === 'jobId')?.value || 'manual';
        const taskId = tags?.find(t => t.name === 'taskId')?.value || 'manual';
        
        resolvedBody = await transformBodyWithTracking({
            body: resolvedBody,
            campaignId: variables.campaignId || 'manual',
            jobId,
            taskId
        });
    }

    let resolvedSubject = template.channel === 'email' ? resolveVariables(template.subject || '', finalVariables) : null;
    let resolvedPreviewText = template.channel === 'email' ? resolveVariables(template.previewText || '', finalVariables) : null;
    let resolvedLogTitle = resolveVariables(template.name, finalVariables);

    // Phase 7: Suppression Check (Unsubscribe compliance)
    const { isSuppressed } = await import('./suppression-service');
    const suppressed = await isSuppressed({
        recipient,
        workspaceId: resolvedWorkspaceId,
        channel: template.channel as 'email' | 'sms'
    });

    if (suppressed) {
        console.warn(`>>> [MSG-ENGINE] Recipient ${recipient} is suppressed for ${template.channel} in workspace ${resolvedWorkspaceId}`);
        return { success: false, error: 'Recipient unsubscribed' };
    }

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
    } else if (template.channel === 'push') {
        const providerResponse = await sendPushNotification(
            [recipient], 
            resolvedSubject || 'SmartSapp Notification', 
            resolvedBody
        );
        providerId = providerResponse?.id;
        if (providerResponse?.errors) providerStatus = 'failed';
        else providerStatus = 'delivered';
    } else if (template.channel === 'in_app') {
        const inAppRef = await adminDb.collection('in_app_notifications').add({
            userId: recipient,
            organizationId: template.organizationId || variables.organizationId || 'default',
            workspaceId: resolvedWorkspaceId,
            title: resolvedSubject || resolvedLogTitle || 'Notification',
            body: resolvedBody,
            category: template.category || 'general',
            isRead: false,
            createdAt: scheduledAt || new Date().toISOString()
        });
        providerId = inAppRef.id;
        providerStatus = 'delivered';
    } else {
        const providerResponse = await sendEmail({
            from: `${sender.name} <${sender.identifier}>`, 
            to: recipient,
            subject: resolvedSubject || 'SmartSapp Notification',
            html: resolvedBody,
            attachments: attachments,
            scheduledAt: scheduledAt,
            tags: tags
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
    channel: 'email' | 'sms' | 'in_app' | 'push',
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
        } else if (channel === 'push') {
            await sendPushNotification([recipient], resolvedSubject, resolvedBody);
        } else if (channel === 'in_app') {
            await adminDb.collection('in_app_notifications').add({
                userId: recipient,
                organizationId: variables.organizationId || 'default',
                workspaceId: workspaceIds[0],
                title: resolvedSubject,
                body: resolvedBody,
                category: 'general',
                isRead: false,
                createdAt: new Date().toISOString()
            });
        } else {
            await sendEmail({ from: `${sender.name} <${sender.identifier}>`, to: recipient, subject: resolvedSubject, html: resolvedBody });
        }

        return { success: true };
    } catch (error: any) {
        console.error(">>> [MESSAGING] Raw Dispatch Error:", error.message);
        return { success: false, error: error.message };
    }
}
