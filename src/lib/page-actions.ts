'use server';

import { adminDb } from './firebase-admin';
import { revalidatePath } from 'next/cache';
import type { CampaignPage, CampaignPageVersion } from './types';

/**
 * Clones a Campaign Page and its latest content version.
 * @param pageId The ID of the page to duplicate.
 * @param userId The ID of the user performing the action.
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
    console.error(">>> [PAGE] Duplicate Failed:", error.message);
    return { success: false, error: error.message };
  }
}
