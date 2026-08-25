/**
 * {{Org_name}} Experience Platform — Seed Portal Onboarding & Tasks
 *
 * Seeds onboarding flows and daily bursary drills into the Academy portal.
 *
 * Usage:
 *   npx tsx src/app/seeds/seed-portal-engagement.ts [orgId]
 */

import { adminDb } from '@/lib/firebase-admin';
import { EngagementService } from '@/lib/services/engagement-service';

export async function seedPortalEngagement(targetOrgId: string = 'smartsapp-hq') {
  console.log(`\n🚀 [SEED] Starting Portal Onboarding & Tasks seed for org: ${targetOrgId}...`);

  // Find Academy portal
  const academySnap = await adminDb
    .collection('portals')
    .where('organizationId', '==', targetOrgId)
    .where('slug', '==', 'academy')
    .limit(1)
    .get();

  if (academySnap.empty) {
    console.log('ℹ️ [SEED] Academy portal not found. Please run seed-experience-portals.ts first.');
    return;
  }

  const academyPortal = academySnap.docs[0].data();
  const portalId = academyPortal.id;
  const workspaceIds = academyPortal.workspaceIds || ['onboarding'];

  // 1. Seed Onboarding Flow
  const flow = await EngagementService.saveOnboardingFlow({
    organizationId: targetOrgId,
    portalId,
    workspaceIds,
    title: 'School Leader & Bursar Onboarding Program',
    description: 'Complete these five orientation milestones to activate automated fee recovery.',
    steps: EngagementService.getDefaultOnboardingSteps(),
    isEnabled: true,
    completionPoints: 25,
  });
  console.log(`✅ [SEED] Configured Onboarding Flow (${flow.steps.length} Steps)`);

  // 2. Seed Daily Action Tasks
  await EngagementService.createTask({
    organizationId: targetOrgId,
    portalId,
    workspaceIds,
    title: 'Audit Term 1 Overdue Fee Accounts',
    description: 'Export uncollected student billing reports and categorize outstanding debts into 30-day and 60-day aging buckets.',
    priority: 'urgent',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    pointsReward: 20,
    order: 1,
  });

  await EngagementService.createTask({
    organizationId: targetOrgId,
    portalId,
    workspaceIds,
    title: 'Configure 3-Touch WhatsApp Fee Recovery Sequence',
    description: 'Link your bursary settlement bank account and setup pre-due date payment reminders.',
    priority: 'high',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    pointsReward: 15,
    order: 2,
  });

  await EngagementService.createTask({
    organizationId: targetOrgId,
    portalId,
    workspaceIds,
    title: 'Post Term 1 Collection Milestone in Community',
    description: 'Share your school percentage recovery win in the #wins-celebrations channel.',
    priority: 'medium',
    pointsReward: 10,
    order: 3,
  });

  console.log(`✅ [SEED] Seeded 3 Daily Action Tasks`);
  console.log(`\n✨ [SEED] Portal Onboarding & Tasks seeding complete!\n`);
}

// Execute if run directly
if (process.argv[1]?.includes('seed-portal-engagement')) {
  const orgArg = process.argv[2] || 'smartsapp-hq';
  seedPortalEngagement(orgArg)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ [SEED] Error seeding engagement:', err);
      process.exit(1);
    });
}
