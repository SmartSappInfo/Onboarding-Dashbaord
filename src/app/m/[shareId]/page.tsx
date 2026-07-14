import type { Metadata, ResolvingMetadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { getOrgBranding } from '@/lib/org-branding';
import { resolveSeoMetadata, normalizeParentImages } from '@/lib/seo';
import MediaShareClient from './MediaShareClient';
import type { MediaAsset } from '@/lib/types';

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

export async function generateMetadata(
    { params }: { params: Promise<{ shareId: string }> },
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { shareId } = await params;
    const config = await getShareConfig(shareId);

    if (!config) {
        return { title: 'Media Not Found', robots: { index: false, follow: false } };
    }

    const asset = await getMediaAsset(config.assetId);
    if (!asset) {
        return { title: 'Media Asset Missing', robots: { index: false, follow: false } };
    }

    // Load workspace and organization branding
    let org = null;
    try {
        const wsSnap = await adminDb.collection('workspaces').doc(config.workspaceId).get();
        if (wsSnap.exists) {
            const wsData = wsSnap.data();
            if (wsData?.organizationId) {
                org = await getOrgBranding(wsData.organizationId);
            }
        }
    } catch {
        // Fallback to null
    }

    const base = resolveSeoMetadata({
        seo: {
            title: config.title || asset.name,
            description: config.description || 'Shared media asset',
            ogImageUrl: asset.type === 'image' ? asset.url : undefined
        },
        fallback: {
            title: config.title || asset.name,
            assetImageUrl: asset.type === 'image' ? asset.url : undefined,
        },
        org: org || undefined,
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

    const config = await getShareConfig(shareId);
    if (!config) {
        notFound();
    }

    const asset = await getMediaAsset(config.assetId);
    if (!asset) {
        notFound();
    }

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
        
        const paramsRecord: Record<string, string> = {};
        Object.entries(resolvedSearchParams).forEach(([k, v]) => {
            if (v !== undefined) {
                paramsRecord[k] = v;
            }
        });

        // 1. Resolve encrypted recipient ref parameters
        const ref = resolvedSearchParams.ref;
        const isEncrypted = ref ? ref.split(':').length === 3 : false;
        
        let resolvedContactId = '';
        let resolvedRecipientContact = '';

        if (ref && isEncrypted) {
            try {
                const { decryptToken } = await import('@/lib/crypto');
                const contactId = decryptToken(ref);
                if (contactId) {
                    resolvedContactId = contactId;
                    const contactSnap = await adminDb.collection('contacts').doc(contactId).get();
                    if (contactSnap.exists) {
                        const data = contactSnap.data() || {};
                        resolvedRecipientContact = String(data.email || '');
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
