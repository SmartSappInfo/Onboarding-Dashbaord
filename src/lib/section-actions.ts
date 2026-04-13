'use server';

import { adminDb } from './firebase-admin';
import type { PageSectionTemplate, PageSection } from './types';

/**
 * Saves a page section as a reusable template.
 */
export async function saveSectionAction(
  data: {
    name: string;
    category: string;
    structure: PageSection;
    organizationId: string;
    workspaceId: string;
  }
) {
  try {
    const sectionId = adminDb.collection('campaign_page_sections').doc().id;
    const template: PageSectionTemplate = {
      id: sectionId,
      ...data,
      createdAt: new Date().toISOString()
    };
    
    await adminDb.collection('campaign_page_sections').doc(sectionId).set(template);
    return { success: true, id: sectionId };
  } catch (error: any) {
    console.error(">>> [SECTION] Save Template Failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches all reusable section templates for a workspace/organization.
 */
export async function getSectionTemplatesAction(organizationId: string) {
    try {
        const snap = await adminDb.collection('campaign_page_sections')
            .where('organizationId', '==', organizationId)
            .get();
        
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PageSectionTemplate));
    } catch (e) {
        console.error(">>> [SECTION] Fetch Failed:", e);
        return [];
    }
}
