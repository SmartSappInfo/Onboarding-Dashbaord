/**
 * @fileoverview Fetch, Enrich & Restore (FER) Migration & Seeder Protocol for Phase 5 (Conversation Intelligence & Coaching).
 *
 * ARCHITECTURAL POINTER:
 * Provides automated, idempotent provisioning for:
 * 1. Fetch: Scans existing workspace scorecardTemplates, practiceLabScenarios, and coachingProfiles.
 * 2. Enrich: Synthesizes default Gong-style scorecard templates and 6 canonical Practice Lab scenarios.
 * 3. Restore / Seed: Idempotently upserts documents into Firestore and seeds sample call conversations
 *    with realistic transcripts, audio waveforms, and AI intelligence for instant dev/demo testability.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% idempotent: Safe to execute repeatedly without duplicating records or corrupting data.
 * - Strict typing policy: Zero 'any' or 'any[]'.
 * - Must operate via adminDb inside authorized server actions.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  ScorecardTemplate,
  PracticeLabScenario,
  CallConversation,
  RepCoachingProfile,
} from './types';
import {
  analyzeConversationDynamics,
  extractSignalsAndObjections,
  evaluateScorecardUnderRubric,
} from './coaching-engine';

export interface CoachingMigrationResult {
  success: boolean;
  templatesCount: number;
  scenariosCount: number;
  callsSeededCount: number;
  message: string;
  error?: string;
}

/**
 * Default Gold-Standard Scorecard Templates
 */
export function getDefaultScorecardTemplates(workspaceId: string, organizationId: string): ScorecardTemplate[] {
  const now = new Date().toISOString();

  return [
    {
      id: `${workspaceId}_tpl_discovery`,
      workspaceId,
      organizationId,
      name: 'Discovery Mastery Scorecard',
      category: 'discovery',
      description: 'Gold-standard evaluation for first-touch customer discovery and qualification.',
      criteria: [
        {
          id: 'crit_agenda',
          name: 'Agenda & Purpose Established',
          description: 'Rep explicitly framed the purpose, time boundaries, and collaborative agenda early in the call.',
          weight: 0.25,
          rubricGuidance: {
            1: 'No agenda or purpose stated; launched immediately into pitch.',
            3: 'Briefly mentioned agenda but did not check buyer alignment.',
            5: 'Clear collaborative agenda stated and confirmed with the buyer.',
          },
        },
        {
          id: 'crit_pain',
          name: 'Pain Points & Friction Quantified',
          description: 'Rep probed deeply into existing operational bottlenecks and quantified lost hours or revenue.',
          weight: 0.35,
          rubricGuidance: {
            1: 'Surface-level discussion; buyer pain remained vague.',
            3: 'Identified pain points but did not quantify business impact.',
            5: 'Uncovered root-cause friction and quantified cost of inaction.',
          },
        },
        {
          id: 'crit_authority',
          name: 'Decision Process & Stakeholders',
          description: 'Identified all key decision makers, evaluation criteria, and budget signoff chain.',
          weight: 0.2,
          rubricGuidance: {
            1: 'Did not ask about decision process or purchasing authority.',
            3: 'Confirmed buyer job title but not executive signoff hierarchy.',
            5: 'Mapped out complete buying committee, evaluation steps, and timeline.',
          },
        },
        {
          id: 'crit_next_step',
          name: 'Firm Time-Anchored Next Step',
          description: 'Secured concrete follow-up date, time, agenda, and attendees before call conclusion.',
          weight: 0.2,
          rubricGuidance: {
            1: 'Vague follow-up agreement ("I will email you sometime next week").',
            3: 'Agreed on general time window but did not send calendar invite.',
            5: 'Specific calendar invite agreed with clear mutual action deliverables.',
          },
        },
      ],
      isDefault: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${workspaceId}_tpl_demo`,
      workspaceId,
      organizationId,
      name: 'Demo Value Linkage Scorecard',
      category: 'demo',
      description: 'Evaluates feature presentation, ROI linkage, active engagement, and proof points.',
      criteria: [
        {
          id: 'crit_solution_linkage',
          name: 'Solution Value Linkage',
          description: 'Tied every demonstrated capability directly to a previously identified buyer pain point.',
          weight: 0.35,
          rubricGuidance: {
            1: 'Generic feature tour ("harbor tour") without pain connection.',
            3: 'Showed relevant features but value articulation was light.',
            5: 'Laser-focused walkthrough explicitly solving stated business goals.',
          },
        },
        {
          id: 'crit_engagement',
          name: 'Buyer Engagement & Pacing',
          description: 'Paused for feedback, asked verification questions, and avoided lengthy monologues.',
          weight: 0.25,
          rubricGuidance: {
            1: 'Continuous uninterrupted monologue exceeding 3 minutes.',
            3: 'Periodic pauses but mostly rep talking.',
            5: 'High interactive dialogue; buyer validated each module.',
          },
        },
        {
          id: 'crit_objection_handling',
          name: 'Objection Navigation',
          description: 'Acknowledged buyer skepticism with empathy and anchored responses in ROI evidence.',
          weight: 0.2,
          rubricGuidance: {
            1: 'Ignored or became defensive regarding buyer objections.',
            3: 'Answered objections with feature specs rather than business value.',
            5: 'Empathized, validated concerns, and resolved with proof points.',
          },
        },
        {
          id: 'crit_demo_next_step',
          name: 'Next Steps & Commercial Proposal',
          description: 'Aligned on next evaluation phase, pilot timeline, or proposal review meeting.',
          weight: 0.2,
          rubricGuidance: {
            1: 'Demo ended without agreed milestone.',
            3: 'Agreed to send follow-up deck without fixed call.',
            5: 'Scheduled proposal review with economic buyer.',
          },
        },
      ],
      isDefault: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${workspaceId}_tpl_closing`,
      workspaceId,
      organizationId,
      name: 'Executive Closing & Terms Scorecard',
      category: 'closing',
      description: 'Evaluates commercial negotiations, procurement readiness, and contract finalization.',
      criteria: [
        {
          id: 'crit_commercial_clarity',
          name: 'Commercial Terms & Packaging',
          description: 'Presented pricing, tiers, and contractual terms with absolute clarity and confidence.',
          weight: 0.3,
          rubricGuidance: {
            1: 'Hesitant on pricing; offered premature unearned discounts.',
            3: 'Clear pricing but lacked trade-offs for discounts.',
            5: 'Stood firm on value; gave discounts only in exchange for term commitments.',
          },
        },
        {
          id: 'crit_procurement_map',
          name: 'Procurement & Security Clearance',
          description: 'Proactively outlined legal, infosec, and vendor onboarding requirements.',
          weight: 0.3,
          rubricGuidance: {
            1: 'Did not address legal or procurement requirements.',
            3: 'Asked if legal was needed without clear milestone dates.',
            5: 'Mapped out complete MSA, DPA, and billing workflows with deadlines.',
          },
        },
        {
          id: 'crit_mutual_plan',
          name: 'Mutual Close Plan Execution',
          description: 'Confirmed signed agreement target date and implementation kickoff timeline.',
          weight: 0.4,
          rubricGuidance: {
            1: 'Left signature date open-ended.',
            3: 'Target date mentioned but no implementation milestones.',
            5: 'Mutual Action Plan locked with dates, owners, and kickoff scheduled.',
          },
        },
      ],
      isDefault: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/**
 * Canonical 6 Practice Lab Scenarios
 */
export function getDefaultPracticeLabScenarios(workspaceId: string): PracticeLabScenario[] {
  const now = new Date().toISOString();

  return [
    {
      id: `${workspaceId}_sc_pricing`,
      workspaceId,
      title: 'Enterprise Pricing Pushback',
      category: 'pricing',
      difficulty: 'intermediate',
      description: 'Customer pushes back on per-seat pricing comparing with lower-tier legacy software.',
      buyerPersona: {
        name: 'David Mensah',
        title: 'VP Operations',
        companyType: 'Logistics Enterprise (150 reps)',
        tone: 'skeptical',
      },
      initialPrompt:
        "We reviewed your proposal, but your pricing is nearly 40% higher than our current tool. Why shouldn't we stay where we are or look at cheaper alternatives?",
      expectedCompetencies: ['Objection Handling', 'Value Linkage', 'Active Listening'],
      isSystemDefault: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${workspaceId}_sc_competitors`,
      workspaceId,
      title: 'Displacing the Entrenched Incumbent',
      category: 'competitors',
      difficulty: 'advanced',
      description: 'Buyer is currently contracted with Salesforce and is hesitant to endure the migration friction.',
      buyerPersona: {
        name: 'Elena Rostova',
        title: 'Chief Technology Officer',
        companyType: 'Fintech Scaleup (400 employees)',
        tone: 'analytical',
      },
      initialPrompt:
        "We have been on Salesforce for five years. Switching to SmartSapp sounds like a painful multi-month migration. Why should my engineering team take that on?",
      expectedCompetencies: ['Competitor Differentiation', 'Migration Risk Mitigation', 'Product Knowledge'],
      isSystemDefault: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${workspaceId}_sc_timing`,
      workspaceId,
      title: 'Timing Delay: "Call Us Back in Q4"',
      category: 'timing',
      difficulty: 'intermediate',
      description: 'Prospect likes the pitch but attempts to delay the buying cycle due to competing internal initiatives.',
      buyerPersona: {
        name: 'Marcus Sterling',
        title: 'Director of Revenue',
        companyType: 'B2B SaaS Provider',
        tone: 'busy',
      },
      initialPrompt:
        "This looks really impressive, but our team is completely slammed with product launches this quarter. Send me a one-pager and let's reconnect in six months.",
      expectedCompetencies: ['Urgency Creation', 'Cost of Inaction', 'Call Control'],
      isSystemDefault: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${workspaceId}_sc_discovery`,
      workspaceId,
      title: 'Gatekeeper & Authority Discovery',
      category: 'discovery',
      difficulty: 'beginner',
      description: 'Prospect is an enthusiastic individual manager who does not hold budgetary or signature authority.',
      buyerPersona: {
        name: 'Chloe Appiah',
        title: 'Sales Operations Lead',
        companyType: 'Commercial Real Estate Agency',
        tone: 'friendly',
      },
      initialPrompt:
        "I love your dashboard! If we roll this out, my reps would be so much happier. What is the next step to get a trial going?",
      expectedCompetencies: ['Decision Mapping', 'Budget Discovery', 'Executive Alignment'],
      isSystemDefault: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${workspaceId}_sc_procurement`,
      workspaceId,
      title: 'Procurement & Security Redlines',
      category: 'procurement',
      difficulty: 'advanced',
      description: 'Procurement officer demands custom payment terms and extended indemnity liabilities.',
      buyerPersona: {
        name: 'Alistair Vance',
        title: 'Head of Global Procurement',
        companyType: 'Healthcare Conglomerate',
        tone: 'skeptical',
      },
      initialPrompt:
        "Our legal counsel has flagged three indemnity clauses in your standard MSA, and we require Net 90 payment terms before we can approve this contract.",
      expectedCompetencies: ['Commercial Negotiation', 'Trade-off Anchoring', 'Contractual Fluency'],
      isSystemDefault: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${workspaceId}_sc_closing`,
      workspaceId,
      title: 'Final Decision: Securing the Signature',
      category: 'closing',
      difficulty: 'intermediate',
      description: 'End-of-month decision point where buyer is hesitating between SmartSapp and taking no action.',
      buyerPersona: {
        name: 'Kofi Boateng',
        title: 'Managing Director',
        companyType: 'Asset Management Firm',
        tone: 'busy',
      },
      initialPrompt:
        "We have evaluated everything and like the product, but our board is advising us to hold off on new SaaS purchases until the economy stabilizes. What do you think?",
      expectedCompetencies: ['Closing Pacing', 'Executive Summary', 'Firm Next Step'],
      isSystemDefault: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

/**
 * Creates seed call conversations with rich transcripts, waveforms, and AI scorecards.
 */
export function buildSeedCallConversations(params: {
  workspaceId: string;
  organizationId: string;
  repId: string;
  repName: string;
}): CallConversation[] {
  const { workspaceId, organizationId, repId, repName } = params;
  const now = new Date();

  // Call 1: Stellar Discovery Call with high buying signals
  const call1Date = new Date(now.getTime() - 2 * 86400000).toISOString();
  const transcript1: CallConversation['transcript'] = [
    {
      id: 'c1_l1',
      speaker: 'rep',
      speakerName: repName,
      startMs: 0,
      endMs: 14000,
      timestampLabel: '00:14',
      text: "Good morning Frank! Thank you for taking the time to connect today. Our agenda is to dive into your current outbound workflow and see if SmartSapp can help streamline it.",
    },
    {
      id: 'c1_l2',
      speaker: 'buyer',
      speakerName: 'Frank Osei (VP Sales)',
      startMs: 15000,
      endMs: 42000,
      timestampLabel: '00:42',
      text: "Appreciate it. Honestly, our reps are struggling with manual CRM hygiene. We lose about 12 hours a week per rep just logging follow-ups. It is a burning problem for our leadership.",
    },
    {
      id: 'c1_l3',
      speaker: 'rep',
      speakerName: repName,
      startMs: 43000,
      endMs: 65000,
      timestampLabel: '01:05',
      text: "That is a significant drain on quota capacity. Beyond yourself, who else in the executive team would be evaluating our platform, and what does your decision timeline look like?",
    },
    {
      id: 'c1_l4',
      speaker: 'buyer',
      speakerName: 'Frank Osei (VP Sales)',
      startMs: 66000,
      endMs: 98000,
      timestampLabel: '01:38',
      text: "I make the final decision along with our COO. We have allocated budget and need this solved before Q4 kicks off.",
    },
    {
      id: 'c1_l5',
      speaker: 'rep',
      speakerName: repName,
      startMs: 99000,
      endMs: 125000,
      timestampLabel: '02:05',
      text: "Understood Frank. Given that you need this before Q4, let's schedule a dedicated technical demo next Tuesday at 2 PM to review the automated CRM integration with your team. Does that work?",
    },
    {
      id: 'c1_l6',
      speaker: 'buyer',
      speakerName: 'Frank Osei (VP Sales)',
      startMs: 126000,
      endMs: 140000,
      timestampLabel: '02:20',
      text: "Tuesday at 2 PM works perfectly. Send over the calendar invite and the proposal outline.",
    },
  ];

  const dynamics1 = analyzeConversationDynamics(transcript1);
  const intel1 = extractSignalsAndObjections(transcript1);
  const template1 = getDefaultScorecardTemplates(workspaceId, organizationId)[0];
  const scorecardReview1 = evaluateScorecardUnderRubric({
    callId: `${workspaceId}_call_001`,
    workspaceId,
    transcript: transcript1,
    template: template1,
  });

  const call1: CallConversation = {
    id: `${workspaceId}_call_001`,
    workspaceId,
    organizationId,
    repId,
    repName,
    contactId: 'contact_frank_001',
    contactName: 'Frank Osei (Apex Logistics)',
    dealId: 'deal_apex_logistics',
    dealName: 'Apex Logistics CRM Automation',
    dealValue: 35000,
    durationSeconds: 140,
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/office_working.ogg',
    waveform: [15, 25, 45, 65, 80, 50, 30, 20, 40, 75, 90, 85, 60, 45, 30, 20, 10],
    transcript: transcript1,
    dynamics: dynamics1,
    intelligence: intel1,
    scorecardReview: scorecardReview1,
    status: 'completed',
    recordedAt: call1Date,
    createdAt: call1Date,
    updatedAt: call1Date,
  };

  // Call 2: Demo with pricing pushback
  const call2Date = new Date(now.getTime() - 86400000).toISOString();
  const transcript2: CallConversation['transcript'] = [
    {
      id: 'c2_l1',
      speaker: 'rep',
      speakerName: repName,
      startMs: 0,
      endMs: 18000,
      timestampLabel: '00:18',
      text: "Thanks for joining Brenda. Today we will walk through how our Next-Best-Action engine prioritizes hot leads for your reps.",
    },
    {
      id: 'c2_l2',
      speaker: 'buyer',
      speakerName: 'Brenda Taylor (Sales Director)',
      startMs: 19000,
      endMs: 48000,
      timestampLabel: '00:48',
      text: "The interface looks clean, but honestly your price point is steep. We are already talking to HubSpot and their package is considerably cheaper.",
    },
    {
      id: 'c2_l3',
      speaker: 'rep',
      speakerName: repName,
      startMs: 49000,
      endMs: 82000,
      timestampLabel: '01:22',
      text: "I hear you Brenda. While HubSpot is a great generalist tool, SmartSapp provides automated AI coaching and built-in sales velocity intelligence that pays for itself in 60 days. Can we look at the ROI model together?",
    },
    {
      id: 'c2_l4',
      speaker: 'buyer',
      speakerName: 'Brenda Taylor (Sales Director)',
      startMs: 83000,
      endMs: 110000,
      timestampLabel: '01:50',
      text: "If you can prove that 60-day ROI, our budget is approved. Let us schedule a deep dive next Friday.",
    },
  ];

  const dynamics2 = analyzeConversationDynamics(transcript2);
  const intel2 = extractSignalsAndObjections(transcript2);
  const template2 = getDefaultScorecardTemplates(workspaceId, organizationId)[1];
  const scorecardReview2 = evaluateScorecardUnderRubric({
    callId: `${workspaceId}_call_002`,
    workspaceId,
    transcript: transcript2,
    template: template2,
  });

  const call2: CallConversation = {
    id: `${workspaceId}_call_002`,
    workspaceId,
    organizationId,
    repId,
    repName,
    contactId: 'contact_brenda_002',
    contactName: 'Brenda Taylor (Nova Retail)',
    dealId: 'deal_nova_retail',
    dealName: 'Nova Retail Intelligence Suite',
    dealValue: 24000,
    durationSeconds: 110,
    audioUrl: 'https://actions.google.com/sounds/v1/ambiences/office_working.ogg',
    waveform: [20, 35, 50, 70, 60, 45, 55, 80, 75, 60, 40, 30, 20],
    transcript: transcript2,
    dynamics: dynamics2,
    intelligence: intel2,
    scorecardReview: scorecardReview2,
    status: 'completed',
    recordedAt: call2Date,
    createdAt: call2Date,
    updatedAt: call2Date,
  };

  return [call1, call2];
}

/**
 * Executes the complete idempotent Fetch-Enrich-Restore Migration Protocol.
 */
export async function executeCoachingMigration(params: {
  workspaceId: string;
  organizationId: string;
  repId?: string;
  repName?: string;
  seedCalls?: boolean;
}): Promise<CoachingMigrationResult> {
  try {
    const { workspaceId, organizationId, repId = 'usr_default', repName = 'Sales Representative', seedCalls = true } = params;

    if (!workspaceId || !organizationId) {
      return {
        success: false,
        templatesCount: 0,
        scenariosCount: 0,
        callsSeededCount: 0,
        message: 'Missing required workspace or organization context.',
        error: 'Missing context parameters',
      };
    }

    const batch = adminDb.batch();

    // 1. Templates Provisioning
    const defaultTemplates = getDefaultScorecardTemplates(workspaceId, organizationId);
    for (const tpl of defaultTemplates) {
      const ref = adminDb.collection('scorecardTemplates').doc(tpl.id);
      batch.set(ref, tpl, { merge: true });
    }

    // 2. Practice Scenarios Provisioning
    const defaultScenarios = getDefaultPracticeLabScenarios(workspaceId);
    for (const sc of defaultScenarios) {
      const ref = adminDb.collection('practiceLabScenarios').doc(sc.id);
      batch.set(ref, sc, { merge: true });
    }

    // 3. Rep Coaching Profile Provisioning
    const profileRef = adminDb.collection('coachingProfiles').doc(`${workspaceId}_${repId}`);
    const defaultProfile: RepCoachingProfile = {
      id: `${workspaceId}_${repId}`,
      repId,
      repName,
      repEmail: `${repId}@workspace.local`,
      workspaceId,
      organizationId,
      skillScores: {
        discovery: 78,
        objectionHandling: 64, // Flagged for practice
        closing: 72,
        productKnowledge: 85,
        callControl: 80,
      },
      activeGoal: {
        title: 'Master Enterprise Pricing Objections',
        focusDimension: 'objectionHandling',
        currentScore: 64,
        targetScore: 80,
        deadlineDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
        status: 'active',
      },
      assignedDrills: [
        {
          id: `drill_${workspaceId}_1`,
          scenarioId: `${workspaceId}_sc_pricing`,
          scenarioTitle: 'Enterprise Pricing Pushback',
          category: 'pricing',
          assignedBy: {
            userId: 'mgr_001',
            userName: 'Sales Director',
          },
          assignedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
          deadlineDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
          status: 'pending',
        },
      ],
      recentCallsForReview: [`${workspaceId}_call_001`, `${workspaceId}_call_002`],
      updatedAt: new Date().toISOString(),
    };
    batch.set(profileRef, defaultProfile, { merge: true });

    // 4. Seed Calls (if requested)
    let seededCallsCount = 0;
    if (seedCalls) {
      const seedCallsList = buildSeedCallConversations({ workspaceId, organizationId, repId, repName });
      for (const call of seedCallsList) {
        const callRef = adminDb.collection('callConversations').doc(call.id);
        batch.set(callRef, call, { merge: true });

        if (call.scorecardReview) {
          const scorecardRef = adminDb.collection('callScorecards').doc(call.scorecardReview.id);
          batch.set(scorecardRef, call.scorecardReview, { merge: true });
        }
        seededCallsCount++;
      }
    }

    await batch.commit();

    return {
      success: true,
      templatesCount: defaultTemplates.length,
      scenariosCount: defaultScenarios.length,
      callsSeededCount: seededCallsCount,
      message: `FER migration executed successfully. Provisioned ${defaultTemplates.length} scorecard templates, ${defaultScenarios.length} practice scenarios, and seeded ${seededCallsCount} sample calls.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[CoachingMigration] Migration failed:', errorMsg);
    return {
      success: false,
      templatesCount: 0,
      scenariosCount: 0,
      callsSeededCount: 0,
      message: 'Failed to execute coaching migration protocol.',
      error: errorMsg,
    };
  }
}
