import type { Metadata, ResolvingMetadata } from 'next';
import { cache } from 'react';
import PublicPageClient from './PublicPageClient';
import { adminDb } from '@/lib/firebase-admin';
import { getOrgBranding } from '@/lib/org-branding';
import { resolveSeoMetadata, normalizeParentImages } from '@/lib/seo';
import { VERSIONS_COLLECTION } from '@/lib/page-builder/constants';
import type { CampaignPageVersion } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// React.cache dedupes this between generateMetadata and the page body.
const getPageBySlug = cache(async function getPageBySlug(slug: string) {
    try {
        const snap = await adminDb.collection('campaign_pages')
            .where('slug', '==', slug)
            .where('status', '==', 'published')
            .limit(1)
            .get();
        if (!snap.empty) {
            return { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
        }
        return null;
    } catch {
        return null;
    }
});

async function getPageVersion(versionId: string): Promise<CampaignPageVersion | null> {
    try {
        const snap = await adminDb.collection(VERSIONS_COLLECTION).doc(versionId).get();
        const data = snap.data();
        if (snap.exists && data) {
            return { ...(data as Omit<CampaignPageVersion, 'id'>), id: snap.id };
        }
        return null;
    } catch {
        return null;
    }
}

export async function generateMetadata(
    { params }: { params: Promise<{ slug: string }> },
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { slug } = await params;
    const page = await getPageBySlug(slug) as any;

    if (!page) {
        return { title: 'Page Not Found', robots: { index: false, follow: false } };
    }

    const org = await getOrgBranding(page.organizationId);

    // Campaign pages have no separate banner — their `seo.ogImageUrl` IS the
    // social image, so it is passed as the asset (default mode picks it up).
    const base = resolveSeoMetadata({
        seo: page.seo,
        fallback: {
            title: page.name || org.name || 'Campaign Page',
            assetImageUrl: page.seo?.ogImageUrl,
        },
        org,
        parentImages: normalizeParentImages((await parent).openGraph?.images),
        path: `/p/${slug}`,
    });

    return {
        ...base,
        other: {
            // Preconnect links for Google Fonts to prevent font flicker/layout shift
            'preconnect-fonts': 'https://fonts.googleapis.com',
            'preconnect-gstatic': 'https://fonts.gstatic.com',
        },
    };
}

export default async function PublicPageRoute({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const page = await getPageBySlug(slug);
    let version = null;
    let orgBranding = null;

    if (page) {
        // Parallelize independent reads (vercel-react-best-practices: async-parallel).
        [orgBranding, version] = await Promise.all([
            getOrgBranding(page.organizationId),
            page.publishedVersionId ? getPageVersion(page.publishedVersionId) : Promise.resolve(null),
        ]);
    }

    return (
        <PublicPageClient 
            slug={slug} 
            initialPage={page} 
            initialVersion={version} 
            orgBranding={orgBranding} 
        />
    );
}
