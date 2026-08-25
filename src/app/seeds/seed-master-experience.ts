/**
 * {{Org_name}} Experience Platform — Master Unified Seeder (Phases 1 – 12)
 *
 * Sequentially executes the full 12-phase domain-grounded seeding graph
 * for the flagship School Bursar & Educational Administrator Academy.
 *
 * Usage:
 *   npx tsx src/app/seeds/seed-master-experience.ts [orgId]
 */

import { adminDb } from '@/lib/firebase-admin';
import { seedExperiencePortals } from './seed-experience-portals';
import { seedPortalContent } from './seed-portal-content';
import { seedPortalMemberships } from './seed-portal-memberships';
import { seedPortalCourses } from './seed-portal-courses';
import { seedPortalCommunity } from './seed-portal-community';
import { seedPortalEngagement } from './seed-portal-engagement';
import { seedPortalEvents } from './seed-portal-events';
import { seedPortalCommerce } from './seed-portal-commerce';
import { seedPortalAiExperience } from './seed-portal-ai';
import { seedPortalAnalytics } from './seed-portal-analytics';
import { seedPortalCredentials } from './seed-portal-credentials';
import { seedPortalEnterprise } from './seed-portal-enterprise';

export async function seedMasterExperience(targetOrgId: string = 'smartsapp-hq') {
  console.log(`\n================================================================`);
  console.log(`🌟 [MASTER SEED] Starting {{Org_name}} Experience Platform Seeding`);
  console.log(`🏢 Organization ID: ${targetOrgId}`);
  console.log(`================================================================\n`);

  try {
    // ── Phase 1: Portals Core ──────────────────────────────────────────────
    console.log(`▶️ [Phase 1/12] Seeding Experience Portals Core...`);
    await seedExperiencePortals(targetOrgId);

    // ── Phase 2: PageBuilder & Content ─────────────────────────────────────
    console.log(`\n▶️ [Phase 2/12] Seeding PageBuilder & Custom Content...`);
    await seedPortalContent(targetOrgId);

    // ── Phase 3: Memberships & Tiers ───────────────────────────────────────
    console.log(`\n▶️ [Phase 3/12] Seeding Memberships, Tiers & Entitlements...`);
    await seedPortalMemberships(targetOrgId);

    // ── Phase 4: Curriculum & Learning ─────────────────────────────────────
    console.log(`\n▶️ [Phase 4/12] Seeding Courses, Modules & Quizzes...`);
    await seedPortalCourses(targetOrgId);

    // ── Phase 5: Community & Social Spaces ─────────────────────────────────
    console.log(`\n▶️ [Phase 5/12] Seeding Community Spaces, Posts & Comments...`);
    await seedPortalCommunity(targetOrgId);

    // ── Phase 6: Member Onboarding & CRM ───────────────────────────────────
    console.log(`\n▶️ [Phase 6/12] Seeding Onboarding Checklists & Activity CRM...`);
    await seedPortalEngagement(targetOrgId);

    // ── Phase 7: Live Events & Cohorts ─────────────────────────────────────
    console.log(`\n▶️ [Phase 7/12] Seeding Live Webinars, Cohort Tracks & Replays...`);
    await seedPortalEvents(targetOrgId);

    // Find the flagship Academy Portal for remaining scoped modules
    const academySnap = await adminDb
      .collection('portals')
      .where('organizationId', '==', targetOrgId)
      .where('slug', '==', 'academy')
      .limit(1)
      .get();

    if (academySnap.empty) {
      throw new Error(`Academy portal not found for organization "${targetOrgId}".`);
    }

    const academyPortal = academySnap.docs[0].data();
    const portalId = academyPortal.id;

    // ── Phase 8: Commerce & Affiliates ─────────────────────────────────────
    console.log(`\n▶️ [Phase 8/12] Seeding Orders, Affiliates & Waitlists...`);
    await seedPortalCommerce(portalId, targetOrgId);

    // ── Phase 9: AI Experience & Pedagogy Copilot ──────────────────────────
    console.log(`\n▶️ [Phase 9/12] Seeding AI RAG Knowledge Embeddings & Tutor...`);
    await seedPortalAiExperience(portalId, targetOrgId);

    // ── Phase 10: Analytics & Intelligence ─────────────────────────────────
    console.log(`\n▶️ [Phase 10/12] Seeding Analytics Snapshots & 8-Stage Funnel...`);
    await seedPortalAnalytics(portalId, targetOrgId);

    // ── Phase 11: Credentials & Interoperability ───────────────────────────
    console.log(`\n▶️ [Phase 11/12] Seeding Verifiable Certificates & Badges...`);
    await seedPortalCredentials(portalId, targetOrgId);

    // ── Phase 12: Enterprise, Scale & Marketplace ──────────────────────────
    console.log(`\n▶️ [Phase 12/12] Seeding Enterprise SSO, White-Label & Marketplace...`);
    await seedPortalEnterprise(portalId, targetOrgId);

    console.log(`\n================================================================`);
    console.log(`✅ [MASTER SEED COMPLETE] All 12 Phases Seeded Successfully!`);
    console.log(`🌐 Flagship Portal URL: /portal/bursar-academy (or /portal/academy)`);
    console.log(`🛡️ Public Verification: /portal/academy/verify/CERT-2026-8891`);
    console.log(`🎛️ Admin Studio: /admin/portals/${portalId}`);
    console.log(`================================================================\n`);
  } catch (error) {
    console.error(`\n❌ [MASTER SEED ERROR] Failed to complete master seeding:`, error);
    throw error;
  }
}

// Auto-run if executed directly via CLI
const targetOrg = process.argv[2] || 'smartsapp-hq';
seedMasterExperience(targetOrg)
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
