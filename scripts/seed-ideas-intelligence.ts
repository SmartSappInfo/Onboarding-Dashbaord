/**
 * Seed & Backfill CLI Script for Phase 6: Idea Intelligence Studio
 *
 * Scans existing notes tagged as 'idea' or with knowledgeType === 'idea',
 * and initializes structured Idea entities with assumptions, hypotheses, and ICE scores.
 *
 * Usage:
 *   npx tsx scripts/seed-ideas-intelligence.ts <workspaceId> [authorId]
 */

import { adminDb } from '../src/lib/firebase-admin';
import { calculateIceScore } from '../src/lib/quick-notes-domain';
import { type Idea, type IdeaAssumption, type IdeaHypothesis } from '../src/lib/quick-notes-types';

async function main() {
  const workspaceId = process.argv[2];
  const authorId = process.argv[3] || 'system-admin';

  if (!workspaceId) {
    console.error('Error: workspaceId is required. Usage: npx tsx scripts/seed-ideas-intelligence.ts <workspaceId> [authorId]');
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`Starting Idea Intelligence Seeding for workspace: ${workspaceId}`);
  console.log(`======================================================\n`);

  // 1. Scan for existing idea notes
  const notesSnap = await adminDb
    .collection('quick_notes')
    .where('workspaceId', '==', workspaceId)
    .where('knowledgeType', '==', 'idea')
    .get();

  console.log(`Found ${notesSnap.size} existing notes with knowledgeType === 'idea'.`);

  let backfilledCount = 0;
  const now = new Date().toISOString();

  for (const doc of notesSnap.docs) {
    const noteData = doc.data();

    // Check if an Idea already exists for this note
    const existingIdeaSnap = await adminDb
      .collection('ideas')
      .where('workspaceId', '==', workspaceId)
      .where('knowledgeObjectId', '==', doc.id)
      .limit(1)
      .get();

    if (!existingIdeaSnap.empty) {
      console.log(`- Note "${noteData.title}" already linked to Idea ${existingIdeaSnap.docs[0].id}. Skipping.`);
      continue;
    }

    const defaultAssumptions: IdeaAssumption[] = [
      {
        id: `assump-${Date.now()}-1`,
        statement: 'Target audience actively encounters this friction on a weekly basis.',
        riskLevel: 'high',
        status: 'untested',
        evidenceIds: [],
        createdAt: now,
      },
    ];

    const defaultHypotheses: IdeaHypothesis[] = [
      {
        id: `hypo-${Date.now()}-1`,
        statement: `If we implement ${noteData.title}, then engagement increases by 20%, because it removes user friction.`,
        action: `Deploy prototype for ${noteData.title}`,
        expectedOutcome: '+20% engagement metric',
        status: 'draft',
        evidenceIds: [],
        createdAt: now,
      },
    ];

    const impact = 8;
    const effort = 4;
    const confidence = 6;
    const iceScore = calculateIceScore(impact, effort, confidence);

    const ideaRef = adminDb.collection('ideas').doc();
    const newIdea: Idea = {
      id: ideaRef.id,
      workspaceId,
      knowledgeObjectId: doc.id,
      title: noteData.title || 'Untitled Idea',
      summary: noteData.plainText?.slice(0, 150) || '',
      problem: noteData.plainText || '',
      proposedSolution: 'Solution drafted in initial capture note.',
      targetAudience: noteData.links || {},
      assumptions: defaultAssumptions,
      hypotheses: defaultHypotheses,
      experiments: [],
      decisions: [],
      evidenceIds: [],
      impact,
      effort,
      confidence,
      iceScore,
      validationStatus: 'unvalidated',
      lifecycleStage: 'captured',
      priority: 'medium',
      tags: noteData.tags || ['idea'],
      relatedIdeaIds: [],
      createdBy: noteData.authorId || authorId,
      createdByName: noteData.authorName || 'Admin User',
      createdAt: noteData.createdAt || now,
      updatedAt: now,
    };

    await ideaRef.set(newIdea);
    backfilledCount++;
    console.log(`+ Backfilled Idea "${newIdea.title}" (${newIdea.id})`);
  }

  // 2. If no ideas existed, create demo seed ideas
  if (notesSnap.empty) {
    console.log('\nCreating demo showcase ideas for Idea Intelligence Studio...');

    const demoIdeas: Array<Omit<Idea, 'id' | 'createdAt' | 'updatedAt'>> = [
      {
        workspaceId,
        knowledgeObjectId: `demo-note-1`,
        title: 'Automated WhatsApp Admissions Concierge',
        summary: 'Instant automated WhatsApp assistant to guide prospective parents through the admission application flow.',
        problem: 'Parents drop off during online registration forms due to complex document upload steps.',
        proposedSolution: 'Interactive 5-step conversational WhatsApp bot that collects photos of student birth certificates and sends real-time confirmations.',
        impact: 9,
        effort: 4,
        confidence: 8,
        iceScore: 18.0, // Quick Win!
        validationStatus: 'validated',
        lifecycleStage: 'approved',
        priority: 'urgent',
        tags: ['whatsapp', 'admissions', 'automation'],
        assumptions: [
          {
            id: 'assump-demo-1',
            statement: '90%+ of prospective parents prefer WhatsApp over traditional desktop web forms.',
            riskLevel: 'medium',
            status: 'supported',
            evidenceIds: [],
            createdAt: now,
          },
          {
            id: 'assump-demo-2',
            statement: 'Document photos taken on smartphone cameras meet compliance clarity standards.',
            riskLevel: 'high',
            status: 'supported',
            evidenceIds: [],
            createdAt: now,
          },
        ],
        hypotheses: [
          {
            id: 'hypo-demo-1',
            statement: 'If we introduce WhatsApp admissions, application completion rate will rise from 42% to 75%, because friction is minimized.',
            action: 'Launch WhatsApp Concierge test on 10 prospective schools',
            expectedOutcome: '75% completion rate',
            metricTarget: '+33% completion rate',
            status: 'proven',
            evidenceIds: [],
            createdAt: now,
          },
        ],
        experiments: [
          {
            id: 'exp-demo-1',
            name: '10-School Admissions Pilot',
            description: 'Pilot test with 10 private schools during Term 1 intake.',
            status: 'completed',
            metricsTracked: 'Application completion %',
            resultsSummary: 'Completion jumped from 41% to 78%. Zero parent complaints.',
            createdAt: now,
          },
        ],
        decisions: [
          {
            id: 'dec-demo-1',
            title: 'Approved for General Production Rollout',
            rationale: 'Validated across 10 pilot schools with 78% completion rate.',
            decisionMakerId: authorId,
            decisionMakerName: 'Head of Product',
            decidedAt: now,
            status: 'approved',
          },
        ],
        evidenceIds: [],
        relatedIdeaIds: [],
        createdBy: authorId,
        createdByName: 'Lead Strategist',
      },
      {
        workspaceId,
        knowledgeObjectId: `demo-note-2`,
        title: 'Predictive Fee Defaulter Early-Warning Engine',
        summary: 'Machine learning model predicting fee defaults 30 days before deadline based on historical interaction patterns.',
        problem: 'School finance managers only discover delinquent accounts after term ends, causing severe cash flow crunches.',
        proposedSolution: 'AI-driven risk scoring identifying high-risk accounts and triggering automated early reminder plans.',
        impact: 8,
        effort: 7,
        confidence: 6,
        iceScore: 6.9, // Strategic Bet
        validationStatus: 'testing',
        lifecycleStage: 'validating',
        priority: 'high',
        tags: ['finance', 'ai', 'retention'],
        assumptions: [
          {
            id: 'assump-demo-3',
            statement: 'Historical SMS response lag correlates strongly with delayed tuition payments.',
            riskLevel: 'critical',
            status: 'validating',
            evidenceIds: [],
            createdAt: now,
          },
        ],
        hypotheses: [
          {
            id: 'hypo-demo-2',
            statement: 'If school managers receive risk alerts 30 days early, default rates decrease by 35%, because early payment plans can be arranged.',
            action: 'Run predictive model on 5,000 past student accounts',
            expectedOutcome: '35% reduction in bad debt',
            metricTarget: '-35% tuition default rate',
            status: 'testing',
            evidenceIds: [],
            createdAt: now,
          },
        ],
        experiments: [],
        decisions: [],
        evidenceIds: [],
        relatedIdeaIds: [],
        createdBy: authorId,
        createdByName: 'Data Science Lead',
      },
      {
        workspaceId,
        knowledgeObjectId: `demo-note-3`,
        title: 'Virtual VR Graduation Ceremony Broadcasts',
        summary: '3D Metaverse live stream for overseas relatives during annual school graduation events.',
        problem: 'Overseas grandparents and family cannot attend physical graduation in person.',
        proposedSolution: '360-degree VR camera live stream accessible via Oculus and mobile browsers.',
        impact: 5,
        effort: 8,
        confidence: 3,
        iceScore: 1.9, // Hard Slog
        validationStatus: 'unvalidated',
        lifecycleStage: 'exploring',
        priority: 'low',
        tags: ['vr', 'events'],
        assumptions: [
          {
            id: 'assump-demo-4',
            statement: 'Schools have sufficient internet bandwidth (100Mbps+) to broadcast 4K 360 streams.',
            riskLevel: 'critical',
            status: 'untested',
            evidenceIds: [],
            createdAt: now,
          },
        ],
        hypotheses: [],
        experiments: [],
        decisions: [],
        evidenceIds: [],
        relatedIdeaIds: [],
        createdBy: authorId,
        createdByName: 'Innovation Intern',
      },
    ];

    for (const demo of demoIdeas) {
      const docRef = adminDb.collection('ideas').doc();
      const ideaRecord: Idea = {
        ...demo,
        id: docRef.id,
        createdAt: now,
        updatedAt: now,
      };
      await docRef.set(ideaRecord);
      backfilledCount++;
      console.log(`+ Created demo Idea: "${ideaRecord.title}" (${ideaRecord.id}) [Quadrant: ${ideaRecord.impact >= 6 && ideaRecord.effort <= 5 ? 'Quick Win' : ideaRecord.impact >= 6 ? 'Strategic Bet' : 'Hard Slog'}]`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`Seeding complete! Successfully initialized ${backfilledCount} Ideas.`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
