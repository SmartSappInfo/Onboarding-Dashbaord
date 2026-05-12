import type { Metadata, ResolvingMetadata } from 'next';
import PublicPageClient from './PublicPageClient';
import { adminDb } from '@/lib/firebase-admin';

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
            return { id: snap.docs[0].id, ...snap.docs[0].data() };
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

    const title = page.seo?.title || page.name || 'Campaign Page';
    const description = page.seo?.description || '';
    const previousImages = (await parent).openGraph?.images || [];

    return {
        title,
        description,
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
    return <PublicPageClient slug={slug} />;
}
