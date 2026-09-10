'use server';

import { adminDb } from './firebase-admin';
import type { PageSectionTemplate, PageSection } from './types';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';

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
    industry?: string;
  }
) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(data.workspaceId);

  try {
    const sectionId = adminDb.collection('campaign_page_sections').doc().id;
    const template: PageSectionTemplate = {
      id: sectionId,
      ...data,
      createdAt: new Date().toISOString()
    };
    
    await adminDb.collection('campaign_page_sections').doc(sectionId).set(template);
    return { success: true, id: sectionId };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error occurred while saving section template';
    console.error(">>> [SECTION] Save Template Failed:", errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Fetches all reusable section templates for a workspace/organization.
 */
export async function getSectionTemplatesAction(organizationId: string) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

    try {
        const snap = await adminDb.collection('campaign_page_sections')
            .where('organizationId', '==', organizationId)
            .get();
        
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PageSectionTemplate));
    } catch (e: unknown) {
        console.error(">>> [SECTION] Fetch Failed:", e);
        return [];
    }
}
