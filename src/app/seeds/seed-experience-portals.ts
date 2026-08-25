/**
 * {{Org_name}} Experience Platform — Seed Experience Portals
 *
 * Seeds flagship starter Experience Portals (Academy, Knowledge Base, and Community)
 * for an organization to ensure instant operational readiness.
 *
 * Usage:
 *   npx tsx src/app/seeds/seed-experience-portals.ts [orgId]
 */

import { adminDb } from '@/lib/firebase-admin';
import { PortalService } from '@/lib/services/portal-service';
import type { PortalMode } from '@/lib/types/portal';

export async function seedExperiencePortals(targetOrgId: string = 'smartsapp-hq') {
  console.log(`\n🚀 [SEED] Starting Experience Portals seed for organization: ${targetOrgId}...`);

  const starterPortals: {
    name: string;
    slug: string;
    description: string;
    primaryMode: PortalMode;
    workspaceIds: string[];
  }[] = [
    {
      name: 'SmartSapp Academy',
      slug: 'academy',
      description: 'Master educational fee collection, school operations, and parent engagement strategies.',
      primaryMode: 'academy',
      workspaceIds: ['onboarding', 'prospect'],
    },
    {
      name: 'SmartSapp Help & Knowledge Center',
      slug: 'docs',
      description: 'Official product documentation, step-by-step guides, and troubleshooting manuals.',
      primaryMode: 'documentation',
      workspaceIds: ['onboarding'],
    },
    {
      name: 'School Leaders Community',
      slug: 'community',
      description: 'Exclusive peer community for school founders, headteachers, and education leaders.',
      primaryMode: 'community',
      workspaceIds: ['onboarding', 'prospect'],
    },
  ];

  for (const starter of starterPortals) {
    // Check if portal already exists
    const existing = await adminDb
      .collection('portals')
      .where('organizationId', '==', targetOrgId)
      .where('slug', '==', starter.slug)
      .limit(1)
      .get();

    if (!existing.empty) {
      console.log(`ℹ️ [SEED] Portal "${starter.name}" (/portal/${starter.slug}) already exists. Skipping.`);
      continue;
    }

    const created = await PortalService.createPortal(
      {
        organizationId: targetOrgId,
        workspaceIds: starter.workspaceIds,
        name: starter.name,
        slug: starter.slug,
        description: starter.description,
        primaryMode: starter.primaryMode,
      },
      'system_seeder'
    );

    // Publish starter portal
    await PortalService.publishPortal(created.id, 'system_seeder');
    console.log(`✅ [SEED] Created and published portal "${created.name}" at /portal/${created.slug} (ID: ${created.id})`);
  }

  console.log(`\n✨ [SEED] Experience Portals seeding complete!\n`);
}

// Execute if run directly
if (process.argv[1]?.includes('seed-experience-portals')) {
  const orgArg = process.argv[2] || 'smartsapp-hq';
  seedExperiencePortals(orgArg)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ [SEED] Error seeding portals:', err);
      process.exit(1);
    });
}
