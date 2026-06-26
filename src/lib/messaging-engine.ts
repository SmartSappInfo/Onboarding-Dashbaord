
'use server';

import { adminDb } from './firebase-admin';
import type { MessageTemplate, SenderProfile, MessageStyle, MessageLog, VariableDefinition, School, Contract, Meeting, EntityType, DefaultSenderProfileIds } from './types';
import { resolveVariables, renderBlocksToHtml, plainTextToHtml } from './messaging-utils';
import { resolveOrgBrandingVars } from './messaging-branding';
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
import { getBaseUrl, getRequestBaseUrl, cleanPersonalizedMeetingUrl } from './utils/url-helpers';
import { CHANNEL_REGISTRY } from './messaging/channel-registry';
import { resolveOrgId, resolveSenderProfileId, toSenderProfile } from './messaging/sender-repository';
import { notifyMessagingFailure } from './messaging/messaging-failure-notice';
import { resolveOrgProviderKeys } from './messaging/org-provider-keys';

interface SendMessageInput {
  templateId: string;
  senderProfileId: string;
  /**
   * Tenant the message is sent on behalf of. When omitted it is derived from
   * the template, then the workspace. Sender resolution is scoped strictly to
   * this org — there is no cross-tenant fallback.
   */
  organizationId?: string;
  recipient: string;
  variables: Record<string, any>;
  attachments?: EmailAttachment[];
  entityId?: string | null;
  entityType?: 'institution' | 'family' | 'person'; // Entity type
  workspaceId?: string; // Workspace context for message (Requirement 11)
  scheduledAt?: string; // ISO string
  // Task 15.1: Allow overriding template content
  body?: string; // Override template body
  subject?: string; // Override template subject
  previewText?: string; // Override template preview text (e.g. per-resend framing)
  tags?: { name: string; value: string }[]; // Optional provider-specific tags (Requirement 7)
  trackLinks?: boolean; // Phase 7: Whether to track URLs in the body
  campaignId?: string;
  campaignVariantId?: 'A' | 'B';
  messageType?: 'transactional' | 'marketing';
  // Automation correlation — enables per-node delivery stats and resend.
  automationId?: string;
  runId?: string;
  nodeId?: string;
  /** True when this send is a resend of an earlier message at the same node. */
  isResend?: boolean;
  /** The id of the original MessageLog this is a resend of. */
  resendOfLogId?: string;
  /** 1-based attempt number for resends. */
  resendNumber?: number;
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

/**
 * Fire-and-forget reachability signal (Level 3) from an SMS send.
 * `ok` reflects provider ACCEPTANCE (mNotify accepted the request), which is
 * not the same as confirmed delivery — true delivery status would require
 * mNotify status polling/webhooks (deferred). Never awaited and never throws,
 * so it cannot delay or fail the message send.
 */
function recordSmsReachability(recipient: string, ok: boolean): void {
  import('./phone-hygiene-repository')
    .then(({ PhoneHygieneRepository }) => PhoneHygieneRepository.recordSmsOutcome(recipient, ok))
    .catch((err) => console.warn('[MSG-ENGINE] recordSmsReachability failed (non-fatal):', err?.message));
}

export async function sendMessage(input: SendMessageInput): Promise<{ success: boolean; error?: string; logId?: string }> {
  const { templateId, senderProfileId, recipient, variables, attachments, entityId, entityType, workspaceId, scheduledAt, tags, trackLinks, campaignId, campaignVariantId } = input;

  try {
    // 1. Fetch Template
    const templateSnap = await adminDb.collection('message_templates').doc(templateId).get();
    if (!templateSnap.exists) throw new Error(`Template not found: ${templateId}`);
    let template = { id: templateSnap.id, ...templateSnap.data() } as MessageTemplate;

    // 2. Resolve Organization (org-first; no cross-tenant fallback).
    // The org is resolved BEFORE the sender so the sender query can be scoped to it.
    const baseWorkspaceId = workspaceId || template.workspaceIds?.[0];
    let orgId = resolveOrgId(
        input.organizationId,
        template.organizationId,
        typeof variables.organizationId === 'string' ? variables.organizationId : undefined,
    );
    if (!orgId && baseWorkspaceId) {
        const wsSnap = await adminDb.collection('workspaces').doc(baseWorkspaceId).get();
        if (wsSnap.exists) orgId = (wsSnap.data()?.organizationId as string) || null;
    }
    if (!orgId) {
        return { success: false, error: 'Cannot send: no organization context could be resolved for this message.' };
    }

    // Template ownership: an org-scoped template may only be sent for its own org.
    if (template.scope === 'organization' && template.organizationId && template.organizationId !== orgId) {
        return { success: false, error: `Cannot send: template ${template.id} belongs to a different organization.` };
    }

    // 3. Resolve Sender Profile, scoped strictly to the org.
    let sender: SenderProfile;
    if (template.channel === 'whatsapp' || template.channel === 'in_app' || template.channel === 'push') {
        // These channels do not send from a `sender_profiles` row:
        //  - whatsapp uses the org's WABA (resolved inside sendWhatsApp)
        //  - in_app / push are platform-delivered
        // Synthesize a minimal org-owned sender so the flow + logging work.
        const synthName = template.channel === 'whatsapp' ? 'WhatsApp'
            : template.channel === 'push' ? 'Push Notification' : 'In-App Notification';
        sender = {
            id: template.channel, organizationId: orgId, name: synthName, identifier: template.channel,
            // in_app/push are not SenderProfile channels; the cast keeps the honest
            // runtime channel while satisfying the SenderProfile shape.
            channel: template.channel as unknown as SenderProfile['channel'],
            isDefault: true, isActive: true, workspaceIds: [],
            createdAt: '', updatedAt: '',
        } as SenderProfile;
    } else {
        // email / sms → must resolve an org-owned sender via explicit → workspace → org-default.
        const [orgSnap, wsDefaultSnap] = await Promise.all([
            adminDb.collection('organizations').doc(orgId).get(),
            baseWorkspaceId ? adminDb.collection('workspaces').doc(baseWorkspaceId).get() : Promise.resolve(null),
        ]);
        const orgDefaults = orgSnap.data()?.defaultSenderProfileIds as DefaultSenderProfileIds | undefined;
        const wsDefaults = (wsDefaultSnap && wsDefaultSnap.exists)
            ? wsDefaultSnap.data()?.defaultSenderProfileIds as DefaultSenderProfileIds | undefined
            : undefined;

        const resolution = await resolveSenderProfileId({
            orgId,
            channel: template.channel, // narrowed to 'email' | 'sms'
            explicitId: senderProfileId,
            workspaceDefaultId: wsDefaults?.[template.channel] ?? null,
            orgDefaultId: orgDefaults?.[template.channel] ?? null,
        });

        if (resolution.outcome !== 'resolved' || !resolution.senderProfileId) {
            await notifyMessagingFailure({
                orgId,
                channel: template.channel,
                templateId: template.id,
                recipient,
                outcome: resolution.outcome,
                workspaceId: baseWorkspaceId,
            });
            const reason = resolution.outcome === 'cross_org_explicit'
                ? `the selected sender belongs to a different organization`
                : `no ${template.channel.toUpperCase()} sender is configured for this organization`;
            return { success: false, error: `Cannot send ${template.channel}: ${reason}. Configure a default sender for this organization.` };
        }

        const senderSnap = await adminDb.collection('sender_profiles').doc(resolution.senderProfileId).get();
        if (!senderSnap.exists || !senderSnap.data()) {
            return { success: false, error: 'Cannot send: the resolved sender profile no longer exists.' };
        }
        sender = toSenderProfile(senderSnap.id, senderSnap.data()!);
    }

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
    let resolvedContact: any = null;

    if (entityId) {
        // Use adapter to resolve contact from either schools or entities + workspace_entities
        const contextWorkspaceId = resolvedWorkspaceId || workspaceIds[0] || 'onboarding';
        const contact = await resolveContact(entityId || '', contextWorkspaceId);
        resolvedContact = contact;
        
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
                const baseUrl = await getRequestBaseUrl();
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
                        const baseUrl = await getRequestBaseUrl();
                        const facVars = buildFacilitatorVariables(matchedFac, meeting, baseUrl);
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
                    const baseUrl = await getRequestBaseUrl();
                    
                    // Parse slugs from personalizedMeetingUrl
                    let typeSlug = 'meeting';
                    let meetingSlug = meetingId;
                    const rawPersonalizedUrl = rDocData.personalizedMeetingUrl || '';
                    const cleanPersonalizedUrl = cleanPersonalizedMeetingUrl(rawPersonalizedUrl);
                    if (cleanPersonalizedUrl) {
                        try {
                            const urlObj = new URL(cleanPersonalizedUrl);
                            const paths = urlObj.pathname.split('/').filter(Boolean);
                            if (paths.length >= 3) {
                                typeSlug = paths[1];
                                if (typeSlug === 'parent') {
                                    typeSlug = 'parent-engagement';
                                }
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
                        finalVariables.registrant_join_link = cleanPersonalizedUrl || `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/join?token=${token}`;
                    }
                    if (finalVariables.meeting_registrant_join_link === undefined) {
                        finalVariables.meeting_registrant_join_link = cleanPersonalizedUrl || `${baseUrl}/meetings/${typeSlug}/${meetingSlug}/join?token=${token}`;
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
            const baseUrl = await getRequestBaseUrl();
            let typeSlug = 'meeting';
            let meetingSlug = meetingId;
            try {
                const meetingSnap = await adminDb.collection('meetings').doc(meetingId).get();
                if (meetingSnap.exists) {
                    const mData = meetingSnap.data();
                    const rawSlug = mData?.type?.slug || mData?.type?.id || 'parent-engagement';
                    typeSlug = rawSlug === 'parent' ? 'parent-engagement' : rawSlug;
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

    // Inject Workspace Name & Organization Branding Variables concurrently
    // Authoritative tenant resolved in step 2 above (never empty here).
    let finalOrgId = orgId;
    try {
        const wsPromise = resolvedWorkspaceId ? adminDb.collection('workspaces').doc(resolvedWorkspaceId).get() : Promise.resolve(null);
        const wsSnap = await wsPromise;

        if (wsSnap && wsSnap.exists) {
            const wsData = wsSnap.data()!;
            if (finalVariables.workspace_name === undefined) {
                finalVariables.workspace_name = wsData.name || '';
            }
            if (!finalOrgId && wsData.organizationId) {
                finalOrgId = wsData.organizationId;
            }
        }

        if (finalOrgId) {
            const orgVars = await resolveOrgBrandingVars(finalOrgId);
            Object.entries(orgVars).forEach(([k, v]) => {
                if (finalVariables[k] === undefined) finalVariables[k] = v;
            });
        }
    } catch (e) {
        console.error('[MESSAGING_ENGINE] Failed resolving workspace/organization branding:', e);
    }
    // Ensure current_year is always available even without an org
    if (finalVariables.current_year === undefined) {
        finalVariables.current_year = new Date().getFullYear().toString();
    }

    // Phase 7: Inject Unsubscribe Link (Secure, tokenized preference link)
    const { generateSecureUnsubscribeLink } = await import('./services/unsubscribe-service');
    finalVariables.unsubscribe_link = await generateSecureUnsubscribeLink(recipient, resolvedEntityId, resolvedWorkspaceId);

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

    // 7a. Page Link Pre-pass — resolves {{page_link:slug}} tokens BEFORE resolveVariables()
    //     Must run first because the colon in the token is not handled by the generic {{}} replacer.
    //     The canonical URL is resolved from campaign_pages (or falls back to baseUrl+slug).
    //     Entity identity is NOT baked here — the /api/l/{id} redirect appends ?ref= for email.
    {
        const { extractPageLinkSlugs, resolvePageLinkTokens, buildPageLinkMap } = await import('./page-link-resolver');
        const bodyToScan = input.body ?? template.body ?? '';
        const slugs = extractPageLinkSlugs(bodyToScan);
        if (slugs.length > 0) {
            const pageLinks = await buildPageLinkMap(slugs, adminDb);
            if (input.body !== undefined) {
                (input as { body: string }).body = resolvePageLinkTokens(input.body, pageLinks);
            }
            if (template.body) {
                template = { ...template, body: resolvePageLinkTokens(template.body, pageLinks) };
            }
        }
    }

    // 7. Render Content (contentMode-aware routing)
    // - 'rich_builder': Render blocks array into HTML with optional style wrapper
    // - 'plain_text' / 'html_code': Resolve variables in body, apply style wrapper if present
    // Fallback: if contentMode is missing (legacy), use blocks?.length heuristic
    let resolvedBody = '';
    if (input.body !== undefined) {
        resolvedBody = resolveVariables(input.body, finalVariables);
    } else {
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
            taskId,
            entityId: entityId || undefined,
            channel: (['email', 'sms', 'whatsapp'].includes(template.channel) ? template.channel : 'direct') as 'email' | 'sms' | 'whatsapp' | 'direct'
        });
    }

    // Phase 8: Org Footer Injection (email channel only)
    // org_footer_html and org_footer_enabled are already in finalVariables from
    // resolveOrgBrandingVars() — no additional Firestore read needed here.
    if (template.channel === 'email') {
        const { resolveOrgFooter, htmlContainsFooter, buildOrgFooterVars } =
            await import('./services/org-footer-service');
        const footerEnabled = finalVariables.org_footer_enabled !== 'false';
        const renderedFooter = resolveOrgFooter(
            finalVariables.org_footer_html || undefined,
            footerEnabled,
            buildOrgFooterVars(finalVariables as Record<string, string>),
        );
        if (renderedFooter) {
            if (styleWrapper.includes('{{org_footer}}')) {
                // Style wrapper has an explicit footer slot — replace the token
                resolvedBody = resolvedBody.replace('{{org_footer}}', renderedFooter);
            } else if (!htmlContainsFooter(resolvedBody)) {
                // No footer detected — auto-append after body content
                resolvedBody = resolvedBody + renderedFooter;
            }
        }
    }


    let resolvedSubject = input.subject !== undefined
        ? resolveVariables(input.subject, finalVariables)
        : (template.channel === 'email' ? resolveVariables(template.subject || '', finalVariables) : null);
    let resolvedPreviewText = template.channel === 'email' ? resolveVariables(template.previewText || '', finalVariables) : null;
    let resolvedLogTitle = resolveVariables(template.name, finalVariables);

    // Phase 7: Suppression Check (Unsubscribe compliance)
    const isTx = input.messageType === 'transactional' || 
                 (input.messageType !== 'marketing' && 
                  ['forms', 'meetings', 'agreements', 'reminders', 'tasks', 'users'].includes(template.category));

    if (!isTx) {
      // 1. Check contact-level granular preference opt-outs
      if (resolvedContact) {
        const matchingContact = getRecipientContact(resolvedContact, recipient);
        if (matchingContact) {
          // Check category-specific opt-out
          if (matchingContact.unsubscribedCategories?.includes(template.category)) {
            console.warn(`>>> [MSG-ENGINE] Recipient ${recipient} has opted out of category ${template.category}`);
            return { success: false, error: 'Recipient unsubscribed from this category' };
          }
          // Check opt-down frequency (marketing emails are blocked if they opted-down to digests)
          if (matchingContact.emailStatus === 'opt-down') {
            console.warn(`>>> [MSG-ENGINE] Recipient ${recipient} has opted down and is suppressed for standard promotions.`);
            return { success: false, error: 'Recipient opted down' };
          }
        }
      }

      // 2. Check global suppressions (handles unsubscribed, bounced, complained, and active snoozes).
      // Only contact channels (email/sms/whatsapp) have a suppression key.
      const suppressionKey = CHANNEL_REGISTRY[template.channel]?.suppressionKey;
      if (suppressionKey) {
        const { isSuppressed } = await import('./suppression-service');
        const suppressed = await isSuppressed({
            recipient,
            workspaceId: resolvedWorkspaceId,
            channel: suppressionKey,
        });

        if (suppressed) {
            console.warn(`>>> [MSG-ENGINE] Recipient ${recipient} is suppressed for ${template.channel} in workspace ${resolvedWorkspaceId}`);
            return { success: false, error: 'Recipient unsubscribed' };
        }
      }
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

    // Phase 8 (phone): SMS Hygiene Guard. Deliberately conservative — only
    // strictly `invalid` numbers are blocked. `format_valid` is never blocked
    // because libphonenumber line-type/range metadata lags for some countries.
    if (template.channel === 'sms') {
        const { PhoneHygieneRepository } = await import('./phone-hygiene-repository');
        const hygiene = await PhoneHygieneRepository.getCache(recipient);

        if (hygiene && hygiene.status === 'invalid') {
            console.warn(`>>> [MSG-ENGINE] SMS Delivery Guard aborted dispatch to ${recipient}: Status=${hygiene.status}, Score=${hygiene.score}`);
            return {
                success: false,
                error: `Recipient number is marked as ${hygiene.status} (Hygiene Score: ${hygiene.score}). Delivery blocked to protect sender reputation.`
            };
        }
    }

    // 7.8 Intercept Scheduling if scheduledAt is provided
    if (scheduledAt) {
        const scheduledMsgData = {
            organizationId: finalOrgId || template.organizationId || 'default',
            workspaceId: resolvedWorkspaceId,
            templateId: template.id,
            channel: template.channel,
            recipientContact: recipient,
            recipientEntityId: resolvedEntityId || null,
            variables: JSON.parse(JSON.stringify(finalVariables)),
            scheduledAt,
            status: 'pending' as const,
            reminderType: variables._reminderType || 'composer',
            sourceEventId: variables._sourceEventId || variables.campaignId || 'manual',
            sourceEventType: variables._sourceEventType || 'composer',
            retryCount: 0,
            createdAt: new Date().toISOString(),
            customSubject: resolvedSubject,
            customBody: resolvedBody,
            senderProfileId: sender.id || null,
            senderName: sender.name || null,
            senderIdentifier: sender.identifier || null,
        };

        const scheduledRef = await adminDb.collection('scheduled_messages').add(scheduledMsgData);
        
        await logActivity({
            entityId: resolvedEntityId || null,
            entityType: resolvedEntityType || null,
            organizationId: finalOrgId || 'default',
            userId: null, 
            workspaceId: resolvedWorkspaceId || 'onboarding',
            type: 'notification_scheduled',
            source: 'system',
            description: `Scheduled ${template.channel} "${resolvedLogTitle}" to ${recipient} for ${scheduledAt}`,
            metadata: { scheduledMessageId: scheduledRef.id, channel: template.channel }
        });

        return { success: true, logId: scheduledRef.id };
    }

    // 8. Gateway Delivery & Custom Key Resolution (org-scoped, shared helper)
    const { mnotifyKey, resendKey, resendDomain } = await resolveOrgProviderKeys(finalOrgId);

    let providerId = null;
    let providerStatus = null;

    if (template.channel === 'sms') {
        try {
            const providerResponse = await sendSms({
                recipient,
                message: resolvedBody,
                sender: sender.identifier,
                scheduleDate: scheduledAt ? new Date(scheduledAt) : undefined,
                apiKey: mnotifyKey
            });
            providerId = providerResponse?.summary?._id;
            providerStatus = providerResponse?.status;
            recordSmsReachability(recipient, true);
        } catch (smsErr) {
            recordSmsReachability(recipient, false);
            throw smsErr;
        }
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
    } else if (template.channel === 'whatsapp') {
        // Focused WhatsApp branch (spec Phase 3): delegate to the orchestration,
        // which resolves the org connection, re-checks the 24h session window at
        // send time, enforces approved-template / session rules, and returns the
        // Meta message id for status reconciliation.
        const { sendWhatsApp } = await import('./whatsapp/whatsapp-send');
        const waOrgId = orgId;
        const waResult = await sendWhatsApp({
            organizationId: waOrgId,
            recipient,
            template,
            resolvedBody,
            variables: finalVariables,
        });
        providerId = waResult.metaMessageId;
        providerStatus = waResult.status;
    } else {
        let headers: Record<string, string> | undefined = undefined;
        if (template.channel === 'email') {
            const { generateUnsubscribeToken } = await import('./services/unsubscribe-service');
            const { getRequestBaseUrl } = await import('./utils/url-helpers');
            const baseUrl = await getRequestBaseUrl();
            const cleanEmail = recipient.toLowerCase().trim();
            const token = generateUnsubscribeToken(cleanEmail);
            const oneClickUrl = `${baseUrl}/api/messaging/unsubscribe/one-click?recipient=${encodeURIComponent(cleanEmail)}&token=${token}&ws=${resolvedWorkspaceId || 'global'}`;
            const preferenceUrl = finalVariables.unsubscribe_link;

            headers = {
                'List-Unsubscribe': `<${oneClickUrl}>, <${preferenceUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            };
        }

        const providerResponse = await sendEmail({
            from: sender.name && sender.identifier ? `${sender.name} <${sender.identifier}>` : undefined, 
            to: recipient,
            subject: resolvedSubject || 'SmartSapp Notification',
            html: resolvedBody,
            attachments: attachments,
            scheduledAt: scheduledAt,
            tags: tags,
            apiKey: resendKey,
            domain: resendDomain,
            headers
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
      previewText: input.previewText || resolvedPreviewText || null,
      body: resolvedBody,
      status: scheduledAt ? 'scheduled' : 'sent',
      sentAt: scheduledAt || new Date().toISOString(),
      variables: JSON.parse(JSON.stringify(finalVariables)),
      workspaceIds: workspaceIds, // Bind to institutional track(s)
      ...(resolvedWorkspaceId ? { workspaceId: resolvedWorkspaceId } : {}),
      entityId: resolvedEntityId || null, // New unified entity reference
      ...(resolvedEntityType ? { entityType: resolvedEntityType as EntityType } : {}),
      providerId: providerId || null,
      providerStatus: providerStatus !== null && providerStatus !== undefined ? String(providerStatus) : null,
      hasAttachments: !!(attachments && attachments.length > 0),
      attachmentCount: attachments?.length || 0,
      ...(campaignId ? { campaignId } : {}),
      ...(campaignVariantId ? { campaignVariantId } : {}),
      ...(input.automationId ? { automationId: input.automationId } : {}),
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.nodeId ? { nodeId: input.nodeId } : {}),
      ...(input.isResend ? { isResend: true } : {}),
      ...(input.resendOfLogId ? { resendOfLogId: input.resendOfLogId } : {}),
      ...(typeof input.resendNumber === 'number' ? { resendNumber: input.resendNumber } : {}),
      ...(template.channel === 'whatsapp' ? {
        direction: 'outbound' as const,
        ...(providerId ? { metaMessageId: providerId } : {}),
        ...(template.whatsappTemplateName ? { whatsappTemplateName: template.whatsappTemplateName } : {}),
      } : {}),
    };

    const logRef = await adminDb.collection('message_logs').add(logData);

    // Per-node delivery stats (automation messaging) — best-effort, never blocks the send.
    const statAutomationId = input.automationId;
    const statNodeId = input.nodeId;
    if (statAutomationId && statNodeId && !scheduledAt) {
      const statChannel = sender.channel;
      const statOrgId = sender.organizationId;
      const statWorkspaceId = resolvedWorkspaceId || workspaceIds?.[0] || '';
      const statCounter = input.isResend ? 'resent' as const : 'sent' as const;
      import('./messaging/message-node-stats')
        .then(({ incrementMessageNodeStat }) => incrementMessageNodeStat({
          automationId: statAutomationId,
          nodeId: statNodeId,
          workspaceId: statWorkspaceId,
          organizationId: statOrgId,
          channel: statChannel,
          counter: statCounter,
          touchLastMessageAt: true,
        }))
        .catch((err) => console.warn('[MSG-ENGINE] node stat increment failed (non-fatal):', err?.message));
    }

    await logActivity({
        entityId: resolvedEntityId || null,
        entityType: resolvedEntityType || null,
        organizationId: 'default',
        userId: null, 
        workspaceId: resolvedWorkspaceId || 'onboarding',
        type: 'notification_sent',
        source: 'system',
        description: `${scheduledAt ? 'Scheduled' : 'Sent'} ${template.channel} "${resolvedLogTitle}" to ${recipient}`,
        metadata: { logId: logRef.id, channel: template.channel, providerId, isRetry: !!finalVariables.isRetry || finalVariables.isRetry === 'true' }
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
    organizationId?: string,
    variables?: Record<string, unknown>,
    workspaceIds?: string[],
    messageType?: 'transactional' | 'marketing',
    entityId?: string,
    entityType?: string,
    isAutomation?: boolean,
    // Automation correlation — enables per-node delivery stats.
    automationId?: string,
    runId?: string,
    nodeId?: string,
    isResend?: boolean
}) {
    const { channel, recipient, body, subject, senderProfileId, variables = {}, workspaceIds = ['onboarding'], messageType = 'marketing', entityId, entityType, isAutomation = false, automationId, runId, nodeId, isResend = false } = input;

    try {
        // Resolve the tenant FIRST (no cross-tenant fallback), then the sender.
        const baseWorkspaceId = workspaceIds?.[0];
        let finalOrgId = resolveOrgId(
            input.organizationId,
            typeof variables.organizationId === 'string' ? variables.organizationId : undefined,
            undefined,
        );
        if (!finalOrgId && baseWorkspaceId) {
            const wsSnap = await adminDb.collection('workspaces').doc(baseWorkspaceId).get();
            if (wsSnap.exists) finalOrgId = (wsSnap.data()?.organizationId as string) || null;
        }
        if (!finalOrgId) {
            return { success: false, error: 'Cannot send: no organization context could be resolved for this message.' };
        }

        let sender: SenderProfile;
        if (channel === 'in_app' || channel === 'push') {
            // Platform-delivered channels do not use a sender_profiles row.
            const synthName = channel === 'push' ? 'Push Notification' : 'In-App Notification';
            sender = {
                id: channel, organizationId: finalOrgId, name: synthName, identifier: channel,
                // in_app/push are not SenderProfile channels; cast preserves the honest channel.
                channel: channel as unknown as SenderProfile['channel'],
                isDefault: true, isActive: true, workspaceIds: [],
                createdAt: '', updatedAt: '',
            } as SenderProfile;
        } else {
            // email / sms → resolve an org-owned sender via explicit → workspace → org-default.
            const [orgSnap, wsDefaultSnap] = await Promise.all([
                adminDb.collection('organizations').doc(finalOrgId).get(),
                baseWorkspaceId ? adminDb.collection('workspaces').doc(baseWorkspaceId).get() : Promise.resolve(null),
            ]);
            const orgDefaults = orgSnap.data()?.defaultSenderProfileIds as DefaultSenderProfileIds | undefined;
            const wsDefaults = (wsDefaultSnap && wsDefaultSnap.exists)
                ? wsDefaultSnap.data()?.defaultSenderProfileIds as DefaultSenderProfileIds | undefined
                : undefined;

            const resolution = await resolveSenderProfileId({
                orgId: finalOrgId,
                channel,
                explicitId: senderProfileId,
                workspaceDefaultId: wsDefaults?.[channel] ?? null,
                orgDefaultId: orgDefaults?.[channel] ?? null,
            });

            if (resolution.outcome !== 'resolved' || !resolution.senderProfileId) {
                await notifyMessagingFailure({
                    orgId: finalOrgId,
                    channel,
                    templateId: 'raw-direct-dispatch',
                    recipient,
                    outcome: resolution.outcome,
                    workspaceId: baseWorkspaceId,
                });
                const reason = resolution.outcome === 'cross_org_explicit'
                    ? 'the selected sender belongs to a different organization'
                    : `no ${channel.toUpperCase()} sender is configured for this organization`;
                return { success: false, error: `Cannot send ${channel}: ${reason}. Configure a default sender for this organization.` };
            }

            const senderSnap = await adminDb.collection('sender_profiles').doc(resolution.senderProfileId).get();
            if (!senderSnap.exists || !senderSnap.data()) {
                return { success: false, error: 'Cannot send: the resolved sender profile no longer exists.' };
            }
            sender = toSenderProfile(senderSnap.id, senderSnap.data()!);
        }

        let resolvedBody = resolveVariables(body, variables);
        const resolvedSubject = subject ? resolveVariables(subject, variables) : 'Institutional Alert — SmartSapp';

        // Phase 7: Suppression Check (Unsubscribe compliance)
        const isTx = messageType === 'transactional';
        if (!isTx && (channel === 'email' || channel === 'sms')) {
            const { isSuppressed } = await import('./suppression-service');
            const suppressed = await isSuppressed({
                recipient,
                workspaceId: workspaceIds[0] || 'onboarding',
                channel: channel as 'email' | 'sms'
            });

            if (suppressed) {
                console.warn(`>>> [MSG-ENGINE] Recipient ${recipient} is suppressed for RAW ${channel} in workspace ${workspaceIds[0]}`);
                return { success: false, error: 'Recipient unsubscribed' };
            }
        }

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

        // Resolve Custom Credentials for Raw Send (finalOrgId resolved above; org-scoped helper).
        const { mnotifyKey, resendKey, resendDomain } = await resolveOrgProviderKeys(finalOrgId);

        // Dispatch Delivery
        let providerId = null;
        if (channel === 'sms') {
            await sendSms({ recipient, message: resolvedBody, sender: sender.identifier, apiKey: mnotifyKey });
        } else if (channel === 'push') {
            await sendPushNotification([recipient], resolvedSubject, resolvedBody);
        } else if (channel === 'in_app') {
            await adminDb.collection('in_app_notifications').add({
                userId: recipient,
                organizationId: finalOrgId || 'default',
                workspaceId: workspaceIds[0],
                title: resolvedSubject,
                body: resolvedBody,
                category: 'general',
                isRead: false,
                createdAt: new Date().toISOString()
            });
        } else {
            let headers: Record<string, string> | undefined = undefined;
            if (channel === 'email') {
                const { generateUnsubscribeToken, generateSecureUnsubscribeLink } = await import('./services/unsubscribe-service');
                const { getRequestBaseUrl } = await import('./utils/url-helpers');
                const baseUrl = await getRequestBaseUrl();
                const cleanEmail = recipient.toLowerCase().trim();
                const token = generateUnsubscribeToken(cleanEmail);
                const preferenceUrl = await generateSecureUnsubscribeLink(recipient, entityId || null, workspaceIds[0] || null);
                const oneClickUrl = `${baseUrl}/api/messaging/unsubscribe/one-click?recipient=${encodeURIComponent(cleanEmail)}&token=${token}&ws=${workspaceIds[0] || 'global'}`;

                headers = {
                    'List-Unsubscribe': `<${oneClickUrl}>, <${preferenceUrl}>`,
                    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
                };

                // Org Footer Injection for raw/direct emails
                // Branding vars (including org_footer_html) come from resolveOrgBrandingVars
                const orgBrandingVars = await import('./messaging-branding').then(m => m.resolveOrgBrandingVars(finalOrgId));
                const { resolveOrgFooter, htmlContainsFooter, buildOrgFooterVars } =
                    await import('./services/org-footer-service');
                const footerVars = {
                    ...buildOrgFooterVars(orgBrandingVars),
                    unsubscribe_link: preferenceUrl,
                };
                const rawFooterEnabled = orgBrandingVars.org_footer_enabled !== 'false';
                const renderedFooter = resolveOrgFooter(
                    orgBrandingVars.org_footer_html || undefined,
                    rawFooterEnabled,
                    footerVars,
                );
                if (renderedFooter && !htmlContainsFooter(resolvedBody)) {
                    resolvedBody = resolvedBody + renderedFooter;
                }
            }

            await sendEmail({ 
                from: `${sender.name} <${sender.identifier}>`, 
                to: recipient, 
                subject: resolvedSubject, 
                html: resolvedBody,
                apiKey: resendKey,
                domain: resendDomain,
                headers
            });
        }


        // Save dispatch to message_logs
        const logData = {
            title: `Direct ${channel.toUpperCase()}: ${resolvedSubject || 'Alert'}`,
            templateId: 'raw-direct-dispatch',
            templateName: 'Direct Raw Message',
            senderProfileId: sender.id,
            senderName: sender.name || 'System',
            channel,
            recipient,
            subject: resolvedSubject || null,
            body: resolvedBody,
            status: 'sent',
            sentAt: new Date().toISOString(),
            variables: JSON.parse(JSON.stringify(variables)),
            workspaceIds,
            workspaceId: workspaceIds[0] || 'onboarding',
            entityId: entityId || null,
            entityType: entityType || null,
            providerId: null,
            providerStatus: 'delivered',
            hasAttachments: false,
            attachmentCount: 0,
            ...(automationId ? { automationId } : {}),
            ...(runId ? { runId } : {}),
            ...(nodeId ? { nodeId } : {}),
            ...(isResend ? { isResend: true } : {}),
        };
        const logRef = await adminDb.collection('message_logs').add(logData);

        // Per-node delivery stats (automation messaging) — best-effort, never blocks the send.
        // Only email/sms/whatsapp carry provider delivery semantics; in_app/push are excluded.
        if (automationId && nodeId && (channel === 'email' || channel === 'sms')) {
          const directStatChannel = channel;
          import('./messaging/message-node-stats')
            .then(({ incrementMessageNodeStat }) => incrementMessageNodeStat({
              automationId,
              nodeId,
              workspaceId: workspaceIds[0] || '',
              organizationId: finalOrgId || undefined,
              channel: directStatChannel,
              counter: isResend ? 'resent' : 'sent',
              touchLastMessageAt: true,
            }))
            .catch((err) => console.warn('[MSG-ENGINE] node stat increment failed (non-fatal):', err?.message));
        }

        // Trigger activity timeline event (with isAutomation: true to prevent loop)
        const { logActivity } = await import('./activity-logger');
        await logActivity({
            entityId: entityId || null,
            entityType: (entityType as EntityType) || null, // Firebase expects EntityType | null
            organizationId: (variables.organizationId as string) || 'default',
            userId: null,
            workspaceId: workspaceIds[0] || 'onboarding',
            type: 'notification_sent',
            source: 'system',
            description: `Sent Direct ${channel.toUpperCase()} message to ${recipient}`,
            metadata: {
                logId: logRef.id,
                channel,
                isAutomation: isAutomation || true
            }
        });

        return { success: true, logId: logRef.id };
    } catch (error: any) {
        console.error(">>> [MESSAGING] Raw Dispatch Error:", error.message);
        return { success: false, error: error.message };
    }
}
