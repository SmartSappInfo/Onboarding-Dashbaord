import type { Metadata, ResolvingMetadata } from 'next';
import PublicPageClient from './PublicPageClient';
import { adminDb } from '@/lib/firebase-admin';
import { getOrgBranding } from '@/lib/org-branding';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getPageBySlug(slug: string) {
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
}

async function getPageVersion(pageId: string, versionId: string) {
    try {
        const snap = await adminDb.collection('campaign_pages').doc(pageId)
            .collection('campaign_page_versions').doc(versionId).get();
        if (snap.exists) {
            return { id: snap.id, ...snap.data() } as any;
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
        return { title: 'Page Not Found | SmartSapp' };
    }

    const org = await getOrgBranding(page.organizationId);
    const title = page.seo?.title || page.name || org.name || 'Campaign Page';
    const description = page.seo?.description || '';
    const previousImages = (await parent).openGraph?.images || [];

    // Preconnect to Google Fonts and load the brand font stylesheet
    const fontFamily = org.brandFontFamily || 'Inter';
    const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@400;500;700;900&display=swap`;

    return {
        title,
        description,
        other: {
            // Preconnect links for Google Fonts to prevent font flicker/layout shift
            'preconnect-fonts': 'https://fonts.googleapis.com',
            'preconnect-gstatic': 'https://fonts.gstatic.com',
        },
        openGraph: {
            title,
            description,
            images: page.seo?.ogImageUrl ? [page.seo.ogImageUrl] : previousImages,
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: page.seo?.ogImageUrl ? [page.seo.ogImageUrl] : [],
        },
        robots: page.seo?.noIndex ? { index: false, follow: false } : undefined,
    };
}

export default async function PublicPageRoute({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const page = await getPageBySlug(slug);
    let version = null;
    let orgBranding = null;

    if (page) {
        orgBranding = await getOrgBranding(page.organizationId);
        if (page.publishedVersionId) {
            version = await getPageVersion(page.id, page.publishedVersionId);
        }
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
