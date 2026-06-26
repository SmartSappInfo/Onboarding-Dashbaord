
import type { PageLinkMap } from './types';
import { getBaseUrl } from './utils/url-helpers';

/**
 * Regex that matches {{page_link:some-slug}} tokens in a template body.
 * The slug is captured in group 1.
 *
 * Must run as a pre-pass BEFORE the generic {{variable}} replacer in
 * resolveVariables(), because the colon in the token is not handled by that regex.
 */
const PAGE_LINK_TOKEN_REGEX = /\{\{page_link:([^}]+)\}\}/g;

// ─── Extraction ───────────────────────────────────────────────────────────────

/**
 * Extracts all unique page slugs referenced via {{page_link:slug}} in a string.
 * Used to determine which pages need to be fetched before rendering.
 *
 * Pure function — no side effects.
 */
export function extractPageLinkSlugs(text: string): string[] {
  const matches = [...text.matchAll(PAGE_LINK_TOKEN_REGEX)];
  return [...new Set(matches.map((m) => m[1].trim()))];
}

// ─── Resolver (pure) ─────────────────────────────────────────────────────────

/**
 * Replaces {{page_link:slug}} tokens with canonical page URLs from the map.
 *
 * Pure function — no Firestore calls. The map is pre-fetched server-side and
 * passed in, so this can be called synchronously (e.g. from the message preview
 * renderer in the Simulation Studio).
 *
 * Unresolved slugs (not in the map) are left as-is, matching the behaviour
 * of the generic {{variable}} replacer for missing variables.
 */
export function resolvePageLinkTokens(text: string, pageLinks: PageLinkMap): string {
  if (!text || pageLinks.size === 0) return text;
  return text.replace(PAGE_LINK_TOKEN_REGEX, (match, slug: string) => {
    return pageLinks.get(slug.trim()) ?? match;
  });
}

// ─── Map builder (async — Firestore) ─────────────────────────────────────────

/**
 * Builds a PageLinkMap for a given set of page slugs.
 *
 * Strategy:
 * 1. Look up each slug in campaign_pages (covers both custom_coded and page_builder pages)
 * 2. Fall back to constructing the URL from the base URL + slug for unregistered pages
 *
 * The entityId is NOT baked in here. Identity is added by:
 *   - Email: the /api/l/{id} redirect appends ?ref=<entityId>
 *   - SMS/WhatsApp (Phase 8): a pre-send transformer appends ?ref=<entityId>
 */
export async function buildPageLinkMap(
  slugs: string[],
  adminDb: FirebaseFirestore.Firestore
): Promise<PageLinkMap> {
  const map = new Map<string, string>();
  if (slugs.length === 0) return map;

  const baseUrl = getBaseUrl();

  // Fetch all registered pages in parallel
  const snaps = await Promise.all(
    slugs.map((slug) =>
      adminDb
        .collection('campaign_pages')
        .where('slug', '==', slug)
        .where('status', '==', 'published')
        .limit(1)
        .get()
    )
  );

  slugs.forEach((slug, i) => {
    const snap = snaps[i];
    if (!snap.empty) {
      // Registered page — use slug from document (canonical source of truth)
      const docSlug = (snap.docs[0].data() as { slug: string }).slug;
      map.set(slug, `${baseUrl}/${docSlug}`);
    } else {
      // Unregistered / hand-coded page — construct URL from slug directly
      map.set(slug, `${baseUrl}/${slug}`);
    }
  });

  return map;
}
