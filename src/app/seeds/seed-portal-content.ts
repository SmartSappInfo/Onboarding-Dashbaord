/**
 * {{Org_name}} Experience Platform — Seed Portal Content
 *
 * Seeds flagship articles, documentation guides, curriculum lessons, and downloadable
 * resources into the seeded Academy and Documentation portals.
 *
 * Usage:
 *   npx tsx src/app/seeds/seed-portal-content.ts [orgId]
 */

import { adminDb } from '@/lib/firebase-admin';
import { ContentService } from '@/lib/services/content-service';
import type { CreateContentItemInput } from '@/lib/types/content';

async function seedPortalContent(targetOrgId: string = 'smartsapp-hq') {
  console.log(`\n🚀 [SEED] Starting Portal Content seed for organization: ${targetOrgId}...`);

  // Find Academy portal
  const academySnap = await adminDb
    .collection('portals')
    .where('organizationId', '==', targetOrgId)
    .where('slug', '==', 'academy')
    .limit(1)
    .get();

  // Find Docs portal
  const docsSnap = await adminDb
    .collection('portals')
    .where('organizationId', '==', targetOrgId)
    .where('slug', '==', 'docs')
    .limit(1)
    .get();

  const academyPortal = !academySnap.empty ? academySnap.docs[0].data() : null;
  const docsPortal = !docsSnap.empty ? docsSnap.docs[0].data() : null;

  const itemsToSeed: CreateContentItemInput[] = [];

  if (academyPortal) {
    itemsToSeed.push(
      {
        organizationId: targetOrgId,
        portalId: academyPortal.id,
        workspaceIds: academyPortal.workspaceIds || ['onboarding'],
        type: 'article',
        title: '5 Automated WhatsApp Strategies to Eliminate Late Fee Payments',
        slug: '5-automated-whatsapp-strategies-fee-recovery',
        summary: 'How leading schools use automated schedule triggers to collect 90%+ tuition on time.',
        category: 'Finance & Invoicing',
        tags: ['invoicing', 'whatsapp', 'automation', 'revenue'],
        status: 'published',
        visibility: 'public',
        content: `# 5 Automated WhatsApp Strategies to Eliminate Late Fee Payments

Late tuition payments create severe cash flow bottlenecks for school administrators. By migrating from manual paper slips to multi-tier automated WhatsApp sequences, bursars can achieve on-time compliance with zero confrontation.

## 1. The Pre-Term Friendly Notice (7 Days Prior)
Send a personalized reminder confirming the upcoming term start date, child's enrolled class, and the exact invoice balance with a direct mobile money link.

## 2. Instant USSD & Momo Reconciliation
Allow parents to tap directly on a dynamic payment link that auto-fills their child's student identification code.

## 3. Grace Period Follow-Up
Send gentle reminders 3 days after the due date with flexible installment options if approved by the headmaster.`,
      },
      {
        organizationId: targetOrgId,
        portalId: academyPortal.id,
        workspaceIds: academyPortal.workspaceIds || ['onboarding'],
        type: 'resource',
        title: 'Tuition Fee Recovery Spreadsheet Model (Auto-Formulas)',
        slug: 'tuition-fee-recovery-spreadsheet-model',
        summary: 'Pre-built financial workbook for tracking student billing batches, arrears, and collection KPIs.',
        category: 'Worksheets & Models',
        tags: ['spreadsheet', 'excel', 'finance', 'toolkit'],
        status: 'published',
        visibility: 'public',
        media: {
          downloadUrl: 'https://example.com/downloads/fee-recovery-model.xlsx',
          fileName: 'fee-recovery-model.xlsx',
          fileSize: 1840000,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      },
      {
        organizationId: targetOrgId,
        portalId: academyPortal.id,
        workspaceIds: academyPortal.workspaceIds || ['onboarding'],
        type: 'lesson',
        title: 'Module 1: Invoicing Automation Architecture & USSD Setup',
        slug: 'module-1-invoicing-automation-ussd',
        summary: 'Step-by-step masterclass on linking school bank accounts and mobile money gateways.',
        category: 'Curriculum',
        tags: ['masterclass', 'momo', 'billing'],
        status: 'published',
        visibility: 'public',
        media: {
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          duration: 900,
        },
        content: `In this lesson, we explore the automated payment routing architecture. Follow the checklist below to connect your merchant codes.`,
      }
    );
  }

  if (docsPortal) {
    itemsToSeed.push(
      {
        organizationId: targetOrgId,
        portalId: docsPortal.id,
        workspaceIds: docsPortal.workspaceIds || ['onboarding'],
        type: 'page',
        title: 'Quickstart: Setting Up Your School Profile and Class Roster',
        slug: 'quickstart-school-profile-roster',
        summary: 'Initial configuration guide for adding school logos, campuses, grade levels, and student records.',
        category: 'Getting Started',
        tags: ['quickstart', 'roster', 'students', 'onboarding'],
        status: 'published',
        visibility: 'public',
        content: `# Quickstart: Setting Up Your School Profile and Class Roster

Welcome to SmartSapp! Follow this guide to initialize your school setup in under 10 minutes.

### Step 1: Upload School Identity & Logo
Navigate to **Settings -> School Profile** and configure your official school crest, contact numbers, and payment disclaimers.

### Step 2: Import Student & Parent Rosters
Download the CSV roster template, populate parent phone numbers, and import via the bulk roster importer.`,
      },
      {
        organizationId: targetOrgId,
        portalId: docsPortal.id,
        workspaceIds: docsPortal.workspaceIds || ['onboarding'],
        type: 'page',
        title: 'Configuring Mobile Money and Bank Account Webhooks',
        slug: 'configuring-momo-bank-webhooks',
        summary: 'Technical guide for verifying instant payment callback webhooks and real-time SMS receipts.',
        category: 'Integrations',
        tags: ['webhooks', 'momo', 'payments', 'api'],
        status: 'published',
        visibility: 'public',
        content: `# Configuring Mobile Money and Bank Account Webhooks

SmartSapp connects to MTN Mobile Money, Vodafone Cash, AirtelTigo, and commercial banks through automated API webhooks.`,
      }
    );
  }

  for (const item of itemsToSeed) {
    const existing = await adminDb
      .collection('content_items')
      .where('portalId', '==', item.portalId)
      .where('type', '==', item.type)
      .where('slug', '==', item.slug)
      .limit(1)
      .get();

    if (!existing.empty) {
      console.log(`ℹ️ [SEED] Content item "${item.title}" (/content/${item.type}/${item.slug}) already exists. Skipping.`);
      continue;
    }

    const created = await ContentService.createContentItem(item, 'system_seeder');
    console.log(`✅ [SEED] Created content item "${created.title}" [${created.type}] (ID: ${created.id})`);
  }

  console.log(`\n✨ [SEED] Portal Content seeding complete!\n`);
}

// Execute if run directly
if (process.argv[1]?.includes('seed-portal-content')) {
  const orgArg = process.argv[2] || 'smartsapp-hq';
  seedPortalContent(orgArg)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ [SEED] Error seeding portal content:', err);
      process.exit(1);
    });
}
