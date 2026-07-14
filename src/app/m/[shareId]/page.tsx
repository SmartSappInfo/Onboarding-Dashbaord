import type { Metadata, ResolvingMetadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { getOrgBranding } from '@/lib/org-branding';
import { resolveSeoMetadata, normalizeParentImages } from '@/lib/seo';
import MediaShareClient from './MediaShareClient';
import type { MediaAsset, EntityContact } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ShareConfig {
    id: string;
    assetId: string;
    workspaceId: string;
    title: string;
    description: string;
    ctaText: string;
    ctaType: 'none' | 'survey' | 'form' | 'page' | 'external';
    ctaTargetId: string;
    ctaTargetUrl: string;
    ctaMode?: 'modal' | 'redirect' | 'replace';
    ctaPretext?: string;
    ctaPopoverEnabled?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

// React cache to de-duplicate fetch operations
const getShareConfig = cache(async function getShareConfig(shareId: string): Promise<ShareConfig | null> {
    try {
        const snap = await adminDb.collection('media_shares').doc(shareId).get();
        if (snap.exists) {
            return { id: snap.id, ...snap.data() } as ShareConfig;
        }
        return null;
    } catch {
        return null;
    }
});

const getMediaAsset = cache(async function getMediaAsset(assetId: string): Promise<MediaAsset | null> {
    try {
        const snap = await adminDb.collection('media').doc(assetId).get();
        if (snap.exists) {
            return { id: snap.id, ...snap.data() } as MediaAsset;
        }
        return null;
    } catch {
        return null;
    }
});

interface PersonalizedParams {
    config: ShareConfig;
    asset: MediaAsset;
    orgBranding: any;
    resolvedTitle: string;
    resolvedDescription: string;
    resolvedCtaPretext: string;
}

const getPersonalizedParams = cache(async (
    shareId: string,
    rawSearchParams: Record<string, string>
): Promise<PersonalizedParams | null> => {
    const config = await getShareConfig(shareId);
    if (!config) return null;

    const asset = await getMediaAsset(config.assetId);
    if (!asset) return null;

    // Resolve workspace details & organization branding
    let orgBranding = null;
    try {
        const wsSnap = await adminDb.collection('workspaces').doc(config.workspaceId).get();
        if (wsSnap.exists) {
            const wsData = wsSnap.data();
            if (wsData?.organizationId) {
                orgBranding = await getOrgBranding(wsData.organizationId);
            }
        }
    } catch (err) {
        console.warn('[PublicMediaShareRoute] Failed to load branding:', err);
    }

    // Resolve personalization variables
    let resolvedTitle = config.title || asset.name;
    let resolvedDescription = config.description || '';
    let resolvedCtaPretext = config.ctaPretext || '';

    try {
        const { FieldsVariablesService } = await import('@/lib/services/fields-variables-service-impl');
        
        const paramsRecord: Record<string, string> = { ...rawSearchParams };

        // 1. Resolve encrypted recipient ref parameters
        const ref = rawSearchParams.ref;
        const isEncrypted = ref ? ref.split(':').length === 3 : false;
        
        let resolvedContactId = '';
        let resolvedRecipientContact = '';

        if (ref && isEncrypted) {
            try {
                const { decryptToken } = await import('@/lib/crypto');
                const decrypted = decryptToken(ref);
                if (decrypted) {
                    const [contactId, entityId] = decrypted.split(':');
                    resolvedContactId = contactId;
                    
                    if (entityId) {
                        const weSnap = await adminDb.collection('workspace_entities')
                            .where('workspaceId', '==', config.workspaceId)
                            .where('entityId', '==', entityId)
                            .limit(1)
                            .get();
                        if (!weSnap.empty) {
                            const contacts = (weSnap.docs[0].data().entityContacts || []) as EntityContact[];
                            const found = contacts.find(c => c.id === contactId);
                            if (found) {
                                resolvedRecipientContact = found.email || '';
                            }
                        }
                    } else {
                        const contactSnap = await adminDb.collection('contacts').doc(contactId).get();
                        if (contactSnap.exists) {
                            const data = contactSnap.data() || {};
                            resolvedRecipientContact = String(data.email || '');
                        }
                    }
                }
            } catch (err) {
                console.warn('[PublicMediaShareRoute] Direct token decryption error:', err);
            }
        }

        // Fallback or explicit parameters mapping
        if (ref && !isEncrypted) {
            paramsRecord.entityId = ref;
        }
        if (resolvedContactId) {
            paramsRecord.contactId = resolvedContactId;
        }
        if (resolvedRecipientContact) {
            paramsRecord.email = resolvedRecipientContact;
        }

        const entityCtx = await FieldsVariablesService.resolveEntityContextFromParams(
            [config.workspaceId],
            paramsRecord
        );

        const context = {
            workspaceId: config.workspaceId,
            entityId: entityCtx.entityId || undefined,
            recipientContact: entityCtx.recipientContact || undefined,
        };

        resolvedTitle = await FieldsVariablesService.resolveTemplateVariables(resolvedTitle, context);
        resolvedDescription = await FieldsVariablesService.resolveTemplateVariables(resolvedDescription, context);
        resolvedCtaPretext = await FieldsVariablesService.resolveTemplateVariables(resolvedCtaPretext, context);
    } catch (err) {
        console.warn('[PublicMediaShareRoute] Failed to compile variables:', err);
    }

    return {
        config,
        asset,
        orgBranding,
        resolvedTitle,
        resolvedDescription,
        resolvedCtaPretext
    };
});

export async function generateMetadata(
    { params, searchParams }: {
        params: Promise<{ shareId: string }>;
        searchParams: Promise<Record<string, string | string[] | undefined>>;
    },
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { shareId } = await params;
    const rawSearchParams = await searchParams;
    
    const searchParamsRecord: Record<string, string> = {};
    Object.entries(rawSearchParams).forEach(([k, v]) => {
        if (typeof v === 'string') {
            searchParamsRecord[k] = v;
        } else if (Array.isArray(v) && v.length > 0) {
            searchParamsRecord[k] = v[0];
        }
    });

    const resolvedParams = await getPersonalizedParams(shareId, searchParamsRecord);
    if (!resolvedParams) {
        return { title: 'Media Not Found', robots: { index: false, follow: false } };
    }

    const { resolvedTitle, resolvedDescription, asset, orgBranding } = resolvedParams;

    const base = resolveSeoMetadata({
        seo: {
            title: resolvedTitle,
            description: resolvedDescription || 'Shared media asset',
            ogImageUrl: asset.type === 'image' ? asset.url : undefined
        },
        fallback: {
            title: resolvedTitle,
            assetImageUrl: asset.type === 'image' ? asset.url : undefined,
        },
        org: orgBranding || undefined,
        parentImages: normalizeParentImages((await parent).openGraph?.images),
        path: `/m/${shareId}`,
    });

    return {
        ...base,
        other: {
            'preconnect-fonts': 'https://fonts.googleapis.com',
            'preconnect-gstatic': 'https://fonts.gstatic.com',
        },
    };
}

export default async function PublicMediaShareRoute({
    params,
    searchParams,
}: {
    params: Promise<{ shareId: string }>;
    searchParams: Promise<Record<string, string>>;
}) {
    const { shareId } = await params;
    const resolvedSearchParams = await searchParams;

    const resolvedParams = await getPersonalizedParams(shareId, resolvedSearchParams);
    if (!resolvedParams) {
        notFound();
    }

    const { config, asset, orgBranding, resolvedTitle, resolvedDescription, resolvedCtaPretext } = resolvedParams;
    const isEmbed = resolvedSearchParams.embed === 'true';

    return (
        <MediaShareClient
            asset={asset}
            title={resolvedTitle}
            description={resolvedDescription}
            ctaText={config.ctaText}
            ctaTargetUrl={config.ctaTargetUrl}
            ctaType={config.ctaType}
            ctaMode={config.ctaMode || 'redirect'}
            ctaPretext={resolvedCtaPretext}
            ctaPopoverEnabled={config.ctaPopoverEnabled || false}
            orgBranding={orgBranding}
            isEmbed={isEmbed}
            searchParams={resolvedSearchParams}
        />
    );
}
