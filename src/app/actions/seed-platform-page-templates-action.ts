'use server';

import { adminDb } from '@/lib/firebase-admin';
import { ALL_TEMPLATES } from '@/lib/page-builder/templates';
import { STATIC_SECTION_TEMPLATES } from '@/lib/page-builder/templates/sections';
import { authorizeBackoffice } from '@/lib/backoffice/backoffice-auth';
import type { PlatformTemplate } from '@/lib/backoffice/backoffice-types';

export async function seedPlatformPageTemplatesAction(idToken: string): Promise<{
  success: boolean;
  seededCount?: { pages: number; sections: number };
  error?: string;
}> {
  try {
    const actor = await authorizeBackoffice(idToken, 'templates', 'create');

    const timestamp = new Date().toISOString();
    const batch = adminDb.batch();

    // 1. Ingest Page Templates
    let pageCount = 0;
    const blankPage = {
      id: 'blank-page',
      name: 'Blank Page',
      description: 'Start from scratch with a blank canvas.',
      goal: 'information',
      isGlobal: true,
      structureJson: { sections: [] },
      industry: 'all'
    };

    const pagesList = [blankPage, ...ALL_TEMPLATES];

    for (const page of pagesList) {
      const ref = adminDb.collection('platform_templates').doc(page.id);
      
      const docData: PlatformTemplate = {
        id: page.id,
        type: 'page',
        name: page.name,
        description: page.description || 'No description provided.',
        category: page.goal || 'General',
        scope: 'system',
        version: 1,
        versionHistory: [
          {
            version: 1,
            content: page,
            publishedAt: timestamp,
            publishedBy: actor.email,
            changelog: 'Seeded from page builder presets.',
          }
        ],
        content: page,
        status: 'published',
        defaultForNewOrgs: page.id === 'blank-page',
        visibilityRules: {
          orgIds: [],
          workspaceTypes: []
        },
        usageCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        updatedBy: actor.userId
      };

      batch.set(ref, docData);
      pageCount++;
    }

    // 2. Ingest Section Templates
    let sectionCount = 0;
    for (const section of STATIC_SECTION_TEMPLATES) {
      const docId = `section-${section.id}`;
      const ref = adminDb.collection('platform_templates').doc(docId);

      const docData: PlatformTemplate = {
        id: docId,
        type: 'section',
        name: section.name,
        description: ('description' in section && typeof (section as Record<string, unknown>).description === 'string')
          ? (section as Record<string, unknown>).description as string
          : 'No description provided.',
        category: section.category,
        scope: 'system',
        version: 1,
        versionHistory: [
          {
            version: 1,
            content: section,
            publishedAt: timestamp,
            publishedBy: actor.email,
            changelog: 'Seeded from page builder static sections.',
          }
        ],
        content: section,
        status: 'published',
        defaultForNewOrgs: false,
        visibilityRules: {
          orgIds: [],
          workspaceTypes: []
        },
        usageCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        updatedBy: actor.userId
      };

      batch.set(ref, docData);
      sectionCount++;
    }

    await batch.commit();

    return {
      success: true,
      seededCount: { pages: pageCount, sections: sectionCount }
    };
  } catch (error: unknown) {
    console.error('[SEED_PLATFORM_TEMPLATES] failed:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}
