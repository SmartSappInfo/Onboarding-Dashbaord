/**
 * {{Org_name}} Experience Platform — Seed Portal Memberships & Plans
 *
 * Seeds flagship Membership Plans (Free, Monthly Pro, Annual VIP),
 * sample memberships, and cryptographic invitations into the Academy portal.
 *
 * Usage:
 *   npx tsx src/app/seeds/seed-portal-memberships.ts [orgId]
 */

import { adminDb } from '@/lib/firebase-admin';
import { MembershipPlanService } from '@/lib/services/membership-plan-service';
import { PortalMembershipService } from '@/lib/services/portal-membership-service';
import { PortalInvitationService } from '@/lib/services/portal-invitation-service';

export async function seedPortalMemberships(targetOrgId: string = 'smartsapp-hq') {
  console.log(`\n🚀 [SEED] Starting Portal Memberships & Plans seed for org: ${targetOrgId}...`);

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

  // 1. Seed Membership Plans
  const plansToSeed = [
    {
      organizationId: targetOrgId,
      portalId,
      workspaceIds,
      name: 'Free Community Member',
      slug: 'free-community',
      description: 'Access to public articles, community discussions, and introductory lessons.',
      price: 0,
      currency: 'USD',
      interval: 'monthly' as const,
      order: 1,
      features: [
        'Introductory Curriculum Access',
        'Help Centre & Documentation',
        'Community Forum Participation',
        'Standard Email Support',
      ],
    },
    {
      organizationId: targetOrgId,
      portalId,
      workspaceIds,
      name: 'Academy Pro Member',
      slug: 'academy-pro',
      description: 'Full access to all masterclasses, financial spreadsheet toolkits, and monthly webinars.',
      price: 29,
      currency: 'USD',
      interval: 'monthly' as const,
      badgeText: 'MOST POPULAR',
      isPopular: true,
      order: 2,
      features: [
        'Complete Invoicing & Fee Recovery Masterclass',
        'All Financial Model Spreadsheet Toolkits',
        'WhatsApp Reminder Template Packs',
        'Priority Support & Q&A Office Hours',
      ],
    },
    {
      organizationId: targetOrgId,
      portalId,
      workspaceIds,
      name: 'VIP School Executive Pass',
      slug: 'vip-executive',
      description: 'Comprehensive annual pass including 1-on-1 bursar onboarding and custom automation setup.',
      price: 299,
      currency: 'USD',
      interval: 'annual' as const,
      badgeText: 'BEST VALUE',
      order: 3,
      features: [
        'Everything in Academy Pro',
        '1-on-1 Dedicated Bursar Automation Setup',
        'Unlimited Verified Certifications',
        'Direct WhatsApp Concierge Channel',
      ],
    },
  ];

  for (const plan of plansToSeed) {
    const existing = await adminDb
      .collection('membership_plans')
      .where('portalId', '==', portalId)
      .where('slug', '==', plan.slug)
      .limit(1)
      .get();

    if (existing.empty) {
      const created = await MembershipPlanService.createPlan(plan, 'system_seeder');
      console.log(`✅ [SEED] Created Membership Plan: "${created.name}" (ID: ${created.id})`);
    } else {
      console.log(`ℹ️ [SEED] Plan "${plan.name}" already exists. Skipping.`);
    }
  }

  // 2. Seed Shareable Invitation
  const existingInv = await adminDb
    .collection('portal_invitations')
    .where('portalId', '==', portalId)
    .where('note', '==', 'Founding Member Welcome Link')
    .limit(1)
    .get();

  if (existingInv.empty) {
    const inv = await PortalInvitationService.createInvitation(
      {
        portalId,
        organizationId: targetOrgId,
        workspaceIds,
        role: 'student',
        maxUses: 50,
        note: 'Founding Member Welcome Link',
      },
      'system_seeder'
    );
    console.log(`✅ [SEED] Created Shareable Invitation: Token=${inv.token} (Uses: 0/${inv.maxUses})`);
  }

  console.log(`\n✨ [SEED] Portal Memberships & Plans seeding complete!\n`);
}

// Execute if run directly
if (process.argv[1]?.includes('seed-portal-memberships')) {
  const orgArg = process.argv[2] || 'smartsapp-hq';
  seedPortalMemberships(orgArg)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ [SEED] Error seeding memberships:', err);
      process.exit(1);
    });
}
