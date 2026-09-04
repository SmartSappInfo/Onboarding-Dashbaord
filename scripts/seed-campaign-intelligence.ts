/**
 * Seed & Migration CLI Script for Campaign & Deal Intelligence (Company Brain Phase 8).
 *
 * Populates showcase demo items in Campaign Concepts and Objection Battlecards.
 *
 * Usage:
 *   npx tsx scripts/seed-campaign-intelligence.ts [workspaceId]
 */

import { adminDb } from '../src/lib/firebase-admin';
import {
  CAMPAIGN_CONCEPTS_COLLECTION,
  OBJECTION_BATTLECARDS_COLLECTION,
  type CampaignConcept,
  type ObjectionBattlecard,
} from '../src/lib/quick-notes-types';

const DEFAULT_WORKSPACE_ID = 'default';

async function seedCampaignIntelligence() {
  const workspaceId = process.argv[2] || DEFAULT_WORKSPACE_ID;
  console.log(`\n🌱 Seeding Phase 8 Campaign & Deal Intelligence for workspace: [${workspaceId}]...`);

  const now = new Date().toISOString();

  // 1. Seed Campaign Concepts
  const concepts: Array<Omit<CampaignConcept, 'id'>> = [
    {
      workspaceId,
      title: 'Term 1 Automated Tuition Recovery Blitz',
      targetAudience: 'Private School Heads, Proprietors & Bursars',
      targetPersonaSummary: 'Overworked school administrators struggling with 15-25% unpaid term tuition who want dignified, automated fee collection.',
      valueProposition: 'Recover 92% of overdue school fees in 14 days without painful confrontational phone calls.',
      valuePillars: [
        'Direct Mobile Money payment links on WhatsApp',
        'Instant automated receipts to parents and bursars',
        'Zero manual bank statement reconciliation',
      ],
      coreMessageHook: 'What if your school collected 90% of outstanding term fees without making a single awkward phone call?',
      objectionRebuttals: [
        {
          id: 'reb-1',
          objection: 'Parents will ignore WhatsApp messages or suspect fraud.',
          rebuttal: 'Every reminder is branded with your school logo, official SMS sender ID, and secured Mobile Money checkout.',
          counterProofPoints: ['Over 120,000 verified school payments processed', 'Official WhatsApp Green Badge verified sender'],
          frequencyCount: 14,
          sourceQuotes: ['Parents often question unverified payment links sent from personal phone numbers.'],
          confidence: 0.94,
        },
        {
          id: 'reb-2',
          objection: 'Our current accounting software already sends basic SMS.',
          rebuttal: 'Traditional SMS requires parents to visit a bank branch; SmartSapp includes 1-click Momo payment right inside the message.',
          counterProofPoints: ['4.2x higher immediate settlement rate', 'Direct Momo STK push prompt'],
          frequencyCount: 9,
          sourceQuotes: ['SMS reminders have low conversion because parents still have to go stand in bank queues.'],
          confidence: 0.88,
        },
      ],
      recommendedChannels: ['whatsapp', 'sms'],
      callToAction: 'Book a 15-minute live fee recovery demo for your school board.',
      sourceIdeaTitle: 'Automated WhatsApp Fee Collection',
      sourceKnowledgeIds: ['note-fee-recovery-1', 'note-fee-recovery-2'],
      status: 'approved',
      relevanceScore: 95,
      createdBy: 'seed_script',
      createdAt: now,
      updatedAt: now,
    },
    {
      workspaceId,
      title: 'New Term Admissions Enrollment Booster',
      targetAudience: 'Admissions Directors & School Principals',
      targetPersonaSummary: 'Competitive private schools seeking to boost new student enrollment inquiries ahead of the academic term.',
      valueProposition: 'Convert 3x more parent website & QR inquiries into paid entrance exams using instant WhatsApp conversational bots.',
      valuePillars: [
        'Instant 24/7 admission brochure delivery on WhatsApp',
        'Automated entrance exam registration & fee collection',
        'Real-time parent follow-up dashboard for admissions teams',
      ],
      coreMessageHook: 'Don’t lose prospective parents to slow email replies. Engage prospective families in 3 seconds.',
      objectionRebuttals: [
        {
          id: 'reb-adm-1',
          objection: 'We prefer personal face-to-face interviews for admissions.',
          rebuttal: 'SmartSapp doesn’t replace personal interviews; it schedules and confirms them automatically so parents actually show up.',
          counterProofPoints: ['38% reduction in interview no-show rates', 'Automated calendar sync'],
          frequencyCount: 11,
          sourceQuotes: ['Many parents book interview slots but forget to show up on Saturday mornings.'],
          confidence: 0.91,
        },
      ],
      recommendedChannels: ['whatsapp', 'email', 'sms'],
      callToAction: 'Get your custom school admission chatbot in 48 hours.',
      sourceIdeaTitle: 'Admissions Inquiry Bot',
      sourceKnowledgeIds: ['note-admissions-1'],
      status: 'draft',
      relevanceScore: 88,
      createdBy: 'seed_script',
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const concept of concepts) {
    const docRef = adminDb.collection(CAMPAIGN_CONCEPTS_COLLECTION).doc();
    await docRef.set({ ...concept, id: docRef.id });
    console.log(`  ✅ Seeded Campaign Concept: "${concept.title}" (${docRef.id})`);
  }

  // 2. Seed Objection Battlecards
  const battlecards: Array<Omit<ObjectionBattlecard, 'id'>> = [
    {
      workspaceId,
      topic: 'Pricing & Onboarding Setup Cost',
      category: 'pricing',
      objection: 'SmartSapp annual setup cost is beyond our current operational budget.',
      rebuttalScript: 'Most schools find that SmartSapp pays for itself in the first 30 days simply by recovering uncollected term fees and eliminating paper receipt printing costs.',
      killerQuestion: 'How many thousands of Cedis does your school currently lose each term to uncollected fees and manual receipt reconciliation?',
      proofPoints: [
        'Average school recovers GHS 38,000 in term 1 default reduction',
        'Zero setup fee when committing to annual school subscription',
        'Includes complimentary staff training and bursar certification',
      ],
      frequencyScore: 92,
      sourceNoteIds: ['note-pricing-1', 'note-pricing-2'],
      sourceQuotes: [
        'The headmaster stated they have a tight budget for third-party software this quarter.',
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      workspaceId,
      topic: 'Incumbent System / Custom Legacy Software',
      category: 'competitor',
      objection: 'We already had a local IT developer build a custom portal for our school 4 years ago.',
      rebuttalScript: 'Custom legacy systems were great for their time, but lack modern direct Mobile Money integrations and automatic WhatsApp push channels that parents use every single day.',
      killerQuestion: 'Does your custom portal automatically reconcile Ghana QR and Momo payments directly into your bank account with zero developer maintenance?',
      proofPoints: [
        'Zero server maintenance or developer retainer costs',
        'Direct bank-grade API integrations with MTN Momo and Telecel Cash',
        'Seamless data migration from legacy Excel or SQL spreadsheets in under 1 hour',
      ],
      frequencyScore: 85,
      sourceNoteIds: ['note-competitor-1'],
      sourceQuotes: [
        'Bursar mentioned they have an internal system built by a former student that crashes during peak exam week.',
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const card of battlecards) {
    const docRef = adminDb.collection(OBJECTION_BATTLECARDS_COLLECTION).doc();
    await docRef.set({ ...card, id: docRef.id });
    console.log(`  ✅ Seeded Objection Battlecard: "${card.topic}" (${docRef.id})`);
  }

  console.log(`\n🎉 Successfully seeded Phase 8 Campaign & Deal Intelligence records for workspace [${workspaceId}]!\n`);
}

seedCampaignIntelligence().catch((err) => {
  console.error('❌ Error seeding campaign intelligence:', err);
  process.exit(1);
});
