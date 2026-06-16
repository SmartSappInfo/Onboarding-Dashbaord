import { adminDb } from './firebase-admin';
import { resolveSeoMetadata } from './seo';
import type { Metadata } from 'next';
import type { SeoConfig } from './types';

/**
 * Fetch SEO metadata for a custom page from Firestore.
 * Performs server-side read using firebase-admin.
 */
export async function getCustomPageMetadata(
  pageKey: string,
  fallback: { title: string; description?: string; assetImageUrl?: string }
): Promise<Metadata> {
  try {
    // Sanitize path for doc ID: remove leading/trailing slashes, replace remaining with double underscores
    const docId = pageKey.replace(/^\/|\/$/g, '').replace(/\//g, '__') || 'homepage';
    const docSnap = await adminDb.collection('custom_pages_seo').doc(docId).get();

    if (docSnap.exists) {
      const data = docSnap.data();
      const seo: SeoConfig = {
        title: data?.title || undefined,
        description: data?.description || undefined,
        keywords: data?.keywords || undefined,
        ogImageUrl: data?.ogImageUrl || undefined,
        ogImageMode: data?.ogImageUrl ? 'custom' : 'asset',
        useContentFallback: data?.useContentFallback ?? false,
      };

      return resolveSeoMetadata({
        seo,
        fallback,
        title: { mode: 'absolute' },
      });
    }
  } catch (err) {
    console.error('Error fetching custom page SEO for', pageKey, err);
  }

  // Fallback to static values if no custom SEO is saved
  return resolveSeoMetadata({
    seo: null,
    fallback,
    title: { mode: 'absolute' },
  });
}
