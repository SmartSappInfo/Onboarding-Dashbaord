'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import type { CampaignPage, CampaignPageVersion, CampaignPageStructure } from './types';

/**
 * Clones a Campaign Page and its latest content version.
 */
export async function duplicatePageAction(pageId: string, userId: string) {
  try {
    const pageRef = adminDb.collection('campaign_pages').doc(pageId);
    const pageSnap = await pageRef.get();

    if (!pageSnap.exists) {
      return { success: false, error: 'Source page not found.' };
    }

    const originalPage = pageSnap.data() as CampaignPage;
    
    // Find the latest version to clone
    let structureJson: CampaignPageStructure = { sections: [] };
    const versionsSnap = await adminDb.collection('campaign_page_versions')
      .where('pageId', '==', pageId)
      .orderBy('versionNumber', 'desc')
      .limit(1)
      .get();

    if (!versionsSnap.empty) {
      structureJson = (versionsSnap.docs[0].data() as CampaignPageVersion).structureJson;
    }

    const timestamp = new Date().toISOString();
    const newPageId = adminDb.collection('campaign_pages').doc().id;
    
    // Ensure slug uniqueness is likely with a short suffix
    const newSlug = `${originalPage.slug}-copy-${Math.random().toString(36).substring(7)}`;

    const newPage: CampaignPage = {
      ...originalPage,
      id: newPageId,
      name: `${originalPage.name} (Copy)`,
      slug: newSlug,
      status: 'draft',
      publishedVersionId: null, // New page starts as draft
      campaignId: null, // Do not carry over campaign connection
      stats: {
        views: 0,
        uniques: 0,
        conversions: 0,
        clicks: 0
      },
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const newVersionId = adminDb.collection('campaign_page_versions').doc().id;
    const newVersion: CampaignPageVersion = {
      id: newVersionId,
      pageId: newPageId,
      organizationId: originalPage.organizationId,
      versionNumber: 1,
      structureJson,
      createdBy: userId,
      createdAt: timestamp,
      isPublishedVersion: false
    };

    const batch = adminDb.batch();
    batch.set(adminDb.collection('campaign_pages').doc(newPageId), newPage);
    batch.set(adminDb.collection('campaign_page_versions').doc(newVersionId), newVersion);
    
    await batch.commit();

    revalidatePath('/admin/pages');
    return { success: true, id: newPageId };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to duplicate page';
    console.error('>>> [PAGE] Duplicate Failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Updates the status of a Campaign Page (publish / unpublish / archive).
 * When publishing, sets publishedVersionId to the latest version.
 * When unpublishing or archiving, clears publishedVersionId.
 *
 * @param pageId  Firestore document ID of the page.
 * @param status  Target status.
 * @param userId  ID of the user performing the action (for audit).
 */
export async function updatePageStatusAction(
  pageId: string,
  status: 'published' | 'archived' | 'draft',
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  // js-early-exit: validate inputs before hitting Firestore
  if (!pageId || !userId) {
    return { success: false, error: 'Invalid arguments.' };
  }

  try {
    const pageRef = adminDb.collection('campaign_pages').doc(pageId);
    const pageSnap = await pageRef.get();

    if (!pageSnap.exists) {
      return { success: false, error: 'Page not found.' };
    }

    const timestamp = new Date().toISOString();
    let publishedVersionId: string | null = null;

    if (status === 'published') {
      // Find the latest version to mark as published
      const versionsSnap = await adminDb
        .collection('campaign_page_versions')
        .where('pageId', '==', pageId)
        .orderBy('versionNumber', 'desc')
        .limit(1)
        .get();

      if (!versionsSnap.empty) {
        publishedVersionId = versionsSnap.docs[0].id;
      }
    }

    await pageRef.update({
      status,
      publishedVersionId,
      updatedAt: timestamp,
    });

    revalidatePath('/admin/pages');
    return { success: true };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to update page status';
    console.error('>>> [PAGE] Status Update Failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Permanently deletes a Draft or Archived Campaign Page and all its versions.
 * Guards against deleting active published pages directly.
 *
 * @param pageId  Firestore document ID of the page.
 * @param userId  ID of the user performing the action (for audit).
 */
export async function deletePageAction(
  pageId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!pageId || !userId) {
    return { success: false, error: 'Invalid arguments.' };
  }

  try {
    const pageRef = adminDb.collection('campaign_pages').doc(pageId);
    const pageSnap = await pageRef.get();

    if (!pageSnap.exists) {
      return { success: false, error: 'Page not found.' };
    }

    const page = pageSnap.data() as CampaignPage;

    // Safety guard: published pages cannot be deleted directly (must be unpublished or archived first)
    if (page.status === 'published') {
      return { success: false, error: 'Published pages cannot be deleted directly. Please unpublish or archive the page first.' };
    }

    // Fetch all associated versions
    const versionsSnap = await adminDb
      .collection('campaign_page_versions')
      .where('pageId', '==', pageId)
      .get();

    // Batch-delete page + all its versions atomically
    const batch = adminDb.batch();
    batch.delete(pageRef);
    versionsSnap.docs.forEach(doc => batch.delete(doc.ref));

    await batch.commit();

    revalidatePath('/admin/pages');
    return { success: true };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to delete page';
    console.error('>>> [PAGE] Delete Failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

