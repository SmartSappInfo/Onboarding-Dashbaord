import type { Metadata, ResolvingMetadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { getOrgBranding } from '@/lib/org-branding';
import { resolveSeoMetadata, normalizeParentImages } from '@/lib/seo';
import type { MediaAsset, EntityContact } from '@/lib/types';
import type { MediaExperience, MediaExperiment } from '@/lib/types/media-2.0';
import MediaShareClient from './MediaShareClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ShareConfig {
    id: string;
    assetId: string;
    workspaceId: string;
    experienceId?: string;
    title: string;
    description: string;
    ctaText: string;
    ctaType: 'none' | 'survey' | 'form' | 'pdf' | 'page' | 'external';
    ctaTargetId: string;
    ctaTargetUrl: string;
    ctaMode?: 'modal' | 'redirect' | 'replace';
    ctaPretext?: string;
    ctaPopoverEnabled?: boolean;
    ctaActivationGate?: 'immediate' | 'quarter' | 'half' | 'threequarters' | 'complete';
    autoPlay?: boolean;
    slug?: string;
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

        // Fallback: Query by slug
        const slugSnap = await adminDb.collection('media_shares')
            .where('slug', '==', shareId)
            .limit(1)
            .get();
        
        if (!slugSnap.empty) {
            const doc = slugSnap.docs[0];
            return { id: doc.id, ...doc.data() } as ShareConfig;
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
    { params, searchParams }: { 
        params: Promise<{ shareId: string }>;
        searchParams: Promise<Record<string, string>>;
    },
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { shareId } = await params;
    const resolvedSearchParams = await searchParams;
    const ref = resolvedSearchParams.ref;
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

    // 1. Resolve encrypted recipient ref parameters
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
            console.warn('[PublicMediaShareMetadata] Direct token decryption error:', err);
        }
    }

    // 2. Resolve context & template variables
    const paramsRecord: Record<string, string> = {};
    Object.entries(resolvedSearchParams).forEach(([k, v]) => {
        if (v !== undefined) {
            paramsRecord[k] = v;
        }
    });
    if (ref && !isEncrypted) {
        paramsRecord.entityId = ref;
    }
    if (resolvedContactId) {
        paramsRecord.contactId = resolvedContactId;
    }
    if (resolvedRecipientContact) {
        paramsRecord.email = resolvedRecipientContact;
    }

    const { FieldsVariablesService } = await import('@/lib/services/fields-variables-service-impl');
    const context = await FieldsVariablesService.resolveEntityContextFromParams(
        [config.workspaceId],
        paramsRecord
    );

    let resolvedTitle = config.title || asset.name;
    let resolvedDescription = config.description || 'Shared media asset';

    try {
        const varContext = {
            workspaceId: config.workspaceId,
            entityId: context.entityId || undefined,
            recipientContact: context.recipientContact || undefined
        };
        resolvedTitle = await FieldsVariablesService.resolveTemplateVariables(resolvedTitle, varContext);
        resolvedDescription = await FieldsVariablesService.resolveTemplateVariables(resolvedDescription, varContext);
    } catch (err) {
        console.warn('[PublicMediaShareMetadata] Variable resolution failed:', err);
    }

    const base = resolveSeoMetadata({
        seo: {
            title: resolvedTitle,
            description: resolvedDescription,
            ogImageUrl: asset.type === 'image' ? asset.url : undefined
        },
        fallback: {
            title: resolvedTitle,
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
    let resolvedContactId = '';
    let resolvedEntityId = '';

    try {
        const { FieldsVariablesService } = await import('@/lib/services/fields-variables-service-impl');
        
        const paramsRecord: Record<string, string> = {};
        Object.entries(resolvedSearchParams).forEach(([k, v]) => {
            if (v !== undefined) {
                paramsRecord[k] = v;
            }
        });

        // 1. Normalize query parameter aliases
        const rawContactParam = resolvedSearchParams.contactId || resolvedSearchParams.contact_id || resolvedSearchParams.c || resolvedSearchParams.cid || resolvedSearchParams.contact;
        const rawEntityParam = resolvedSearchParams.entityId || resolvedSearchParams.entity_id || resolvedSearchParams.e || resolvedSearchParams.entity;
        const rawEmailParam = resolvedSearchParams.email || resolvedSearchParams.contactEmail;
        const rawPhoneParam = resolvedSearchParams.phone || resolvedSearchParams.contactPhone;

        if (rawContactParam && !paramsRecord.contactId) paramsRecord.contactId = rawContactParam;
        if (rawEntityParam && !paramsRecord.entityId) paramsRecord.entityId = rawEntityParam;
        if (rawEmailParam && !paramsRecord.email) paramsRecord.email = rawEmailParam;
        if (rawPhoneParam && !paramsRecord.phone) paramsRecord.phone = rawPhoneParam;

        if (rawContactParam) resolvedContactId = rawContactParam;
        if (rawEntityParam) resolvedEntityId = rawEntityParam;

        // 2. Resolve encrypted recipient ref parameters
        const ref = resolvedSearchParams.ref;
        const isEncrypted = ref ? ref.split(':').length === 3 : false;
        
        let resolvedRecipientContact = '';

        if (ref && isEncrypted) {
            try {
                const { decryptToken } = await import('@/lib/crypto');
                const decrypted = decryptToken(ref);
                if (decrypted) {
                    const [contactId, entityId] = decrypted.split(':');
                    if (contactId) resolvedContactId = contactId;
                    if (entityId) resolvedEntityId = entityId;
                    
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
                    } else if (contactId) {
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
        if (ref && !isEncrypted && !paramsRecord.entityId) {
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

        if (entityCtx.entityId) {
            resolvedEntityId = entityCtx.entityId;
        }

        // If contact ID not directly provided, query matching contact by email/phone in workspace
        if (!resolvedContactId && (paramsRecord.email || paramsRecord.phone)) {
            try {
                if (paramsRecord.email) {
                    const matchSnap = await adminDb.collection('contacts')
                        .where('workspaceId', '==', config.workspaceId)
                        .where('email', '==', paramsRecord.email.toLowerCase().trim())
                        .limit(1)
                        .get();
                    if (!matchSnap.empty) {
                        resolvedContactId = matchSnap.docs[0].id;
                    }
                }
            } catch {
                // Ignore lookup errors
            }
        }

        const context = {
            workspaceId: config.workspaceId,
            entityId: resolvedEntityId || undefined,
            recipientContact: entityCtx.recipientContact || undefined,
        };

        resolvedTitle = await FieldsVariablesService.resolveTemplateVariables(resolvedTitle, context);
        resolvedDescription = await FieldsVariablesService.resolveTemplateVariables(resolvedDescription, context);
        resolvedCtaPretext = await FieldsVariablesService.resolveTemplateVariables(resolvedCtaPretext, context);
    } catch (err) {
        console.warn('[PublicMediaShareRoute] Failed to compile variables:', err);
    }

    // Phase 5: Resolve Contact Profile Metadata for dynamic rules and personalization
    let contactName = '';
    let contactEmail = '';
    let companyName = '';
    let contactScore = 0;
    let dealStage = '';
    let contactTagIds: string[] = [];

    if (resolvedContactId) {
        try {
            const contactSnap = await adminDb.collection('contacts').doc(resolvedContactId).get();
            if (contactSnap.exists) {
                const cd = contactSnap.data() || {};
                contactName = String(cd.name || cd.firstName || cd.displayName || '');
                contactEmail = String(cd.email || '');
                companyName = String(cd.company || cd.companyName || cd.organization || '');
                contactScore = typeof cd.score === 'number' ? cd.score : (typeof cd.engagementScore === 'number' ? cd.engagementScore : 0);
                contactTagIds = Array.isArray(cd.tagIds) ? cd.tagIds.map(String) : [];
            }
            const dealSnap = await adminDb.collection('deals')
                .where('contactIds', 'array-contains', resolvedContactId)
                .limit(1)
                .get();
            if (!dealSnap.empty) {
                const dealData = dealSnap.docs[0].data();
                dealStage = String(dealData.stage || dealData.status || '');
            }
        } catch (err) {
            console.warn('[PublicMediaShareRoute] Error fetching contact profile metadata:', err);
        }
    }

    // Phase 5: Resolve Attached or Default MediaExperience
    let experience: MediaExperience | null = null;
    try {
        if (config.experienceId) {
            const expSnap = await adminDb.collection('media_experiences').doc(config.experienceId).get();
            if (expSnap.exists) {
                experience = { id: expSnap.id, ...expSnap.data() } as MediaExperience;
            }
        }
        if (!experience) {
            const expAssetSnap = await adminDb.collection('media_experiences')
                .where('assetId', '==', config.assetId)
                .where('isDefault', '==', true)
                .limit(1)
                .get();
            if (!expAssetSnap.empty) {
                const doc = expAssetSnap.docs[0];
                experience = { id: doc.id, ...doc.data() } as MediaExperience;
            }
        }
        if (!experience) {
            const expWsSnap = await adminDb.collection('media_experiences')
                .where('workspaceId', '==', config.workspaceId)
                .where('isDefault', '==', true)
                .limit(1)
                .get();
            if (!expWsSnap.empty) {
                const doc = expWsSnap.docs[0];
                experience = { id: doc.id, ...doc.data() } as MediaExperience;
            }
        }
    } catch (err) {
        console.warn('[PublicMediaShareRoute] Error fetching experience:', err);
    }

    // Phase 5: Resolve Content Recommendations
    let recommendedAssets: MediaAsset[] = [];
    if (experience?.recommendations?.enabled) {
        try {
            const maxItems = Math.min(10, Math.max(1, experience.recommendations.maxRecommendations || 3));
            if (experience.recommendations.strategy === 'package' && experience.recommendations.targetPackageId) {
                const pkgSnap = await adminDb.collection('media_packages').doc(experience.recommendations.targetPackageId).get();
                if (pkgSnap.exists) {
                    const pkgData = pkgSnap.data() as { items?: { assetId: string }[] };
                    const assetIds = (pkgData.items || []).map((i) => i.assetId).filter(Boolean);
                    if (assetIds.length > 0) {
                        const recSnap = await adminDb.collection('media')
                            .where('__name__', 'in', assetIds.slice(0, maxItems))
                            .get();
                        recommendedAssets = recSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MediaAsset));
                    }
                }
            } else if (experience.recommendations.strategy === 'collection' && experience.recommendations.targetCollectionId) {
                const colSnap = await adminDb.collection('media_collections').doc(experience.recommendations.targetCollectionId).get();
                if (colSnap.exists) {
                    const colData = colSnap.data() as { assetIds?: string[] };
                    const assetIds = colData.assetIds || [];
                    if (assetIds.length > 0) {
                        const recSnap = await adminDb.collection('media')
                            .where('__name__', 'in', assetIds.slice(0, maxItems))
                            .get();
                        recommendedAssets = recSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MediaAsset));
                    }
                }
            }
            if (recommendedAssets.length === 0) {
                const fallbackRecSnap = await adminDb.collection('media')
                    .where('workspaceIds', 'array-contains', config.workspaceId)
                    .limit(maxItems + 1)
                    .get();
                recommendedAssets = fallbackRecSnap.docs
                    .filter((d) => d.id !== config.assetId)
                    .slice(0, maxItems)
                    .map((d) => ({ id: d.id, ...d.data() } as MediaAsset));
            }
        } catch (err) {
            console.warn('[PublicMediaShareRoute] Error resolving recommendations:', err);
        }
    }

    // Phase 8: Resolve Active Experiment for Autonomous Optimization
    let activeExperiment: MediaExperiment | null = null;
    try {
        if (experience?.id) {
            const expDocSnap = await adminDb.collection('media_experiments')
                .where('experienceId', '==', experience.id)
                .where('status', 'in', ['RUNNING', 'AUTO_PROMOTED'])
                .limit(1)
                .get();
            if (!expDocSnap.empty) {
                activeExperiment = { id: expDocSnap.docs[0].id, ...expDocSnap.docs[0].data() } as MediaExperiment;
            }
        }
        if (!activeExperiment && config.assetId) {
            const expAssetSnap = await adminDb.collection('media_experiments')
                .where('assetId', '==', config.assetId)
                .where('status', 'in', ['RUNNING', 'AUTO_PROMOTED'])
                .limit(1)
                .get();
            if (!expAssetSnap.empty) {
                activeExperiment = { id: expAssetSnap.docs[0].id, ...expAssetSnap.docs[0].data() } as MediaExperiment;
            }
        }
    } catch (err) {
        console.warn('[PublicMediaShareRoute] Error fetching active experiment:', err);
    }

    const isEmbed = resolvedSearchParams.embed === 'true';

    return (
        <MediaShareClient
            shareId={config.id}
            asset={asset}
            title={resolvedTitle}
            description={resolvedDescription}
            ctaText={config.ctaText}
            ctaTargetUrl={config.ctaTargetUrl}
            ctaType={config.ctaType}
            ctaMode={config.ctaMode || 'redirect'}
            ctaPretext={resolvedCtaPretext}
            ctaPopoverEnabled={config.ctaPopoverEnabled || false}
            ctaActivationGate={(config.ctaActivationGate === 'half' || config.ctaActivationGate === 'complete') ? config.ctaActivationGate : 'immediate'}
            autoPlay={config.autoPlay ?? false}
            orgBranding={orgBranding}
            isEmbed={isEmbed}
            searchParams={resolvedSearchParams}
            contactId={resolvedContactId || undefined}
            entityId={resolvedEntityId || undefined}
            experience={experience}
            recommendedAssets={recommendedAssets}
            activeExperiment={activeExperiment}
            contactName={contactName}
            contactEmail={contactEmail}
            companyName={companyName}
            contactScore={contactScore}
            dealStage={dealStage}
            contactTagIds={contactTagIds}
        />
    );
}
