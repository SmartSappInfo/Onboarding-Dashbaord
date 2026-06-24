/**
 * Shared literals for the page builder.
 *
 * `VERSIONS_COLLECTION` is the single source of truth for where campaign page
 * versions live in Firestore. The builder writes here; the public route (server
 * + client) must read from the same place. Historically these diverged
 * (subcollection vs top-level), which caused every published page to 404.
 */
export const VERSIONS_COLLECTION = 'campaign_page_versions';

/** Firestore collection holding the `CampaignPage` documents. */
export const PAGES_COLLECTION = 'campaign_pages';
