/**
 * Seed & Migration CLI Script for Knowledge Inbox & Insights (Company Brain Phase 7).
 *
 * Populates showcase demo items in the Knowledge Inbox (duplicates, contradictions, link suggestions)
 * and executive organizational insights in Insight Center.
 *
 * Usage:
 *   npx tsx scripts/seed-insights-inbox.ts [workspaceId]
 */

import { adminDb } from '../src/lib/firebase-admin';
import {
  KNOWLEDGE_INBOX_COLLECTION,
  KNOWLEDGE_INSIGHTS_COLLECTION,
  type KnowledgeInboxItem,
  type KnowledgeInsight,
} from '../src/lib/quick-notes-types';

const DEFAULT_WORKSPACE_ID = 'default';

async function seedInsightsAndInbox() {
  const workspaceId = process.argv[2] || DEFAULT_WORKSPACE_ID;
  console.log(`\n🌱 Seeding Phase 7 Knowledge Inbox & Insights for workspace: [${workspaceId}]...`);

  const now = new Date().toISOString();

  // 1. Seed Knowledge Inbox Items
  const inboxItems: Array<Omit<KnowledgeInboxItem, 'id'>> = [
    {
      workspaceId,
      type: 'duplicate_detection',
      status: 'pending',
      title: 'Potential Duplicate: WhatsApp Fee Reminders',
      description: 'Found high semantic similarity (93%) between "Automated Fee Reminders via WhatsApp" and "Bursar WhatsApp Collection Workflow".',
      sourceKnowledgeId: 'note-fee-reminders',
      sourceKnowledgeTitle: 'Automated Fee Reminders via WhatsApp',
      targetKnowledgeId: 'note-bursar-whatsapp',
      targetKnowledgeTitle: 'Bursar WhatsApp Collection Workflow',
      confidence: 0.93,
      evidence: [
        {
          sourceObjectId: 'note-fee-reminders',
          sourceTitle: 'Automated Fee Reminders via WhatsApp',
          sourceType: 'note',
          textSnippet: 'Schools repeatedly ask for automatic fee reminders on WhatsApp to reduce payment collection delays.',
          relevanceScore: 0.93,
        },
      ],
      duplicateDetails: {
        candidateNoteId: 'note-bursar-whatsapp',
        candidateTitle: 'Bursar WhatsApp Collection Workflow',
        candidateSnippet: 'Bursars in Greater Accra request automated WhatsApp notifications to remind parents before term deadlines.',
        similarityScore: 0.93,
        overlappingTopics: ['WhatsApp', 'Fee Reminders', 'Bursars', 'Payment Delays'],
        recommendedAction: 'merge',
      },
      createdBy: 'ai_agent:governance',
      createdAt: now,
      updatedAt: now,
    },
    {
      workspaceId,
      type: 'contradiction_detection',
      status: 'pending',
      title: 'Contradiction: School Enrollment Decision Maker',
      description: 'Conflicting statements on whether Head of IT or Bursar makes software adoption decisions.',
      sourceKnowledgeId: 'note-head-it',
      sourceKnowledgeTitle: 'Sales Call: St. Jude Academy',
      targetKnowledgeId: 'note-bursar-role',
      targetKnowledgeTitle: 'Onboarding Meeting: Heritage School',
      confidence: 0.89,
      evidence: [
        {
          sourceObjectId: 'note-head-it',
          sourceTitle: 'Sales Call: St. Jude Academy',
          sourceType: 'note',
          textSnippet: '"The Head of IT has sole authority to approve all school management software."',
          relevanceScore: 0.89,
        },
        {
          sourceObjectId: 'note-bursar-role',
          sourceTitle: 'Onboarding Meeting: Heritage School',
          sourceType: 'note',
          textSnippet: '"The Bursar explicitly stated IT only advises; finance makes the final procurement decision."',
          relevanceScore: 0.89,
        },
      ],
      contradictionDetails: {
        thesis: {
          claim: 'Head of IT has sole software approval authority.',
          sourceId: 'note-head-it',
          sourceTitle: 'Sales Call: St. Jude Academy',
          quote: 'The Head of IT has sole authority to approve all school management software.',
        },
        antithesis: {
          claim: 'Bursar / Finance holds final decision authority over IT.',
          sourceId: 'note-bursar-role',
          sourceTitle: 'Onboarding Meeting: Heritage School',
          quote: 'The Bursar explicitly stated IT only advises; finance makes the final procurement decision.',
        },
        severity: 'high',
        explanation: 'Divergent procurement authority patterns across private vs public school segments will impact sales playbooks.',
        suggestedResolution: 'Create stakeholder mapping matrix in CRM sales playbook.',
      },
      createdBy: 'ai_agent:governance',
      createdAt: now,
      updatedAt: now,
    },
    {
      workspaceId,
      type: 'link_suggestion',
      status: 'pending',
      title: 'Suggested Link: Morning Star School & WhatsApp Hub',
      description: 'Discovered high contextual relevance between Morning Star onboarding call and the WhatsApp Admissions Hub idea.',
      sourceKnowledgeId: 'note-morning-star',
      sourceKnowledgeTitle: 'Morning Star Feedback',
      targetKnowledgeId: 'idea-whatsapp-hub',
      targetKnowledgeTitle: 'Automated WhatsApp Admissions Hub',
      confidence: 0.85,
      evidence: [
        {
          sourceObjectId: 'note-morning-star',
          sourceTitle: 'Morning Star Feedback',
          sourceType: 'note',
          textSnippet: 'School administrator requested instant parent registration via WhatsApp QR codes.',
          relevanceScore: 0.85,
        },
      ],
      suggestedPatch: {
        relationType: 'supports',
        targetObjectId: 'idea-whatsapp-hub',
        targetObjectTitle: 'Automated WhatsApp Admissions Hub',
      },
      createdBy: 'ai_agent:governance',
      createdAt: now,
      updatedAt: now,
    },
  ];

  console.log(`Writing ${inboxItems.length} Knowledge Inbox items...`);
  for (const item of inboxItems) {
    const docRef = adminDb.collection(KNOWLEDGE_INBOX_COLLECTION).doc();
    await docRef.set({ ...item, id: docRef.id });
  }

  // 2. Seed Executive Knowledge Insights
  const insights: Array<Omit<KnowledgeInsight, 'id'>> = [
    {
      workspaceId,
      type: 'recurring_problem',
      severity: 'critical',
      title: 'Payment Reconciliation Delays in Mid-Sized Private Schools',
      summary: 'Bursars across 8 schools reported spending 6+ hours weekly manually reconciling momo transactions against bank statements.',
      evidenceCount: 8,
      evidenceSources: [
        {
          id: 'note-rec-1',
          title: 'Call Notes: Achimota Prep',
          type: 'call',
          quote: '"Manual bank reconciliation is taking up our entire Monday morning every week."',
          date: '2026-08-28',
        },
        {
          id: 'note-rec-2',
          title: 'Feedback: Ridge Church School',
          type: 'feedback',
          quote: '"Momo payments do not auto-match with student admission IDs, causing ledger discrepancies."',
          date: '2026-09-01',
        },
      ],
      suggestedActions: [
        {
          id: 'act-1',
          label: 'Develop Idea: 1-Click Momo Settlement Engine',
          actionType: 'create_idea',
        },
        {
          id: 'act-2',
          label: 'Assign Task: Audit Momo Reconciliation Webhook Latency',
          actionType: 'create_task',
        },
      ],
      status: 'active',
      createdBy: 'ai_agent:insight',
      createdAt: now,
      updatedAt: now,
    },
    {
      workspaceId,
      type: 'opportunity',
      severity: 'high',
      title: 'High Parent Appetite for WhatsApp Report Cards',
      summary: '14 schools observed >80% open rates when academic performance summaries were delivered via WhatsApp PDFs rather than email portal links.',
      evidenceCount: 14,
      evidenceSources: [
        {
          id: 'note-rep-1',
          title: 'Term 2 Review: DPS International',
          type: 'observation',
          quote: '"Parents rarely log in to the portal, but 95% downloaded the WhatsApp report card within 2 hours."',
          date: '2026-08-15',
        },
      ],
      suggestedActions: [
        {
          id: 'act-3',
          label: 'Create Campaign: "Ditch the Portal" WhatsApp Reports Showcase',
          actionType: 'create_campaign_concept',
        },
      ],
      status: 'active',
      createdBy: 'ai_agent:insight',
      createdAt: now,
      updatedAt: now,
    },
    {
      workspaceId,
      type: 'risk',
      severity: 'high',
      title: 'SMS Delivery Degradation during Peak Morning Broadcasts',
      summary: 'SMS failure rate spiked to 18% between 7:00 AM and 8:30 AM due to carrier throttling on shortcodes.',
      evidenceCount: 4,
      evidenceSources: [
        {
          id: 'note-sms-1',
          title: 'Incident Log: Morning Broadcast Congestion',
          type: 'research',
          quote: '"Carrier delivery receipts timed out for 420 messages sent between 07:15 and 07:45."',
          date: '2026-09-02',
        },
      ],
      suggestedActions: [
        {
          id: 'act-4',
          label: 'Task: Implement Queue Staggering for Early Morning SMS',
          actionType: 'create_task',
        },
      ],
      status: 'active',
      createdBy: 'ai_agent:insight',
      createdAt: now,
      updatedAt: now,
    },
  ];

  console.log(`Writing ${insights.length} Executive Knowledge Insights...`);
  for (const ins of insights) {
    const docRef = adminDb.collection(KNOWLEDGE_INSIGHTS_COLLECTION).doc();
    await docRef.set({ ...ins, id: docRef.id });
  }

  console.log('\n✅ Successfully seeded Phase 7 Knowledge Inbox & Insights demo records!\n');
}

seedInsightsAndInbox().catch((err) => {
  console.error('Error running seed script:', err);
  process.exit(1);
});
