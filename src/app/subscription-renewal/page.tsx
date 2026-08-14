import type { Metadata } from 'next';
import PublicPageClient from '@/app/p/[slug]/PublicPageClient';
import SUBSCRIPTION_RENEWAL_DATA from '@/app/p/[slug]/subscription-renewal-data.json';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    const seo = SUBSCRIPTION_RENEWAL_DATA.page.seo;
    return {
        title: seo.title,
        description: seo.description,
        openGraph: {
            title: seo.title,
            description: seo.description,
            images: [seo.ogImageUrl],
        },
    };
}

export default function SubscriptionRenewalPage() {
    return <PublicPageClient slug="subscription-renewal" />;
}
