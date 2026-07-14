import type { Metadata, ResolvingMetadata } from 'next';
import { cache } from 'react';
import type { Survey, EntityContact } from '@/lib/types';
import SurveyDisplay from './components/survey-display';
import SurveyUnavailable from '../components/survey-unavailable';
import { notFound } from 'next/navigation';

import { adminDb } from '@/lib/firebase-admin';
import { getOrgBranding } from '@/lib/org-branding';
import { resolveSeoMetadata, mapLegacySurveySeo, normalizeParentImages } from '@/lib/seo';

import { cn, stripHtml, safeDecodeURI } from '@/lib/utils';


export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Wrapped in React.cache so generateMetadata and the page body share a single
// per-request fetch instead of querying Firestore twice.
const getSurveyBySlug = cache(async function getSurveyBySlug(slug: string): Promise<Survey | null> {
    const trimmedSlug = safeDecodeURI(slug).trim();
    console.log(`[PublicSurveyPage] Fetching survey for slug: "${trimmedSlug}"`);
    
    try {
        const surveysRef = adminDb.collection('surveys');
        
        // 1. Try querying by slug field
        const querySnapshot = await surveysRef.where('slug', '==', trimmedSlug).limit(1).get();

        if (!querySnapshot.empty) {
            const surveyDoc = querySnapshot.docs[0];
            const data = surveyDoc.data();
            console.log(`[PublicSurveyPage] Found survey by slug field. ID: ${surveyDoc.id}, Status: ${data?.status}`);
            return { ...data, id: surveyDoc.id } as Survey;
        }

        // 2. Fallback: Try fetching directly by document ID
        console.log(`[PublicSurveyPage] No match for slug field. Trying fallback to document ID: "${trimmedSlug}"`);
        const docSnap = await surveysRef.doc(trimmedSlug).get();

        if (docSnap.exists) {
            const data = docSnap.data();
            console.log(`[PublicSurveyPage] Found survey by document ID fallback. ID: ${docSnap.id}, Status: ${data?.status}`);
            return { ...data, id: docSnap.id } as Survey;
        }
        
        console.warn(`[PublicSurveyPage] Survey NOT FOUND for slug/id: "${trimmedSlug}"`);
        return null;
    } catch (error) {
        console.error(`[PublicSurveyPage] Error fetching survey for "${trimmedSlug}":`, error);
        return null;
    }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }, parent: ResolvingMetadata): Promise<Metadata> {
  const { slug } = await params;
  const survey = await getSurveyBySlug(slug);

  if (!survey || survey.status !== 'published') {
    // Bare title — the root layout template appends "— SmartSapp" (avoids the
    // historical "… | SmartSapp — SmartSapp" double-branding).
    return { title: 'Survey Unavailable', robots: { index: false, follow: false } };
  }

  // Prefer the canonical nested `seo` object; fall back to legacy flat fields
  // until the migration backfills (Phase 3). Survey semantics: `entity_logo`
  // mode uses the survey's own logoUrl, so it is passed as the org logo.
  const seo = survey.seo ?? mapLegacySurveySeo(survey);

  // Fetch full organization branding context using survey metadata
  let orgId = survey.organizationId;
  if (!orgId && survey.workspaceIds?.length) {
    const wsSnap = await adminDb.collection('workspaces').doc(survey.workspaceIds[0]).get();
    if (wsSnap.exists) {
      orgId = wsSnap.data()?.organizationId;
    }
  }
  const org = orgId ? await getOrgBranding(orgId) : null;

  return resolveSeoMetadata({
    seo,
    fallback: {
      title: survey.title,
      description: survey.description,
      assetImageUrl: survey.bannerImageUrl,
    },
    org: org || { logoUrl: survey.logoUrl },
    parentImages: normalizeParentImages((await parent).openGraph?.images),
    path: `/surveys/${slug}`,
  });
}


export default async function PublicSurveyPage({ 
    params,
    searchParams 
}: { 
    params: Promise<{ slug: string }>,
    searchParams: Promise<Record<string, string | undefined>>
}) {
    const { slug } = await params;
    const resolvedSearchParams = await searchParams;
    const { sourcePageId, ref, preview, workspaceId, ws, embed, ch } = resolvedSearchParams;
    const survey = await getSurveyBySlug(slug);

    if (!survey) {
        return <SurveyUnavailable status="not_found" />;
    }

    const channelRaw = (ch || (ref ? 'email' : 'direct')).toLowerCase();
    const channel = (['email', 'sms', 'whatsapp', 'direct'] as const).includes(
        channelRaw as any
    ) ? channelRaw as 'email' | 'sms' | 'whatsapp' | 'direct' : 'direct';

    let resolvedWorkspaceId = survey.workspaceIds?.[0] || '';
    const incomingWs = workspaceId || ws;
    if (incomingWs && survey.workspaceIds?.includes(incomingWs)) {
        resolvedWorkspaceId = incomingWs;
    }

    let preloadedVariables: Record<string, string> = {};
    let resolvedEntityId = survey.entityId || null;
    let resolvedRecipientContact: string | null = null;
    let resolvedContactId: string | null = null;

    const isEncrypted = ref ? ref.split(':').length === 3 : false;
    console.log('[PublicSurveyPage] Incoming ref:', ref, 'isEncrypted:', isEncrypted);

    if (ref && isEncrypted) {
        try {
            const { decryptToken } = await import('@/lib/crypto');
            const decrypted = decryptToken(ref);
            if (decrypted) {
                const [contactId, entityId] = decrypted.split(':');
                resolvedContactId = contactId;
                
                if (entityId && survey.workspaceIds && survey.workspaceIds.length > 0) {
                    const weSnap = await adminDb.collection('workspace_entities')
                        .where('workspaceId', 'in', survey.workspaceIds)
                        .where('entityId', '==', entityId)
                        .limit(1)
                        .get();
                    if (!weSnap.empty) {
                        const contacts = (weSnap.docs[0].data().entityContacts || []) as EntityContact[];
                        const found = contacts.find(c => c.id === contactId);
                        if (found) {
                            resolvedRecipientContact = found.email || null;
                        }
                    }
                } else {
                    const contactSnap = await adminDb.collection('contacts').doc(contactId).get();
                    if (contactSnap.exists) {
                        const data = contactSnap.data() || {};
                        resolvedRecipientContact = String(data.email || '') || null;
                    }
                }
            }
        } catch (err) {
            console.error('[PublicSurveyPage] Error executing direct token decryption:', err);
        }
    }

    if (survey.workspaceIds && survey.workspaceIds.length > 0) {
        try {
            const { FieldsVariablesService } = await import('@/lib/services/fields-variables-service-impl');
            const paramsRecord: Record<string, string> = {};
            Object.entries(resolvedSearchParams).forEach(([k, v]) => {
                if (v !== undefined) {
                    paramsRecord[k] = v;
                }
            });
            // Fallback: Only pass plain (unencrypted) ref values as direct entityIds
            if (ref && !isEncrypted) {
                paramsRecord.entityId = ref;
            }
            if (resolvedContactId) {
                paramsRecord.contactId = resolvedContactId;
            }
            if (resolvedRecipientContact) {
                paramsRecord.email = resolvedRecipientContact;
            }

            console.log('[PublicSurveyPage] Params compile for resolveEntityContextFromParams:', paramsRecord);
            const entityCtx = await FieldsVariablesService.resolveEntityContextFromParams(
                survey.workspaceIds,
                paramsRecord
            );
            console.log('[PublicSurveyPage] resolveEntityContextFromParams output:', entityCtx);

            if (entityCtx.entityId || entityCtx.recipientContact) {
                resolvedEntityId = entityCtx.entityId;
                resolvedRecipientContact = entityCtx.recipientContact;

                console.log('[PublicSurveyPage] Fetching preloaded variables for workspace:', resolvedWorkspaceId, 'entity:', resolvedEntityId, 'contact:', resolvedRecipientContact);
                const { getVariableValuesMapAction } = await import('@/lib/services/fields-variables-service');
                preloadedVariables = await getVariableValuesMapAction({
                    workspaceId: resolvedWorkspaceId,
                    entityId: entityCtx.entityId || undefined,
                    recipientContact: entityCtx.recipientContact || undefined,
                    surveyId: survey.id
                });
                console.log('[PublicSurveyPage] Preloaded variables loaded successfully:', preloadedVariables);
            } else {
                console.log('[PublicSurveyPage] No entity context resolved from params.');
            }
        } catch (err) {
            console.error('[PublicSurveyPage] Failed to resolve entity context or preload variables:', err);
        }
    }

    let organizationLogoUrl: string | null = null;
    let entityLogoUrl: string | null = null;
    let orgBranding = null;
    try {
        // Resolve organizationId: direct field → workspace lookup
        let orgId = survey.organizationId;
        if (!orgId && survey.workspaceIds?.length) {
            const wsSnap = await adminDb.collection('workspaces').doc(survey.workspaceIds[0]).get();
            if (wsSnap.exists) {
                orgId = wsSnap.data()?.organizationId;
            }
        }
        if (orgId) {
            orgBranding = await getOrgBranding(orgId);
            organizationLogoUrl = orgBranding.logoUrl || null;
        }
        if (survey.entityId) {
            const entitySnap = await adminDb.collection('entities').doc(survey.entityId).get();
            if (entitySnap.exists) {
                const entityData = entitySnap.data();
                entityLogoUrl = entityData?.institutionData?.logoUrl || entityData?.logoUrl || null;
            }
        }
    } catch (e) {
        console.error("Error fetching organization or entity logo:", e);
    }

    // Block non-published surveys unless in preview mode
    if (survey.status !== 'published' && preview !== 'true') {
        return (
            <SurveyUnavailable 
                status={survey.status as any || 'draft'} 
                survey={survey} 
                logoUrl={survey.logoUrl || entityLogoUrl || organizationLogoUrl} 
                orgBranding={orgBranding}
            />
        );
    }

    const primaryColor = orgBranding?.brandPrimaryColor || '#3B5FFF';
    const secondaryColor = orgBranding?.brandSecondaryColor || '#8B5CF6';
    const brandFont = orgBranding?.brandFontFamily || 'Inter';

    // Helper to convert hex to space-separated HSL channels (e.g. "221 83% 53%")
    const hexToHslChannels = (hexColor: string): string => {
        let cleanHex = hexColor.replace('#', '');
        if (cleanHex.length === 3) {
            cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
        }
        
        const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
        const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
        const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;
        
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        const hDeg = Math.round(h * 360);
        const sPct = Math.round(s * 100);
        const lPct = Math.round(l * 100);
        
        return `${hDeg} ${sPct}% ${lPct}%`;
    };

    // Helper to calculate text contrast (returns hex)
    const getContrastColor = (hexColor: string): string => {
        let cleanHex = hexColor.replace('#', '');
        if (cleanHex.length === 3) {
            cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
        }
        const r = parseInt(cleanHex.substring(0, 2), 16);
        const g = parseInt(cleanHex.substring(2, 4), 16);
        const b = parseInt(cleanHex.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 140) ? '#020617' : '#ffffff';
    };

    const primaryHsl = hexToHslChannels(primaryColor);
    const secondaryHsl = hexToHslChannels(secondaryColor);
    const primaryFgHsl = hexToHslChannels(getContrastColor(primaryColor));
    const secondaryFgHsl = hexToHslChannels(getContrastColor(secondaryColor));

    const isEmbedded = embed === 'true';

    const themeStyles = `
        :root {
            --primary: ${primaryHsl};
            --primary-foreground: ${primaryFgHsl};
            --secondary: ${secondaryHsl};
            --secondary-foreground: ${secondaryFgHsl};
            --radius: 1rem;
        }
        html, body {
            background-color: ${isEmbedded ? 'transparent !important' : 'var(--background)'};
        }
        body {
            font-family: ${brandFont}, sans-serif;
        }
    `;
    
    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: themeStyles }} />
            <SurveyDisplay 
                survey={survey} 
                sourcePageId={sourcePageId} 
                assignedUserId={ref} 
                organizationLogoUrl={organizationLogoUrl} 
                entityLogoUrl={entityLogoUrl} 
                orgBranding={orgBranding}
                resolvedWorkspaceId={resolvedWorkspaceId}
                preloadedVariables={preloadedVariables}
                resolvedEntityId={resolvedEntityId}
                resolvedRecipientContact={resolvedRecipientContact}
                respondentEntityId={resolvedEntityId}
                channel={channel}
            />
        </>
    );
}


