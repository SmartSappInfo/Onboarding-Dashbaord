'use server';

/**
 * @fileoverview Server Actions for SmartSapp Conversation Intelligence & Coaching (Phase 5).
 *
 * ARCHITECTURAL POINTER:
 * Provides secure, workspace-scoped server actions for sellers, managers, and RevOps:
 * 1. getCoachingWorkspaceAction: Fetches coaching profile, assigned drills, templates, scenarios, and recent calls.
 * 2. getCallIntelligenceDetailAction: Loads single call recording, waveform data, transcript, and scorecard reviews.
 * 3. submitManualScorecardReviewAction: Records manager/peer rubric review and awards effort points via Phase 1.
 * 4. startRoleplaySessionAction: Initializes an interactive AI Buyer practice drill.
 * 5. submitRoleplayTurnAction: Evaluates seller input, simulates buyer reply, computes 5-pillar competency on completion.
 * 6. assignCoachingDrillAction: Assigns a drill to a rep (surfacing in Phase 2 "My Day" action queue).
 * 7. getTeamCoachingOverviewAction: Manager command cockpit aggregating team skill heatmaps & coaching opportunities.
 * 8. runCoachingMigrationAction: Triggers idempotent FER provisioning for the workspace.
 * 9. saveScorecardTemplateAction: Backoffice/manager rubric authoring with weight validation.
 * 10. savePracticeScenarioAction: Backoffice scenario & buyer persona configuration.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced: Zero 'any' or 'any[]'.
 * - Must strictly scope all queries and mutations to active workspaceId.
 * - Anti-gaming: Roleplay completion and scorecard reviews award points via evaluateEffortEvent.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  CallConversation,
  ScorecardTemplate,
  PracticeLabScenario,
  CallScorecardReview,
  CriterionRating,
  RoleplaySession,
  RoleplayTurn,
  RoleplayEvaluation,
  RepCoachingProfile,
  AssignedDrillItem,
  TeamCoachingOverview,
} from '@/lib/conversation-coaching/types';
import {
  scoreRoleplayTurn,
  validateScorecardTemplateIntegrity,
  recommendNextDrill,
} from '@/lib/conversation-coaching/coaching-engine';
import {
  executeCoachingMigration,
  getDefaultPracticeLabScenarios,
} from '@/lib/conversation-coaching/migration-protocol';
import { evaluateEffortEvent } from '@/lib/scoring-performance-engine';
import { requireWorkspace } from '@/lib/auth/require-auth';

/**
 * Server Action: Retrieve full coaching workspace context for a rep/manager.
 * Automatically runs FER migration if workspace lacks templates or scenarios.
 */
export async function getCoachingWorkspaceAction(params: {
  workspaceId: string;
  organizationId: string;
  repId?: string;
  repName?: string;
}): Promise<{
  success: boolean;
  profile?: RepCoachingProfile;
  scenarios: PracticeLabScenario[];
  templates: ScorecardTemplate[];
  recentCalls: CallConversation[];
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, organizationId, repId = 'usr_default', repName = 'Sales Representative' } = params;
    if (!workspaceId || !organizationId) {
      return { success: false, scenarios: [], templates: [], recentCalls: [], error: 'Missing workspace context.' };
    }

    // 1. Fetch templates, scenarios, rep profile, and recent calls in parallel
    const [templatesSnap, scenariosSnap, profileSnap, callsSnap] = await Promise.all([
      adminDb
        .collection('scorecardTemplates')
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'active')
        .limit(20)
        .get(),
      adminDb
        .collection('practiceLabScenarios')
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'active')
        .limit(30)
        .get(),
      adminDb.collection('coachingProfiles').doc(`${workspaceId}_${repId}`).get(),
      adminDb
        .collection('callConversations')
        .where('workspaceId', '==', workspaceId)
        .orderBy('recordedAt', 'desc')
        .limit(30)
        .get(),
    ]);

    // 2. If templates or scenarios are empty, automatically run idempotent FER migration
    let templates: ScorecardTemplate[] = [];
    let scenarios: PracticeLabScenario[] = [];
    let calls: CallConversation[] = [];

    if (templatesSnap.empty || scenariosSnap.empty) {
      await executeCoachingMigration({
        workspaceId,
        organizationId,
        repId,
        repName,
        seedCalls: true,
      });

      // Refetch post-migration
      const [newTpls, newScens, newCalls] = await Promise.all([
        adminDb.collection('scorecardTemplates').where('workspaceId', '==', workspaceId).get(),
        adminDb.collection('practiceLabScenarios').where('workspaceId', '==', workspaceId).get(),
        adminDb.collection('callConversations').where('workspaceId', '==', workspaceId).orderBy('recordedAt', 'desc').limit(30).get(),
      ]);

      templates = newTpls.docs.map((d) => d.data() as ScorecardTemplate);
      scenarios = newScens.docs.map((d) => d.data() as PracticeLabScenario);
      calls = newCalls.docs.map((d) => d.data() as CallConversation);
    } else {
      templates = templatesSnap.docs.map((d) => d.data() as ScorecardTemplate);
      scenarios = scenariosSnap.docs.map((d) => d.data() as PracticeLabScenario);
      calls = callsSnap.docs.map((d) => d.data() as CallConversation);
    }

    // 3. Resolve or initialize rep coaching profile
    let profile: RepCoachingProfile;
    if (profileSnap.exists) {
      profile = profileSnap.data() as RepCoachingProfile;
    } else {
      profile = {
        id: `${workspaceId}_${repId}`,
        repId,
        repName,
        repEmail: `${repId}@workspace.local`,
        workspaceId,
        organizationId,
        skillScores: {
          discovery: 72,
          objectionHandling: 68,
          closing: 75,
          productKnowledge: 84,
          callControl: 70,
        },
        activeGoal: {
          id: 'goal_curr',
          title: 'Conquer Pricing Objections',
          focusDimension: 'objectionHandling',
          targetScore: 85,
          currentScore: 68,
          deadlineDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          status: 'active',
        },
        assignedDrills: [],
        recentCallsForReview: calls.slice(0, 3).map((c) => c.id),
        updatedAt: new Date().toISOString(),
      };
      await adminDb.collection('coachingProfiles').doc(`${workspaceId}_${repId}`).set(profile);
    }

    return {
      success: true,
      profile,
      scenarios,
      templates,
      recentCalls: calls,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[getCoachingWorkspaceAction] Error:', errorMsg);
    return {
      success: false,
      scenarios: [],
      templates: [],
      recentCalls: [],
      error: errorMsg,
    };
  }
}

/**
 * Server Action: Fetch intelligence detail for a specific call recording.
 */
export async function getCallIntelligenceDetailAction(params: {
  workspaceId: string;
  callId: string;
}): Promise<{
  success: boolean;
  call?: CallConversation;
  reviews?: CallScorecardReview[];
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, callId } = params;
    if (!workspaceId || !callId) {
      return { success: false, error: 'Missing workspaceId or callId' };
    }

    const [callDoc, reviewsSnap] = await Promise.all([
      adminDb.collection('callConversations').doc(callId).get(),
      adminDb
        .collection('callScorecards')
        .where('callId', '==', callId)
        .where('workspaceId', '==', workspaceId)
        .orderBy('reviewedAt', 'desc')
        .limit(10)
        .get(),
    ]);

    if (!callDoc.exists) {
      return { success: false, error: 'Call conversation not found' };
    }

    const call = callDoc.data() as CallConversation;
    if (call.workspaceId !== workspaceId) {
      return { success: false, error: 'Access denied to call in different workspace.' };
    }

    const reviews: CallScorecardReview[] = reviewsSnap.docs.map((d) => d.data() as CallScorecardReview);

    return {
      success: true,
      call,
      reviews,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[getCallIntelligenceDetailAction] Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Submit a manual/manager scorecard review for a call.
 * Automatically computes weighted score and awards +15 effort points via Phase 1.
 */
export async function submitManualScorecardReviewAction(params: {
  workspaceId: string;
  organizationId: string;
  callId: string;
  templateId: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: 'manager' | 'peer' | 'self';
  ratings: CriterionRating[];
  keyStrengths: string[];
  growthAreas: string[];
  notes?: string;
}): Promise<{
  success: boolean;
  review?: CallScorecardReview;
  pointsAwarded?: number;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const {
      workspaceId,
      organizationId,
      callId,
      templateId,
      evaluatorId,
      evaluatorName,
      evaluatorRole,
      ratings,
      keyStrengths,
      growthAreas,
      notes,
    } = params;

    if (!workspaceId || !callId || !templateId || !evaluatorId) {
      return { success: false, error: 'Missing required evaluation fields.' };
    }

    // 1. Fetch Call & Template
    const [callDoc, templateDoc] = await Promise.all([
      adminDb.collection('callConversations').doc(callId).get(),
      adminDb.collection('scorecardTemplates').doc(templateId).get(),
    ]);

    if (!callDoc.exists || !templateDoc.exists) {
      return { success: false, error: 'Call conversation record or scorecard template not found.' };
    }

    const call = callDoc.data() as CallConversation;
    if (call.workspaceId !== workspaceId) {
      return { success: false, error: 'Workspace mismatch.' };
    }

    // 2. Compute weighted score percentage
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const r of ratings) {
      const weight = typeof r.weight === 'number' && r.weight > 0 ? r.weight : 1 / (ratings.length || 1);
      totalWeightedScore += (r.score / 5) * weight;
      totalWeight += weight;
    }

    const totalScorePercent = totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight) * 100) : 75;

    // 3. Construct Review Object
    const reviewId = `rev_${callId}_${Date.now()}`;
    const review: CallScorecardReview = {
      id: reviewId,
      callId,
      templateId,
      workspaceId,
      evaluatedBy: evaluatorRole,
      evaluatorId,
      evaluatorName,
      totalScorePercent,
      ratings,
      keyStrengths: keyStrengths.length > 0 ? keyStrengths : ['Structured pacing', 'Clear articulation'],
      growthAreas: growthAreas.length > 0 ? growthAreas : ['Probe deeper on budget authority'],
      notes: notes || undefined,
      reviewedAt: new Date().toISOString(),
    };

    // 4. Save Review and update Call record
    const batch = adminDb.batch();
    const reviewRef = adminDb.collection('callScorecards').doc(reviewId);
    batch.set(reviewRef, review);

    const callRef = adminDb.collection('callConversations').doc(callId);
    batch.update(callRef, {
      scorecardReview: review,
      status: 'completed',
    });

    await batch.commit();

    // 5. Award effort points (+15 pts for call review under anti-gaming policy)
    const effortRes = await evaluateEffortEvent({
      organizationId,
      workspaceId,
      eventType: 'call_reviewed',
      entityType: 'Coaching',
      entityId: callId,
      actorType: 'User',
      actorId: evaluatorId,
      metadata: {
        callId,
        scorePercent: totalScorePercent,
        evaluatorRole,
        evaluatorName,
      },
    });

    return {
      success: true,
      review,
      pointsAwarded: effortRes.pointsAwarded,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[submitManualScorecardReviewAction] Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Initialize a new interactive AI Buyer Practice Lab session.
 */
export async function startRoleplaySessionAction(params: {
  workspaceId: string;
  organizationId: string;
  repId: string;
  repName: string;
  scenarioId: string;
}): Promise<{
  success: boolean;
  session?: RoleplaySession;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, organizationId, repId, repName, scenarioId } = params;
    if (!workspaceId || !repId || !scenarioId) {
      return { success: false, error: 'Missing required session parameters.' };
    }

    // 1. Fetch scenario
    const scenDoc = await adminDb.collection('practiceLabScenarios').doc(scenarioId).get();
    let scenario: PracticeLabScenario;

    if (scenDoc.exists) {
      scenario = scenDoc.data() as PracticeLabScenario;
    } else {
      // Fallback to default scenario
      const defaults = getDefaultPracticeLabScenarios(workspaceId);
      scenario = defaults.find((s) => s.id === scenarioId) || defaults[0];
    }

    // 2. Build initial session with buyer opening statement
    const sessionId = `sess_${workspaceId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const initialTurn: RoleplayTurn = {
      id: `turn_0_${Date.now()}`,
      speaker: 'ai_buyer',
      text: scenario.initialPrompt,
      message: scenario.initialPrompt,
      timestamp: new Date().toISOString(),
    };

    const newSession: RoleplaySession = {
      id: sessionId,
      repId,
      repName,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      workspaceId,
      organizationId,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      dialogue: [initialTurn],
    };

    await adminDb.collection('practiceLabSessions').doc(sessionId).set(newSession);

    return {
      success: true,
      session: newSession,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[startRoleplaySessionAction] Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Submit a seller response turn in the Practice Lab.
 * Uses coaching-engine.ts to evaluate the response and simulate buyer reply.
 * On turn >= 6 or buyer satisfied, completes session and awards +25 effort points.
 */
export async function submitRoleplayTurnAction(params: {
  workspaceId: string;
  organizationId: string;
  sessionId: string;
  repMessage: string;
}): Promise<{
  success: boolean;
  session?: RoleplaySession;
  isCompleted?: boolean;
  evaluation?: RoleplayEvaluation;
  pointsAwarded?: number;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, organizationId, sessionId, repMessage } = params;
    if (!workspaceId || !sessionId || !repMessage.trim()) {
      return { success: false, error: 'Missing turn message or session ID.' };
    }

    // 1. Fetch Session
    const sessionDoc = await adminDb.collection('practiceLabSessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      return { success: false, error: 'Practice session not found.' };
    }

    const session = sessionDoc.data() as RoleplaySession;
    if (session.workspaceId !== workspaceId) {
      return { success: false, error: 'Workspace mismatch.' };
    }

    if (session.status === 'completed') {
      return { success: false, session, isCompleted: true, evaluation: session.evaluation, error: 'Session already completed.' };
    }

    // 2. Fetch Scenario
    const scenDoc = await adminDb.collection('practiceLabScenarios').doc(session.scenarioId).get();
    let scenario: PracticeLabScenario;
    if (scenDoc.exists) {
      scenario = scenDoc.data() as PracticeLabScenario;
    } else {
      const defaults = getDefaultPracticeLabScenarios(workspaceId);
      scenario = defaults.find((s) => s.id === session.scenarioId) || defaults[0];
    }

    // 3. Process Rep Turn through deterministic Coaching Engine
    const now = new Date().toISOString();
    const repTurn: RoleplayTurn = {
      id: `turn_rep_${Date.now()}`,
      speaker: 'rep',
      text: repMessage.trim(),
      message: repMessage.trim(),
      timestamp: now,
    };

    const dialogueWithRep = [...session.dialogue, repTurn];
    const turnResult = scoreRoleplayTurn({ dialogue: dialogueWithRep, scenario });

    repTurn.turnFeedback = turnResult.turnFeedback;
    repTurn.coachingTip = turnResult.turnFeedback.quickTip;

    // Simulate realistic buyer response
    let buyerReply: string;
    if (turnResult.isComplete) {
      buyerReply =
        scenario.buyerPersona.tone === 'analytical'
          ? "Thank you for addressing those points with data. Let's schedule a deep-dive call with our technical team next Tuesday."
          : "That makes a lot of sense. Let's move forward and review the proposal together next week.";
    } else {
      const repTurnsCount = dialogueWithRep.filter((t) => t.speaker === 'rep').length;
      if (repTurnsCount === 1) {
        buyerReply = `I hear what you're saying, but our leadership is hesitant to take on new SaaS commitments this quarter. How quickly could we realistically see ROI?`;
      } else if (repTurnsCount === 2) {
        buyerReply = `That sounds promising, but we already have an existing vendor that does something similar. Why should we disrupt our current workflows?`;
      } else {
        buyerReply = `Understood. What would the implementation timeline and resource requirement look like for our team?`;
      }
    }

    const buyerTurn: RoleplayTurn = {
      id: `turn_buyer_${Date.now() + 1}`,
      speaker: 'ai_buyer',
      text: buyerReply,
      message: buyerReply,
      timestamp: new Date(Date.now() + 500).toISOString(),
    };

    const updatedDialogue = [...session.dialogue, repTurn, buyerTurn];
    const isCompleted = turnResult.isComplete;
    const evaluation = turnResult.finalEvaluation;

    const updatedSession: RoleplaySession = {
      ...session,
      dialogue: updatedDialogue,
      status: isCompleted ? 'completed' : 'in_progress',
      completedAt: isCompleted ? now : undefined,
      evaluation: isCompleted ? evaluation : undefined,
    };

    let pointsAwarded = 0;

    // 4. If completed, award points and update rep coaching profile
    if (isCompleted && evaluation) {
      // Award +25 points via Phase 1 Effort Engine
      const effortRes = await evaluateEffortEvent({
        organizationId,
        workspaceId,
        eventType: 'roleplay_completed',
        entityType: 'Coaching',
        entityId: session.id,
        actorType: 'User',
        actorId: session.repId,
        metadata: {
          scenarioId: session.scenarioId,
          score: evaluation.overallScore,
        },
      });
      pointsAwarded = effortRes.pointsAwarded;

      // Update rep coaching profile skill scores & mark assigned drill completed if matched
      const profileRef = adminDb.collection('coachingProfiles').doc(`${workspaceId}_${session.repId}`);
      const profileSnap = await profileRef.get();
      if (profileSnap.exists) {
        const prof = profileSnap.data() as RepCoachingProfile;
        const currentSkills = prof.skillScores || { discovery: 70, objectionHandling: 70, closing: 70, productKnowledge: 70, callControl: 70 };

        // Incremental skill score progression
        const updatedSkills = {
          discovery: Math.min(100, Math.round((currentSkills.discovery * 0.85) + (evaluation.discoveryScore * 0.15))),
          objectionHandling: Math.min(100, Math.round((currentSkills.objectionHandling * 0.85) + (evaluation.objectionHandlingScore * 0.15))),
          closing: Math.min(100, Math.round((currentSkills.closing * 0.85) + (evaluation.closingScore * 0.15))),
          productKnowledge: currentSkills.productKnowledge,
          callControl: Math.min(100, Math.round((currentSkills.callControl * 0.85) + (evaluation.listeningScore * 0.15))),
        };

        // Mark any pending assigned drill matching this scenario as completed
        const updatedDrills = (prof.assignedDrills || []).map((d) => {
          if (d.scenarioId === session.scenarioId && d.status === 'pending') {
            return {
              ...d,
              status: 'completed' as const,
              completedAt: now,
              scoreResult: evaluation.overallScore,
            };
          }
          return d;
        });

        await profileRef.update({
          skillScores: updatedSkills,
          assignedDrills: updatedDrills,
          updatedAt: now,
        });
      }
    }

    // 5. Commit updated session
    await adminDb.collection('practiceLabSessions').doc(sessionId).set(updatedSession);

    return {
      success: true,
      session: updatedSession,
      isCompleted,
      evaluation,
      pointsAwarded,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[submitRoleplayTurnAction] Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Assign a coaching practice drill to a sales representative.
 * The drill immediately surfaces in Phase 2 "My Day" action queue.
 */
export async function assignCoachingDrillAction(params: {
  workspaceId: string;
  organizationId: string;
  repId: string;
  scenarioId: string;
  scenarioTitle: string;
  scenarioCategory: string;
  instructions?: string;
  deadlineDate: string;
  assignedById: string;
  assignedByName: string;
}): Promise<{
  success: boolean;
  drillId?: string;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const {
      workspaceId,
      organizationId,
      repId,
      scenarioId,
      scenarioTitle,
      scenarioCategory,
      instructions,
      deadlineDate,
      assignedById,
      assignedByName,
    } = params;

    if (!workspaceId || !repId || !scenarioId) {
      return { success: false, error: 'Missing required assignment fields.' };
    }

    const drillId = `drill_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newDrill: AssignedDrillItem = {
      id: drillId,
      scenarioId,
      scenarioTitle,
      title: scenarioTitle,
      category: scenarioCategory as AssignedDrillItem['category'],
      instructions: instructions || `Manager assigned practice scenario: ${scenarioTitle}`,
      assignedBy: {
        userId: assignedById,
        userName: assignedByName,
      },
      assignedAt: new Date().toISOString(),
      deadlineDate,
      status: 'pending',
    };

    const profileRef = adminDb.collection('coachingProfiles').doc(`${workspaceId}_${repId}`);
    const snap = await profileRef.get();

    if (snap.exists) {
      const prof = snap.data() as RepCoachingProfile;
      const existingDrills = prof.assignedDrills || [];
      await profileRef.update({
        assignedDrills: [newDrill, ...existingDrills],
        updatedAt: new Date().toISOString(),
      });
    } else {
      const newProfile: RepCoachingProfile = {
        id: `${workspaceId}_${repId}`,
        repId,
        repName: 'Sales Representative',
        repEmail: `${repId}@workspace.local`,
        workspaceId,
        organizationId,
        skillScores: {
          discovery: 70,
          objectionHandling: 65,
          closing: 70,
          productKnowledge: 75,
          callControl: 70,
        },
        assignedDrills: [newDrill],
        recentCallsForReview: [],
        updatedAt: new Date().toISOString(),
      };
      await profileRef.set(newProfile);
    }

    return {
      success: true,
      drillId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[assignCoachingDrillAction] Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Retrieve manager team coaching overview, team skill heatmap,
 * and high-priority coaching opportunities across all reps in the workspace.
 */
export async function getTeamCoachingOverviewAction(params: {
  workspaceId: string;
}): Promise<{
  success: boolean;
  overview?: TeamCoachingOverview;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId } = params;
    if (!workspaceId) {
      return { success: false, error: 'Missing workspaceId' };
    }

    const [profilesSnap, callsSnap, scenariosSnap] = await Promise.all([
      adminDb.collection('coachingProfiles').where('workspaceId', '==', workspaceId).limit(50).get(),
      adminDb.collection('callConversations').where('workspaceId', '==', workspaceId).orderBy('recordedAt', 'desc').limit(50).get(),
      adminDb.collection('practiceLabScenarios').where('workspaceId', '==', workspaceId).limit(20).get(),
    ]);

    const profiles: RepCoachingProfile[] = profilesSnap.docs.map((d) => d.data() as RepCoachingProfile);
    const calls: CallConversation[] = callsSnap.docs.map((d) => d.data() as CallConversation);
    const scenarios: PracticeLabScenario[] = scenariosSnap.docs.map((d) => d.data() as PracticeLabScenario);

    // If no profiles found, return synthetic baseline
    if (profiles.length === 0) {
      const defaultOverview: TeamCoachingOverview = {
        workspaceId,
        teamAverageSkills: {
          discovery: 74,
          objectionHandling: 69,
          closing: 76,
          productKnowledge: 82,
          callControl: 71,
        },
        averageSkillScores: {
          discovery: 74,
          objectionHandling: 69,
          closing: 76,
          productKnowledge: 82,
          callControl: 71,
        },
        repsCount: 0,
        totalCallsAnalyzed: calls.length,
        totalDrillsCompleted: 0,
        highPriorityOpportunities: [],
        repSkillMatrix: [],
      };
      return { success: true, overview: defaultOverview };
    }

    // Compute team averages
    let sumDiscovery = 0;
    let sumObjection = 0;
    let sumClosing = 0;
    let sumKnowledge = 0;
    let sumControl = 0;
    let totalDrills = 0;

    const repSkillMatrix = profiles.map((p) => {
      const skills = p.skillScores || { discovery: 70, objectionHandling: 70, closing: 70, productKnowledge: 70, callControl: 70 };
      sumDiscovery += skills.discovery;
      sumObjection += skills.objectionHandling;
      sumClosing += skills.closing;
      sumKnowledge += skills.productKnowledge;
      sumControl += skills.callControl;

      const completedDrills = (p.assignedDrills || []).filter((d) => d.status === 'completed').length;
      totalDrills += completedDrills;

      // Identify lowest skill dimension
      const skillEntries = [
        { dim: 'Discovery', score: skills.discovery },
        { dim: 'Objection Handling', score: skills.objectionHandling },
        { dim: 'Closing', score: skills.closing },
        { dim: 'Product Knowledge', score: skills.productKnowledge },
        { dim: 'Call Control', score: skills.callControl },
      ].sort((a, b) => a.score - b.score);

      return {
        repId: p.repId,
        repName: p.repName,
        repEmail: p.repEmail,
        photoURL: p.photoURL,
        skillScores: skills,
        completedDrillsCount: completedDrills,
        pendingDrillsCount: (p.assignedDrills || []).filter((d) => d.status === 'pending').length,
        lowestSkillArea: skillEntries[0].dim,
        lowestScore: skillEntries[0].score,
        recommendedDrill: recommendNextDrill(skills, scenarios) || undefined,
      };
    });

    const count = profiles.length;
    const averageSkillScores = {
      discovery: Math.round(sumDiscovery / count),
      objectionHandling: Math.round(sumObjection / count),
      closing: Math.round(sumClosing / count),
      productKnowledge: Math.round(sumKnowledge / count),
      callControl: Math.round(sumControl / count),
    };

    // Find top coaching opportunities (reps with lowest skill scores or deals at risk)
    const highPriorityOpportunities = repSkillMatrix
      .filter((r) => r.lowestScore < 75)
      .slice(0, 5)
      .map((r, idx) => ({
        id: `opp_${r.repId}_${idx}`,
        repId: r.repId,
        repName: r.repName,
        repPhotoURL: r.photoURL,
        riskType: r.lowestScore < 65 ? ('critical_skill_gap' as const) : ('performance_dip' as const),
        description: `${r.repName} scored ${r.lowestScore}% in ${r.lowestSkillArea}. Recommended practice: ${r.recommendedDrill?.title || 'Objection handling drill'}.`,
        suggestedScenarioId: r.recommendedDrill?.id,
        suggestedScenarioTitle: r.recommendedDrill?.title,
      }));

    const overview: TeamCoachingOverview = {
      workspaceId,
      teamAverageSkills: averageSkillScores,
      averageSkillScores,
      repsCount: count,
      totalCallsAnalyzed: calls.length,
      totalDrillsCompleted: totalDrills,
      highPriorityOpportunities,
      repSkillMatrix,
    };

    return {
      success: true,
      overview,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[getTeamCoachingOverviewAction] Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Save or update a Scorecard Template with strict weight validation.
 */
export async function saveScorecardTemplateAction(params: {
  workspaceId: string;
  organizationId: string;
  template: ScorecardTemplate;
}): Promise<{
  success: boolean;
  templateId?: string;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, organizationId, template } = params;
    if (!workspaceId || !template.name) {
      return { success: false, error: 'Missing template name or workspace context.' };
    }

    // Validate weights sum to 1.00
    const validation = validateScorecardTemplateIntegrity(template);
    if (!validation.isValid) {
      return { success: false, error: `Invalid rubric weights: ${validation.errors.join(', ')}` };
    }

    const templateId = template.id || `${workspaceId}_tpl_${Date.now()}`;
    const payload: ScorecardTemplate = {
      ...template,
      id: templateId,
      workspaceId,
      organizationId,
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection('scorecardTemplates').doc(templateId).set(payload, { merge: true });

    return {
      success: true,
      templateId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[saveScorecardTemplateAction] Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Save or update a Practice Lab Scenario.
 */
export async function savePracticeScenarioAction(params: {
  workspaceId: string;
  scenario: PracticeLabScenario;
}): Promise<{
  success: boolean;
  scenarioId?: string;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, scenario } = params;
    if (!workspaceId || !scenario.title || !scenario.initialPrompt) {
      return { success: false, error: 'Missing scenario title or initial prompt.' };
    }

    const scenarioId = scenario.id || `${workspaceId}_scen_${Date.now()}`;
    const payload: PracticeLabScenario = {
      ...scenario,
      id: scenarioId,
      workspaceId,
    };

    await adminDb.collection('practiceLabScenarios').doc(scenarioId).set(payload, { merge: true });

    return {
      success: true,
      scenarioId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[savePracticeScenarioAction] Error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Execute on-demand FER migration / seeder protocol.
 */
export async function runCoachingMigrationAction(params: {
  workspaceId: string;
  organizationId: string;
  repId?: string;
  repName?: string;
  seedCalls?: boolean;
}) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  return executeCoachingMigration(params);
}
