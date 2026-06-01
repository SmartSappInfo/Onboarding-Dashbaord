
'use server';

import { adminDb } from './firebase-admin';
import type { MessageTemplate, SenderProfile, MessageStyle, MessageLog, VariableDefinition, School, Contract, Meeting, EntityType } from './types';
import { resolveVariables, renderBlocksToHtml, plainTextToHtml } from './messaging-utils';
import { parseMarkdownLinksToHtml } from './utils/markdown-link-parser';
import { logActivity } from './activity-logger';
import { sendSms } from './mnotify-service';
import { sendEmail, type EmailAttachment } from './resend-service';
import { sendPushNotification } from './onesignal-service';
import { resolveTagVariables } from './messaging-actions';
import { resolveContact } from './contact-adapter';
import { buildMeetingBaseVariables, buildFacilitatorVariables, buildRegistrantVariables } from './meeting-variable-helpers';
import { getRecipientContact } from './migration-status-utils';
import { getContactVariables, getRecipientContactVariables } from './entity-contact-helpers';
import { getBaseUrl } from './utils/url-helpers';

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
/**
 * Normalizes phone numbers to generate common formats for database queries.
 */
function getPhoneFormats(phone: string): string[] {
  if (!phone) return [];
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return [phone];
  const digits9 = digits.slice(-9);
  return Array.from(new Set([
    phone,
    digits,
    `0${digits9}`,
    `+233${digits9}`,
    `233${digits9}`,
    digits9
  ])).filter(Boolean);
}

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

    // Inject Sender Variables
    if (sender.name && finalVariables.sender_name === undefined) finalVariables.sender_name = sender.name;
    if (sender.identifier && finalVariables.sender_email === undefined) {
        // Simple heuristic: if it has an @, it's an email, else it's a phone/identifier
        if (sender.identifier.includes('@')) finalVariables.sender_email = sender.identifier;
        else finalVariables.sender_phone = sender.identifier;
    }
    if ((sender as any).phone && finalVariables.sender_phone === undefined) finalVariables.sender_phone = (sender as any).phone;

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
                entity_name: contact.name,
                entity_email: contact.primaryContactEmail || '',
                entity_phone: contact.primaryContactPhone || '',
                entity_location: contact.locationString || '',
                entity_initials: contact.initials || '',
                entity_package: contact.schoolData?.subscriptionPackageName || 'Standard',
                id: resolvedEntityId || '',
                initials: contact.initials || '',
                referee: contact.referee || '',
                location_string: contact.locationString || '',
                zone_name: contact.zoneName || '',
            };

            // FER-02: Generate all role/primary/signatory variables from entityContacts
            const dynamicVars = getContactVariables({ entityContacts: contact.entityContacts || [] });
            Object.assign(contactVars, dynamicVars);
            
            // Generate recipient-specific variables based on the actual target (email/phone)
            const recipientVars = getRecipientContactVariables({ entityContacts: contact.entityContacts || [] }, recipient);
            Object.assign(contactVars, recipientVars);
            
            const contractSnap = await adminDb.collection('contracts').where('entityId', '==', resolvedEntityId).limit(1).get();
            if (!contractSnap.empty) {
                const contractData = contractSnap.docs[0].data() as Contract;
                const baseUrl = getBaseUrl();
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

    // Ensure resolvedWorkspaceId is not undefined/empty (Requirement 11)
    if (!resolvedWorkspaceId) {
        resolvedWorkspaceId = workspaceIds[0] || 'onboarding';
    }

    // 4.4 Meeting Context Auto-Enrichment
    // When _meetingId is present but meeting_title wasn't supplied by the caller,
    // fetch the meeting doc and inject base variables + facilitator/registrant context.
    const meetingId = finalVariables._meetingId || finalVariables.meetingId;
    const needsMeetingEnrichment = meetingId && (
        finalVariables.meeting_date === undefined ||
        finalVariables.meeting_time === undefined ||
        finalVariables.meeting_title === undefined ||
        finalVariables.meeting_type === undefined ||
        finalVariables.calendar_link === undefined ||
        finalVariables.meeting_timezone === undefined
    );
    if (needsMeetingEnrichment) {
        try {
            const meetingSnap = await adminDb.collection('meetings').doc(meetingId).get();
            if (meetingSnap.exists) {
                const meeting = { id: meetingSnap.id, ...meetingSnap.data() } as Meeting;
                
                // Let's resolve default timezone from organization if we can
                let tz = 'UTC';
                const orgId = (meeting as any).organizationId || template.organizationId || variables.organizationId;
                if (orgId) {
                    const orgSnap = await adminDb.collection('organizations').doc(orgId).get();
                    if (orgSnap.exists) {
                        tz = orgSnap.data()?.settings?.defaultTimezone || 'UTC';
                    }
                }

                const meetingVars = buildMeetingBaseVariables(meeting, tz);
                
                // Only set if not already provided by the caller
                Object.entries(meetingVars).forEach(([k, v]) => {
                    if (finalVariables[k] === undefined) finalVariables[k] = v;
                });

                // Auto-detect if recipient is a facilitator and inject their context
                if (meeting.facilitators?.length && !finalVariables.facilitator_name) {
                    const matchedFac = meeting.facilitators.find(
                        f => f.email === recipient || f.phone === recipient
                    );
                    if (matchedFac) {
                        const facVars = buildFacilitatorVariables(matchedFac);
                        Object.entries(facVars).forEach(([k, v]) => {
                            if (finalVariables[k] === undefined) finalVariables[k] = v;
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('>>> [MSG-ENGINE] Meeting context enrichment skipped:', (e as Error).message);
        }
    }

    // 4.5 Resolve Personalized Meeting Link (Webinar Lifecycle Phase 2)
    // If a _meetingId is passed, check if the recipient is a registrant and enrich variables
    if (meetingId) {
        let registrantDoc = null;

        // Try direct lookup by entityId in the registrants subcollection first (e.g. from bulk/direct actions)
        if (entityId) {
            try {
                const directSnap = await adminDb.collection(`meetings/${meetingId}/registrants`).doc(entityId).get();
                if (directSnap.exists) {
                    registrantDoc = directSnap;
                }
            } catch { /* ignore */ }
        }
        
        // Try email match
        if (!registrantDoc) {
            const targetEmail = (finalVariables.contact_email || recipient)?.toLowerCase().trim();
            if (targetEmail && targetEmail.includes('@')) {
                const emailQuery = await adminDb.collection(`meetings/${meetingId}/registrants`).where('email', '==', targetEmail).limit(1).get();
                if (!emailQuery.empty) registrantDoc = emailQuery.docs[0];
            }
        }

        // Try phone match
        if (!registrantDoc) {
            const targetPhone = (finalVariables.contact_phone || recipient)?.trim();
            if (targetPhone) {
                const formats = getPhoneFormats(targetPhone);
                const phoneQuery = await adminDb.collection(`meetings/${meetingId}/registrants`).where('phone', 'in', formats).limit(1).get();
                if (!phoneQuery.empty) registrantDoc = phoneQuery.docs[0];
            }
        }

        if (registrantDoc) {
            const rDocData = registrantDoc.data();
            if (rDocData) {
                const token = rDocData.token;
                if (token) {
                    const baseUrl = getBaseUrl();
                    
                    // Parse slugs from personalizedMeetingUrl
                    let typeSlug = 'meeting';
                    let meetingSlug = meetingId;
                    if (rDocData.personalizedMeetingUrl) {
                        try {
                            const urlObj = new URL(rDocData.personalizedMeetingUrl);
                            const paths = urlObj.pathname.split('/').filter(Boolean);
                            if (paths.length >= 3) {
                                typeSlug = paths[1];
                                meetingSlug = paths[2];
                            }
                        } catch { /* ignore */ }
                    }

                    // Set RSVP URLs dynamically
                    if (finalVariables.rsvp_going_url === undefined) {
                        finalVariables.rsvp_going_url = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/respond?token=${token}&response=going`;
                    }
                    if (finalVariables.rsvp_declined_url === undefined) {
                        finalVariables.rsvp_declined_url = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/respond?token=${token}&response=not_going`;
                    }
                    if (finalVariables.rsvp_later_url === undefined) {
                        finalVariables.rsvp_later_url = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/respond?token=${token}&response=later`;
                    }
                    if (finalVariables.registrant_join_link === undefined) {
                        finalVariables.registrant_join_link = rDocData.personalizedMeetingUrl || `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/join?token=${token}`;
                    }
                    if (finalVariables.meeting_registrant_join_link === undefined) {
                        finalVariables.meeting_registrant_join_link = rDocData.personalizedMeetingUrl || `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/join?token=${token}`;
                    }
                    if (finalVariables.meeting_registrant_one_click_link === undefined) {
                        finalVariables.meeting_registrant_one_click_link = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}?token=${token}`;
                    }
                    if (finalVariables.registrant_one_click_link === undefined) {
                        finalVariables.registrant_one_click_link = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}?token=${token}`;
                    }

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
        } else {
            // Fallback for RSVP/join URLs if registrant is not found (e.g. test dispatches, facilitators, or missing registrant doc)
            const baseUrl = getBaseUrl();
            let typeSlug = 'meeting';
            let meetingSlug = meetingId;
            try {
                const meetingSnap = await adminDb.collection('meetings').doc(meetingId).get();
                if (meetingSnap.exists) {
                    const mData = meetingSnap.data();
                    typeSlug = mData?.type?.id || 'meeting';
                    meetingSlug = mData?.meetingSlug || mData?.entitySlug || meetingId;
                }
            } catch { /* ignore */ }

            if (finalVariables.rsvp_going_url === undefined) {
                finalVariables.rsvp_going_url = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/respond?token=test-token&response=going`;
            }
            if (finalVariables.rsvp_declined_url === undefined) {
                finalVariables.rsvp_declined_url = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/respond?token=test-token&response=not_going`;
            }
            if (finalVariables.rsvp_later_url === undefined) {
                finalVariables.rsvp_later_url = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/respond?token=test-token&response=later`;
            }
            if (finalVariables.registrant_join_link === undefined) {
                finalVariables.registrant_join_link = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/join?token=test-token`;
            }
            if (finalVariables.meeting_registrant_join_link === undefined) {
                finalVariables.meeting_registrant_join_link = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/join?token=test-token`;
            }
            if (finalVariables.meeting_registrant_one_click_link === undefined) {
                finalVariables.meeting_registrant_one_click_link = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}?token=test-token`;
            }
            if (finalVariables.registrant_one_click_link === undefined) {
                finalVariables.registrant_one_click_link = `${baseUrl}/meetings/${typeSlug}/${meetingSlug}?token=test-token`;
            }
        }
    }

    // If still no workspaceId resolved, use template default or fallback
    if (!resolvedWorkspaceId) {
        resolvedWorkspaceId = workspaceIds[0] || 'onboarding';
    }

    // Inject Workspace Name & Organization Branding Variables concurrently (Promise.all)
    const orgId = template.organizationId || variables.organizationId || '';
    try {
        const wsPromise = resolvedWorkspaceId ? adminDb.collection('workspaces').doc(resolvedWorkspaceId).get() : Promise.resolve(null);
        const orgPromise = orgId ? adminDb.collection('organizations').doc(orgId).get() : Promise.resolve(null);

        const [wsSnap, orgSnap] = await Promise.all([wsPromise, orgPromise]);

        if (wsSnap && wsSnap.exists) {
            const wsData = wsSnap.data()!;
            if (finalVariables.workspace_name === undefined) {
                finalVariables.workspace_name = wsData.name || '';
            }
            // If orgId was not provided, but workspace points to an org, fetch it
            if (!orgId && wsData.organizationId) {
                const lazyOrgSnap = await adminDb.collection('organizations').doc(wsData.organizationId).get();
                if (lazyOrgSnap.exists) {
                    const org = lazyOrgSnap.data()!;
                    const orgVars: Record<string, string> = {
                        org_name: org.name || '',
                        org_logo_url: org.logoUrl || '',
                        org_email: org.email || '',
                        org_phone: org.phone || '',
                        org_address: org.address || '',
                        org_website: org.website || '',
                        unsubscribe_copy: org.unsubscribeCopy || 'You are receiving this email because you subscribed to our services. Click here to unsubscribe.',
                        brand_primary_color: org.brandPrimaryColor || '#3B5FFF',
                        brand_secondary_color: org.brandSecondaryColor || '#8B5CF6',
                        brand_font_family: org.brandFontFamily || 'Figtree',
                        current_year: new Date().getFullYear().toString(),
                        meeting_timezone: org.settings?.defaultTimezone || 'UTC',
                    };
                    Object.entries(orgVars).forEach(([k, v]) => {
                        if (finalVariables[k] === undefined) finalVariables[k] = v;
                    });
                }
            }
        }

        if (orgSnap && orgSnap.exists) {
            const org = orgSnap.data()!;
            const orgVars: Record<string, string> = {
                org_name: org.name || '',
                org_logo_url: org.logoUrl || '',
                org_email: org.email || '',
                org_phone: org.phone || '',
                org_address: org.address || '',
                org_website: org.website || '',
                unsubscribe_copy: org.unsubscribeCopy || 'You are receiving this email because you subscribed to our services. Click here to unsubscribe.',
                brand_primary_color: org.brandPrimaryColor || '#3B5FFF',
                brand_secondary_color: org.brandSecondaryColor || '#8B5CF6',
                brand_font_family: org.brandFontFamily || 'Figtree',
                current_year: new Date().getFullYear().toString(),
                meeting_timezone: org.settings?.defaultTimezone || 'UTC',
            };
            Object.entries(orgVars).forEach(([k, v]) => {
                if (finalVariables[k] === undefined) finalVariables[k] = v;
            });
        }
    } catch (e) {
        console.error('[MESSAGING_ENGINE] Failed resolving workspace/organization concurrently:', e);
    }
    // Ensure current_year is always available even without an org
    if (finalVariables.current_year === undefined) {
        finalVariables.current_year = new Date().getFullYear().toString();
    }

    // Phase 7: Inject Unsubscribe Link
    const baseUrl = getBaseUrl();
    const unsubId = resolvedEntityId || recipient;
    finalVariables.unsubscribe_link = `${baseUrl}/unsubscribe/${encodeURIComponent(unsubId)}?ws=${resolvedWorkspaceId}&c=${template.channel}`;

    // 6. Resolve Style Wrapper
    let styleWrapper = '';
    let activeStyleDoc: MessageStyle | null = null;

    if (template.styleId !== 'none') {
        const styleIdToUse = template.styleId;
        
        // If styleId is empty, undefined, null, or 'default', query default workspace style
        if (!styleIdToUse || styleIdToUse === 'default') {
            const defaultSnap = await adminDb.collection('message_styles')
                .where('workspaceIds', 'array-contains', resolvedWorkspaceId)
                .where('isDefault', '==', true)
                .limit(1)
                .get();
            if (!defaultSnap.empty) {
                activeStyleDoc = { id: defaultSnap.docs[0].id, ...defaultSnap.docs[0].data() } as MessageStyle;
            }
        } else {
            const styleSnap = await adminDb.collection('message_styles').doc(styleIdToUse).get();
            if (styleSnap.exists) {
                activeStyleDoc = { id: styleSnap.id, ...styleSnap.data() } as MessageStyle;
            }
        }

        if (activeStyleDoc) {
            // Select target-aware wrapper
            if (template.target === 'internal_team') {
                styleWrapper = activeStyleDoc.htmlWrapperInternal || activeStyleDoc.htmlWrapper || '';
            } else {
                styleWrapper = activeStyleDoc.htmlWrapperExternal || activeStyleDoc.htmlWrapper || '';
            }
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
            wrapper: styleWrapper || undefined,
            style: activeStyleDoc || undefined
        });
    } else {
        resolvedBody = resolveVariables(template.body, finalVariables);
        if (template.channel === 'email') {
            if (styleWrapper && styleWrapper.includes('{{content}}')) {
                let contentHtml = resolvedBody;
                if (template.contentMode === 'plain_text' || !template.contentMode) {
                    const escaped = contentHtml
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;');
                    const withLinks = parseMarkdownLinksToHtml(escaped);
                    contentHtml = withLinks.replace(/\n/g, '<br>\n');
                }
                resolvedBody = resolveVariables(styleWrapper, finalVariables).replace('{{content}}', contentHtml);
            } else if (template.contentMode === 'plain_text' || !template.contentMode) {
                // Plain text emails: convert \n to <br> and wrap in styled HTML container
                resolvedBody = plainTextToHtml(resolvedBody);
            }
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

    // Phase 8: Email Hygiene Guard (Resend Protection)
    if (template.channel === 'email') {
        const { ContactHygieneRepository } = await import('./hygiene-repository');
        const hygiene = await ContactHygieneRepository.getCache(recipient);
        
        // Block if strictly invalid, or highly risky (score below 40)
        if (hygiene && (hygiene.status === 'invalid' || (hygiene.status === 'risky' && (hygiene.score || 0) < 40))) {
            console.warn(`>>> [MSG-ENGINE] Delivery Guard aborted dispatch to ${recipient}: Status=${hygiene.status}, Score=${hygiene.score}`);
            return { 
                success: false, 
                error: `Recipient mailbox is marked as ${hygiene.status} (Hygiene Score: ${hygiene.score}). Delivery blocked to protect sender reputation.` 
            };
        }
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
      workspaceId: resolvedWorkspaceId || undefined, // Primary workspace context (Requirement 11)
      entityId: resolvedEntityId || null, // New unified entity reference
      entityType: (resolvedEntityType || undefined) as EntityType | undefined, // Entity type
      providerId: providerId || null,
      providerStatus: providerStatus || null,
      hasAttachments: !!(attachments && attachments.length > 0),
      attachmentCount: attachments?.length || 0,
    };

    const logRef = await adminDb.collection('message_logs').add(logData);

    await logActivity({
        entityId: resolvedEntityId || null,
        entityType: resolvedEntityType || null,
        organizationId: 'default',
        userId: null, 
        workspaceId: resolvedWorkspaceId || 'onboarding',
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

        // Phase 8: Email Hygiene Guard (Resend Protection)
        if (channel === 'email') {
            const { ContactHygieneRepository } = await import('./hygiene-repository');
            const hygiene = await ContactHygieneRepository.getCache(recipient);
            
            if (hygiene && (hygiene.status === 'invalid' || (hygiene.status === 'risky' && (hygiene.score || 0) < 40))) {
                console.warn(`>>> [MSG-ENGINE] Delivery Guard aborted RAW dispatch to ${recipient}: Status=${hygiene.status}, Score=${hygiene.score}`);
                return { 
                    success: false, 
                    error: `Recipient mailbox is marked as ${hygiene.status} (Hygiene Score: ${hygiene.score}). Delivery blocked to protect sender reputation.` 
                };
            }
        }

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
