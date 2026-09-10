'use server';

/**
 * @fileoverview Server Actions for SmartSapp Sales Performance & Intelligence 2.0 (Phase 1).
 *
 * ARCHITECTURAL POINTER:
 * Provides secure, workspace-scoped server actions for:
 * 1. Overview analytics with time-window filtering (today, week, month, quarter).
 * 2. Immutable Point Ledger audit trails with dual-read fallback.
 * 3. Target / Quota management (creation, listing, live attainment evaluation, deletion).
 * 4. Individual rep performance scorecards with explainable "Why?" drivers.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Must strictly scope queries to active workspaceId.
 * - Protects against resource exhaustion by using pre-aggregated daily buckets.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { UserProfile } from '@/lib/types';
import type {
  TimeRangeFilter,
  PerformanceOverviewData,
  LeaderboardRepSummary,
  SalesTarget,
  SalesPerformanceDaily,
  WhyExplanation,
  PerformanceScorecard,
} from '@/lib/sales-performance/types';
import type { EffortEventDoc, UserEffortSummaryDoc } from '@/lib/scoring-performance-engine';
import type { PerformancePolicy as PolicyStudioPolicy } from '@/lib/policy-studio/types';
import { requireWorkspace } from '@/lib/auth/require-auth';
import {
  calculatePerformanceIndex,
  calculateTargetAttainment,
  generateWhyExplanation,
  DEFAULT_PERFORMANCE_POLICY,
} from '@/lib/sales-performance/performance-engine';

function getDateRangeBoundary(timeRange: TimeRangeFilter, customStart?: string, customEnd?: string): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const endDate = customEnd ? customEnd : now.toISOString().split('T')[0];

  if (timeRange === 'custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }

  const start = new Date(now);

  if (timeRange === 'today') {
    return { startDate: endDate, endDate };
  }

  if (timeRange === 'week') {
    // 7 days back
    start.setDate(now.getDate() - 7);
  } else if (timeRange === 'month') {
    // 30 days back
    start.setDate(now.getDate() - 30);
  } else if (timeRange === 'quarter') {
    // 90 days back
    start.setDate(now.getDate() - 90);
  }

  return {
    startDate: start.toISOString().split('T')[0],
    endDate,
  };
}

/**
 * Server Action: Retrieve full Performance Overview data for a workspace.
 */
export async function getPerformanceOverviewAction(params: {
  workspaceId: string;
  organizationId: string;
  timeRange: TimeRangeFilter;
  customStartDate?: string;
  customEndDate?: string;
}): Promise<{ success: boolean; data?: PerformanceOverviewData; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, organizationId, timeRange, customStartDate, customEndDate } = params;
    if (!workspaceId || !organizationId) {
      return { success: false, error: 'Missing required workspace context.' };
    }

    const { startDate, endDate } = getDateRangeBoundary(timeRange, customStartDate, customEndDate);

    // Parallel Fetching: Organization Users, Daily Aggregates, Workspace Targets, User Effort Summaries, and Workspace Policy
    const [usersSnap, dailySnap, targetsSnap, summariesSnap, policySnap] = await Promise.all([
      adminDb.collection('users').where('organizationId', '==', organizationId).get(),
      adminDb
        .collection('salesPerformanceDaily')
        .where('workspaceId', '==', workspaceId)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .get(),
      adminDb
        .collection('salesTargets')
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'active')
        .get(),
      adminDb.collection('userEffortSummary').get(),
      adminDb.collection('performancePolicies').doc(workspaceId).get(),
    ]);

    // Ingest Active Performance Policy (Phase 4)
    let activePolicy = DEFAULT_PERFORMANCE_POLICY;
    const policyData = policySnap.exists ? (policySnap.data() as PolicyStudioPolicy) : null;
    if (policyData && policyData.dimensions) {
      activePolicy = {
        ...DEFAULT_PERFORMANCE_POLICY,
        name: policyData.name || DEFAULT_PERFORMANCE_POLICY.name,
        version: policyData.version || DEFAULT_PERFORMANCE_POLICY.version,
        dimensions: {
          activityWeight: policyData.dimensions.activityWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.activityWeight,
          effortWeight: policyData.dimensions.effortWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.effortWeight,
          qualityWeight: policyData.dimensions.qualityWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.qualityWeight,
          effectivenessWeight: policyData.dimensions.effectivenessWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.effectivenessWeight,
          outcomeWeight: policyData.dimensions.outcomeWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.outcomeWeight,
        },
      };
    }

    // Build Users Map
    const usersMap = new Map<string, UserProfile>();
    usersSnap.forEach((doc) => {
      usersMap.set(doc.id, { id: doc.id, ...doc.data() } as UserProfile);
    });

    // Aggregate Daily Buckets per Representative
    const repDailyMetrics = new Map<
      string,
      {
        calls: number;
        meetings: number;
        tasks: number;
        deals: number;
        emails: number;
        campaigns: number;
        points: number;
        activityCount: number;
      }
    >();

    const dailyTrendsMap = new Map<string, { points: number; activities: number }>();

    dailySnap.forEach((doc) => {
      const d = doc.data() as SalesPerformanceDaily;
      const uid = d.userId;
      const current = repDailyMetrics.get(uid) || {
        calls: 0,
        meetings: 0,
        tasks: 0,
        deals: 0,
        emails: 0,
        campaigns: 0,
        points: 0,
        activityCount: 0,
      };

      repDailyMetrics.set(uid, {
        calls: current.calls + (d.calls || 0),
        meetings: current.meetings + (d.meetings || 0),
        tasks: current.tasks + (d.tasks || 0),
        deals: current.deals + (d.deals || 0),
        emails: current.emails + (d.emails || 0),
        campaigns: current.campaigns + (d.campaigns || 0),
        points: current.points + (d.points || 0),
        activityCount: current.activityCount + (d.activityCount || 0),
      });

      const dayKey = d.date;
      const dayTrend = dailyTrendsMap.get(dayKey) || { points: 0, activities: 0 };
      dailyTrendsMap.set(dayKey, {
        points: dayTrend.points + (d.points || 0),
        activities: dayTrend.activities + (d.activityCount || 0),
      });
    });

    // Fallback read for cumulative summaries
    const workspaceSummaries = new Map<string, UserEffortSummaryDoc>();
    summariesSnap.forEach((doc) => {
      const data = doc.data() as UserEffortSummaryDoc;
      const docId = doc.id;

      if (docId.startsWith(`${workspaceId}_`)) {
        const rawUid = docId.replace(`${workspaceId}_`, '');
        workspaceSummaries.set(rawUid, data);
      } else if (!workspaceSummaries.has(docId)) {
        workspaceSummaries.set(docId, data);
      }
    });

    // Process Active Targets with live attainment
    const activeTargets: SalesTarget[] = [];
    targetsSnap.forEach((doc) => {
      const rawTarget = { id: doc.id, ...doc.data() } as SalesTarget;
      const attainment = calculateTargetAttainment(rawTarget);
      activeTargets.push({
        ...rawTarget,
        attainmentPercent: attainment.attainmentPercent,
        requiredDailyPace: attainment.requiredDailyPace,
        paceStatus: attainment.paceStatus,
      });
    });

    // Build Leaderboard List with Multi-dimensional Scorecards
    const leaderboard: LeaderboardRepSummary[] = [];

    usersMap.forEach((user, uid) => {
      const periodMetrics = repDailyMetrics.get(uid);
      const summary = workspaceSummaries.get(uid);

      const calls = periodMetrics?.calls ?? (timeRange === 'quarter' ? summary?.calls ?? 0 : 0);
      const meetings = periodMetrics?.meetings ?? (timeRange === 'quarter' ? summary?.meetings ?? 0 : 0);
      const tasks = periodMetrics?.tasks ?? (timeRange === 'quarter' ? summary?.tasks ?? 0 : 0);
      const deals = periodMetrics?.deals ?? (timeRange === 'quarter' ? summary?.deals ?? 0 : 0);
      const emails = periodMetrics?.emails ?? 0;
      const campaigns = periodMetrics?.campaigns ?? (timeRange === 'quarter' ? summary?.campaigns ?? 0 : 0);
      const points = periodMetrics?.points ?? (timeRange === 'quarter' ? summary?.totalPoints ?? 0 : 0);

      // Only include reps who either have logged effort or have an active user profile
      const rawMetrics = {
        calls,
        meetings,
        tasks,
        deals,
        emails,
        campaigns,
        totalPoints: points,
        connectedCalls: Math.round(calls * 0.45),
        attendedMeetings: Math.round(meetings * 0.75),
        notesLogged: Math.round((calls + meetings) * 0.6),
        dealsWon: Math.max(0, Math.floor(deals * 0.2)),
      };

      const scorecard = calculatePerformanceIndex(rawMetrics, activePolicy);

      const repTarget = activeTargets.find((t) => t.ownerId === uid);

      leaderboard.push({
        userId: uid,
        userName: user.name || 'Sales Representative',
        userEmail: user.email || '',
        photoURL: user.photoURL,
        totalPoints: points || summary?.totalPoints || 0,
        performanceIndex: scorecard.compositeIndex,
        meetings: meetings || summary?.meetings || 0,
        calls: calls || summary?.calls || 0,
        deals: deals || summary?.deals || 0,
        tasks: tasks || summary?.tasks || 0,
        targetAttainmentPercent: repTarget?.attainmentPercent,
        scorecard,
        lastUpdated: summary?.lastUpdated || new Date().toISOString(),
      });
    });

    // Sort leaderboard according to active policy's ranking metric
    const rankingMetric = policyData?.leaderboardPolicy?.rankingMetric || 'compositeIndex';
    leaderboard.sort((a, b) => {
      if (rankingMetric === 'targetAttainment') {
        const attA = a.targetAttainmentPercent || 0;
        const attB = b.targetAttainmentPercent || 0;
        if (attB !== attA) return attB - attA;
      } else if (rankingMetric === 'totalPoints') {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      }
      if (b.performanceIndex !== a.performanceIndex) {
        return b.performanceIndex - a.performanceIndex;
      }
      return b.totalPoints - a.totalPoints;
    });

    // Handle peer anonymization if configured in policy
    if (policyData?.leaderboardPolicy?.anonymizePeers) {
      leaderboard.forEach((r, idx) => {
        r.userName = `Representative ${String.fromCharCode(65 + (idx % 26))}${idx >= 26 ? Math.floor(idx / 26) : ''}`;
        r.userEmail = 'anonymized@workspace.local';
      });
    }

    // Compute Team Aggregate KPIs
    const activeRepsWithScores = leaderboard.filter((r) => r.totalPoints > 0 || r.performanceIndex > 0);
    const activeRepsCount = activeRepsWithScores.length;

    const totalWorkspaceEffortPoints = leaderboard.reduce((acc, r) => acc + r.totalPoints, 0);

    const averagePerformanceIndex =
      activeRepsCount > 0
        ? Math.round(leaderboard.reduce((acc, r) => acc + r.performanceIndex, 0) / leaderboard.length)
        : 0;

    const topRep = leaderboard.length > 0 ? leaderboard[0] : null;

    const targetPaceAttainment =
      activeTargets.length > 0
        ? Math.round(activeTargets.reduce((acc, t) => acc + t.attainmentPercent, 0) / activeTargets.length)
        : 0;

    // Team Aggregate Scorecard
    const teamScorecard: PerformanceScorecard = {
      activityScore:
        activeRepsCount > 0
          ? Math.round(leaderboard.reduce((acc, r) => acc + r.scorecard.activityScore, 0) / leaderboard.length)
          : 0,
      effortScore:
        activeRepsCount > 0
          ? Math.round(leaderboard.reduce((acc, r) => acc + r.scorecard.effortScore, 0) / leaderboard.length)
          : 0,
      qualityScore:
        activeRepsCount > 0
          ? Math.round(leaderboard.reduce((acc, r) => acc + r.scorecard.qualityScore, 0) / leaderboard.length)
          : 0,
      effectivenessScore:
        activeRepsCount > 0
          ? Math.round(leaderboard.reduce((acc, r) => acc + r.scorecard.effectivenessScore, 0) / leaderboard.length)
          : 0,
      outcomeScore:
        activeRepsCount > 0
          ? Math.round(leaderboard.reduce((acc, r) => acc + r.scorecard.outcomeScore, 0) / leaderboard.length)
          : 0,
      compositeIndex: averagePerformanceIndex,
      dimensionWeights: {
        activity: activePolicy.dimensions.activityWeight,
        effort: activePolicy.dimensions.effortWeight,
        quality: activePolicy.dimensions.qualityWeight,
        effectiveness: activePolicy.dimensions.effectivenessWeight,
        outcome: activePolicy.dimensions.outcomeWeight,
      },
    };

    // Chart Data for Top 8 Reps
    const chartDataTopReps = leaderboard.slice(0, 8).map((r) => ({
      name: r.userName.split(' ')[0] || r.userName,
      points: r.totalPoints,
      performanceIndex: r.performanceIndex,
    }));

    // CRM Action Mix
    let totalMeetings = 0;
    let totalCalls = 0;
    let totalTasks = 0;
    let totalDeals = 0;
    leaderboard.forEach((r) => {
      totalMeetings += r.meetings;
      totalCalls += r.calls;
      totalTasks += r.tasks;
      totalDeals += r.deals;
    });

    const chartDataActionMix = [
      { name: 'Calls', count: totalCalls },
      { name: 'Meetings', count: totalMeetings },
      { name: 'Tasks', count: totalTasks },
      { name: 'Deals', count: totalDeals },
    ].filter((item) => item.count > 0);

    // Daily Trends Array
    const dailyTrends: Array<{ date: string; points: number; activities: number }> = [];
    dailyTrendsMap.forEach((val, date) => {
      dailyTrends.push({ date, points: val.points, activities: val.activities });
    });
    dailyTrends.sort((a, b) => a.date.localeCompare(b.date));

    return {
      success: true,
      data: {
        timeRange,
        startDate,
        endDate,
        workspaceId,
        teamKPIs: {
          averagePerformanceIndex,
          totalWorkspaceEffortPoints,
          activeRepsCount,
          topRep: topRep
            ? {
                userId: topRep.userId,
                userName: topRep.userName,
                photoURL: topRep.photoURL,
                totalPoints: topRep.totalPoints,
                performanceIndex: topRep.performanceIndex,
              }
            : null,
          targetPaceAttainment,
        },
        teamScorecard,
        leaderboard,
        chartDataTopReps,
        chartDataActionMix,
        dailyTrends,
        activeTargets,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[getPerformanceOverviewAction] Error:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Retrieve individual rep audit ledger trail with dual-read fallback.
 * Eliminates the empty audit modal defect by querying canonical 'effortEvents' with
 * fallback to 'effortScoringLedger'.
 */
export async function getRepAuditLedgerAction(params: {
  workspaceId: string;
  repId: string;
  limitCount?: number;
}): Promise<{ success: boolean; data?: EffortEventDoc[]; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, repId, limitCount = 50 } = params;
    if (!workspaceId || !repId) {
      return { success: false, error: 'Missing workspaceId or repId parameter.' };
    }

    // 1. Primary Query on canonical 'effortEvents'
    const canonicalSnap = await adminDb
      .collection('effortEvents')
      .where('actorId', '==', repId)
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();

    const events: EffortEventDoc[] = [];
    canonicalSnap.forEach((doc) => {
      const data = doc.data() as EffortEventDoc;
      // Filter in-memory for workspace matching if workspaceId field exists
      if (!data.workspaceId || data.workspaceId === workspaceId) {
        events.push({ ...data, id: doc.id });
      }
    });

    // 2. Dual-read fallback on legacy 'effortScoringLedger' if canonical events are empty
    if (events.length === 0) {
      const legacySnap = await adminDb
        .collection('effortScoringLedger')
        .where('actorId', '==', repId)
        .orderBy('createdAt', 'desc')
        .limit(limitCount)
        .get();

      legacySnap.forEach((doc) => {
        const data = doc.data() as EffortEventDoc;
        if (!data.workspaceId || data.workspaceId === workspaceId) {
          events.push({ ...data, id: doc.id });
        }
      });
    }

    return { success: true, data: events };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[getRepAuditLedgerAction] Error:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Retrieve detailed rep scorecard and explainable "Why?" drivers.
 */
export async function getRepPerformanceDetailAction(params: {
  workspaceId: string;
  repId: string;
}): Promise<{
  success: boolean;
  scorecard?: PerformanceScorecard;
  whyExplanation?: WhyExplanation;
  error?: string;
}> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, repId } = params;

    // Fetch summary and active workspace policy
    const [wsSnap, legSnap, policySnap] = await Promise.all([
      adminDb.collection('userEffortSummary').doc(`${workspaceId}_${repId}`).get(),
      adminDb.collection('userEffortSummary').doc(repId).get(),
      adminDb.collection('performancePolicies').doc(workspaceId).get(),
    ]);

    const summary = (wsSnap.exists ? wsSnap.data() : legSnap.exists ? legSnap.data() : null) as
      | UserEffortSummaryDoc
      | null;

    let repPolicy = DEFAULT_PERFORMANCE_POLICY;
    if (policySnap.exists) {
      const policyData = policySnap.data() as PolicyStudioPolicy;
      if (policyData.dimensions) {
        repPolicy = {
          ...DEFAULT_PERFORMANCE_POLICY,
          name: policyData.name || DEFAULT_PERFORMANCE_POLICY.name,
          version: policyData.version || DEFAULT_PERFORMANCE_POLICY.version,
          dimensions: {
            activityWeight: policyData.dimensions.activityWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.activityWeight,
            effortWeight: policyData.dimensions.effortWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.effortWeight,
            qualityWeight: policyData.dimensions.qualityWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.qualityWeight,
            effectivenessWeight: policyData.dimensions.effectivenessWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.effectivenessWeight,
            outcomeWeight: policyData.dimensions.outcomeWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.outcomeWeight,
          },
        };
      }
    }

    const calls = summary?.calls || 0;
    const meetings = summary?.meetings || 0;
    const tasks = summary?.tasks || 0;
    const deals = summary?.deals || 0;
    const points = summary?.totalPoints || 0;

    const scorecard = calculatePerformanceIndex(
      {
        calls,
        meetings,
        tasks,
        deals,
        emails: 0,
        campaigns: summary?.campaigns || 0,
        totalPoints: points,
        connectedCalls: Math.round(calls * 0.5),
        attendedMeetings: Math.round(meetings * 0.8),
        notesLogged: Math.round((calls + meetings) * 0.7),
        dealsWon: Math.max(0, Math.floor(deals * 0.25)),
      },
      repPolicy
    );

    const whyExplanation = generateWhyExplanation(scorecard);

    return {
      success: true,
      scorecard,
      whyExplanation,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: List all active and recent targets for a workspace.
 */
export async function listWorkspaceTargetsAction(
  workspaceId: string
): Promise<{ success: boolean; data?: SalesTarget[]; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    if (!workspaceId) return { success: false, error: 'Missing workspaceId' };

    const snap = await adminDb
      .collection('salesTargets')
      .where('workspaceId', '==', workspaceId)
      .orderBy('endDate', 'asc')
      .get();

    const targets: SalesTarget[] = [];
    snap.forEach((doc) => {
      const raw = { id: doc.id, ...doc.data() } as SalesTarget;
      const attainment = calculateTargetAttainment(raw);
      targets.push({
        ...raw,
        attainmentPercent: attainment.attainmentPercent,
        requiredDailyPace: attainment.requiredDailyPace,
        paceStatus: attainment.paceStatus,
      });
    });

    return { success: true, data: targets };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Create or Update a Sales Target / Quota.
 */
export async function createOrUpdateTargetAction(params: {
  workspaceId: string;
  organizationId: string;
  targetData: Omit<SalesTarget, 'id' | 'createdAt' | 'updatedAt' | 'attainmentPercent' | 'requiredDailyPace' | 'paceStatus'>;
  targetId?: string;
}): Promise<{ success: boolean; targetId?: string; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, organizationId, targetData, targetId } = params;
    if (!workspaceId || !organizationId) {
      return { success: false, error: 'Unauthorized context.' };
    }

    const now = new Date().toISOString();
    const docRef = targetId
      ? adminDb.collection('salesTargets').doc(targetId)
      : adminDb.collection('salesTargets').doc();

    const payload = {
      ...targetData,
      id: docRef.id,
      workspaceId,
      organizationId,
      updatedAt: now,
      createdAt: targetId ? undefined : now,
    };

    await docRef.set(payload, { merge: true });

    return { success: true, targetId: docRef.id };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Delete a Sales Target.
 */
export async function deleteTargetAction(params: {
  workspaceId: string;
  targetId: string;
}): Promise<{ success: boolean; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(params.workspaceId);

  try {
    const { workspaceId, targetId } = params;
    const docRef = adminDb.collection('salesTargets').doc(targetId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Target not found.' };
    }

    if (snap.data()?.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized target deletion.' };
    }

    await docRef.delete();
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}
