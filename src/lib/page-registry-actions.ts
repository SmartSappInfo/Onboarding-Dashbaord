
'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import type { CampaignPage } from './types';
import { getBaseUrl } from './utils/url-helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegisterCustomPageParams {
  slug: string;
  name: string;
  organizationId: string;
  workspaceId: string;
  /** Human-readable description shown in the page picker. */
  description?: string;
}

interface RegisterCustomPageResult {
  success: boolean;
  pageId?: string;
  error?: string;
  /** true when the page was already registered (idempotent) */
  alreadyExists?: boolean;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Registers a hand-coded page into the campaign_pages collection so it:
 * 1. Appears in the message template editor's page picker
 * 2. Becomes resolvable via {{page_link:slug}} in messaging templates
 * 3. Has its analytics linked to the campaign_pages document via pageId
 *
 * Idempotent — calling this twice for the same slug updates the existing record
 * rather than creating a duplicate.
 *
 * The minimal fields required by CampaignPage are populated with sensible
 * defaults. The `pageType: 'custom_coded'` flag distinguishes these from
 * page-builder pages and prevents the editor from trying to load a structureJson.
 */
export async function registerCustomCodedPage(
  params: RegisterCustomPageParams
): Promise<RegisterCustomPageResult> {
  const { slug, name, organizationId, workspaceId, description } = params;

  try {
    // Check for existing registration (idempotency)
    const existingSnap = await adminDb
      .collection('campaign_pages')
      .where('slug', '==', slug)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      // Update metadata but don't create a duplicate
      const existingId = existingSnap.docs[0].id;
      await existingSnap.docs[0].ref.update({
        name,
        trackingEnabled: true,
        workspaceIds: [workspaceId],
        updatedAt: new Date().toISOString(),
      });

      // Link the analytics doc to this page
      await linkAnalyticsDoc(slug, existingId);

      return { success: true, pageId: existingId, alreadyExists: true };
    }

    const baseUrl = getBaseUrl();
    const now = new Date().toISOString();

    const pageData: Omit<CampaignPage, 'id'> = {
      organizationId,
      workspaceIds: [workspaceId],
      name,
      slug,
      status: 'published',
      pageGoal: 'information',
      pageType: 'custom_coded',
      trackingEnabled: true,
      seo: {
        title: name,
        description: description ?? '',
        noIndex: false,
      },
      settings: {
        customScriptsAllowed: false,
        showHeader: false,
        showFooter: false,
      },
      stats: {
        views: 0,
        uniques: 0,
        conversions: 0,
        clicks: 0,
      },
      publishedVersionId: null,
      createdBy: 'system',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection('campaign_pages').add(pageData);

    // Link the analytics doc to this newly created page
    await linkAnalyticsDoc(slug, docRef.id);

    revalidatePath('/admin/pages');
    revalidatePath('/admin/analytics/custom-pages');

    return { success: true, pageId: docRef.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PAGE-REGISTRY] Failed to register custom page:', message);
    return { success: false, error: message };
  }
}

/**
 * Links the custom_page_analytics/{slug} document back to its campaign_pages entry.
 * Creates the analytics doc if it doesn't exist yet.
 */
async function linkAnalyticsDoc(slug: string, pageId: string): Promise<void> {
  await adminDb
    .collection('custom_page_analytics')
    .doc(slug)
    .set({ pageId, slug, updatedAt: new Date().toISOString() }, { merge: true });
}

// ─── Seed helper (run once from admin or a one-off script) ────────────────────

/**
 * Registers all known hand-coded landing pages.
 * Safe to run multiple times — each call is idempotent.
 */
export async function seedKnownCustomPages(params: {
  organizationId: string;
  workspaceId: string;
}): Promise<{ results: RegisterCustomPageResult[] }> {
  const knownPages: (Omit<RegisterCustomPageParams, 'organizationId' | 'workspaceId'> & { workspaceId?: string })[] = [
    {
      slug: 'collecting-fees-without-delays-and-parental-confrontations',
      name: 'How We Collect Fees Without Delays',
      description: 'Landing page about fee collection with SmartSapp — includes video and CTA.',
      workspaceId: 'onboarding',
    },
    {
      slug: 'school-enrollment',
      name: 'School Enrollment — Fill Empty Spots',
      description: 'Sales Leads landing page for boosting enrollment numbers.',
      workspaceId: 'prospect',
    },
    {
      slug: 'collect-fees-within-four-weeks',
      name: 'Collect Your Fees in 4 Weeks',
      description: 'Campaign page for automated fee collection within four weeks.',
      workspaceId: 'onboarding',
    },
    {
      slug: 'number-one-choice',
      name: 'Number One Choice Video',
      description: 'Landing page highlighting SmartSapp as every parent\'s number one choice.',
      workspaceId: 'prospect',
    },
    {
      slug: 'school-visibility-and-enrollment-initiative',
      name: 'School Visibility & Enrollment Initiative',
      description: 'Partnership campaign for community brand ambassadorship and visibility rewards.',
      workspaceId: 'onboarding',
    },
    {
      slug: 'visiblity-thank-you',
      name: 'School Visibility Initiative Thank You',
      description: 'Thank you page for completed Visibility and Enrollment Initiative registration submissions.',
      workspaceId: 'onboarding',
    },
  ];

  const results = await Promise.all(
    knownPages.map((page) => {
      const targetWorkspaceId = page.workspaceId || params.workspaceId;
      return registerCustomCodedPage({
        ...page,
        organizationId: params.organizationId,
        workspaceId: targetWorkspaceId,
      });
    })
  );

  return { results };
}
