'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import type { CampaignPage, CampaignPageVersion } from './types';

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
    let structureJson: any = { sections: [] };
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
  } catch (error: any) {
    console.error('>>> [PAGE] Duplicate Failed:', error.message);
    return { success: false, error: error.message };
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
  } catch (error: any) {
    console.error('>>> [PAGE] Status Update Failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Permanently deletes a DRAFT Campaign Page and all its versions.
 * Guards against deleting published or archived pages.
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

    // Safety guard: never delete published or archived pages from this action
    if (page.status !== 'draft') {
      return { success: false, error: 'Only draft pages can be deleted.' };
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
  } catch (error: any) {
    console.error('>>> [PAGE] Delete Failed:', error.message);
    return { success: false, error: error.message };
  }
}

