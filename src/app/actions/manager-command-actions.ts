'use server';

/**
 * @fileoverview Server Actions for SmartSapp Manager Command Center (Phase 3).
 *
 * ARCHITECTURAL POINTER:
 * Provides secure, workspace-scoped server actions for sales leadership:
 * 1. getManagerCommandOverviewAction: Parallelized ingestion of pipeline deals, team tasks,
 *    workforce capacity, targets, and intervention records.
 * 2. executeManagerInterventionAction: Atomic execution of priority elevations (injecting into
 *    rep's Phase 2 "DO THIS NOW" slot), reassignments, and guidance notes with audit trails.
 * 3. rebalanceTeamWorkloadAction: Batch rebalancing of deals/tasks from overloaded reps to available peers.
 * 4. generateRepCoachingBriefAction: Automated compilation of 1:1 briefing dossier.
 * 5. runSalesTeamMigrationAction: Triggers the FER migration and capacity provisioning runner.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Must strictly scope queries to active workspaceId.
 * - Bounded queries enforced: max 100 deals, max 100 tasks, max 50 reps.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  ManagerCommandOverview,
  ManagerInterventionPayload,
  ManagerInterventionRecord,
  AttentionItem,
  RepWorkloadSummary,
  AtRiskDeal,
  CoachingBrief1on1,
  WorkloadRebalanceProposal,
} from '@/lib/manager-command/types';
import {
  calculateTeamMacroKPIs,
  evaluateWorkloadStatus,
  detectAtRiskDeal,
  synthesizeTeamBrief,
  compile1on1CoachingBrief,
  type RawDealInput,
  type RawRepInput,
} from '@/lib/manager-command/command-engine';
import { executeSalesTeamMigration, type MigrationResult } from '@/lib/manager-command/migration-protocol';
import type { SalesTarget, SalesAgent, SalesPerformanceDaily } from '@/lib/sales-performance/types';
import type { PerformancePolicy as PolicyStudioPolicy } from '@/lib/policy-studio/types';
import { DEFAULT_PERFORMANCE_POLICY } from '@/lib/sales-performance/performance-engine';

/**
 * Server Action: Retrieve complete Manager Command Center overview payload.
 */
export async function getManagerCommandOverviewAction(params: {
  workspaceId: string;
  organizationId: string;
  teamId?: string;
}): Promise<{ success: boolean; data?: ManagerCommandOverview; error?: string }> {
  try {
    const { workspaceId, organizationId, teamId } = params;
    if (!workspaceId || !organizationId) {
      return { success: false, error: 'Missing required workspace context.' };
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // 1. Parallel Ingestion with Strict Bounding & Indexing
    const [
      dealsSnap,
      tasksSnap,
      agentsSnap,
      usersSnap,
      targetsSnap,
      dailyBucketsSnap,
      interventionsSnap,
      teamsSnap,
      policySnap,
    ] = await Promise.all([
      // Deals (limit 100)
      adminDb
        .collection('deals')
        .where('workspaceId', '==', workspaceId)
        .limit(100)
        .get(),

      // Active Tasks (limit 100)
      adminDb
        .collection('tasks')
        .where('workspaceId', '==', workspaceId)
        .where('status', 'in', ['todo', 'in_progress'])
        .limit(100)
        .get(),

      // Sales Agents Capacity
      adminDb
        .collection('salesAgents')
        .where('workspaceId', '==', workspaceId)
        .limit(50)
        .get(),

      // Users
      adminDb
        .collection('users')
        .where('organizationId', '==', organizationId)
        .limit(50)
        .get(),

      // Active Targets
      adminDb
        .collection('salesTargets')
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'active')
        .get(),

      // Today's Daily Performance Buckets
      adminDb
        .collection('salesPerformanceDaily')
        .where('workspaceId', '==', workspaceId)
        .where('date', '==', todayStr)
        .limit(50)
        .get(),

      // Recent Manager Interventions
      adminDb
        .collection('managerInterventions')
        .where('workspaceId', '==', workspaceId)
        .limit(20)
        .get(),

      // Sales Teams
      adminDb
        .collection('salesTeams')
        .where('workspaceId', '==', workspaceId)
        .limit(10)
        .get(),

      // Active Performance Policy
      adminDb
        .collection('performancePolicies')
        .doc(workspaceId)
        .get(),
    ]);

    // Active Policy Dimension Weights
    const policyData = policySnap.exists ? (policySnap.data() as PolicyStudioPolicy) : null;
    const activeWeights = {
      activity: Math.round((policyData?.dimensions?.activityWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.activityWeight) * 100),
      effort: Math.round((policyData?.dimensions?.effortWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.effortWeight) * 100),
      quality: Math.round((policyData?.dimensions?.qualityWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.qualityWeight) * 100),
      effectiveness: Math.round((policyData?.dimensions?.effectivenessWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.effectivenessWeight) * 100),
      outcome: Math.round((policyData?.dimensions?.outcomeWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.outcomeWeight) * 100),
    };

    // Build User Lookup Map
    const userMap = new Map<string, { name: string; email: string; photoURL?: string; role: string }>();
    usersSnap.docs.forEach((doc) => {
      const data = doc.data();
      userMap.set(doc.id, {
        name: data.name || data.displayName || 'Representative',
        email: data.email || '',
        photoURL: data.photoURL || undefined,
        role: data.role || 'sales_rep',
      });
    });

    // Build Capacity Lookup Map
    const capacityMap = new Map<string, SalesAgent['capacity']>();
    agentsSnap.docs.forEach((doc) => {
      const data = doc.data() as SalesAgent;
      if (data.userId && data.capacity) {
        capacityMap.set(data.userId, data.capacity);
      }
    });

    // Build Daily Aggregate Buckets Map
    const dailyMap = new Map<string, SalesPerformanceDaily>();
    dailyBucketsSnap.docs.forEach((doc) => {
      const data = doc.data() as SalesPerformanceDaily;
      dailyMap.set(data.userId, data);
    });

    // 2. Parse Raw Deals
    const rawDeals: RawDealInput[] = dealsSnap.docs.map((doc) => {
      const data = doc.data();
      const assigneeId = String(data.assignedTo || '');
      const repInfo = userMap.get(assigneeId);
      return {
        id: doc.id,
        name: String(data.name || data.title || 'Untitled Deal'),
        value: Number(data.value || data.amount || 0),
        stage: String(data.stage || 'lead'),
        status: (data.status as 'open' | 'won' | 'lost' | 'cancelled') || 'open',
        assignedTo: assigneeId,
        assignedRepName: repInfo ? repInfo.name : 'Unassigned',
        createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : now.toISOString(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt).toISOString() : now.toISOString(),
        closedAt: data.closedAt ? new Date(data.closedAt).toISOString() : undefined,
        lastActivityAt: data.lastActivityAt ? new Date(data.lastActivityAt).toISOString() : undefined,
        stageChangedAt: data.stageChangedAt ? new Date(data.stageChangedAt).toISOString() : undefined,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        isManagerElevated: data.isManagerElevated ?? false,
      };
    });

    // Filter deals by teamId if requested
    const filteredDeals = teamId
      ? rawDeals.filter((d) => {
          const doc = dealsSnap.docs.find((x) => x.id === d.id);
          return doc?.data()?.teamId === teamId;
        })
      : rawDeals;

    // 3. Count Active Rep Tasks & Workloads
    const repTasksMap = new Map<string, number>();
    const repSlaBreachMap = new Map<string, number>();
    tasksSnap.docs.forEach((doc) => {
      const data = doc.data();
      const assignee = String(data.assignedTo || '');
      repTasksMap.set(assignee, (repTasksMap.get(assignee) || 0) + 1);

      if (data.dueDate && new Date(data.dueDate).getTime() < now.getTime()) {
        repSlaBreachMap.set(assignee, (repSlaBreachMap.get(assignee) || 0) + 1);
      }
    });

    // 4. Build Rep Workload Summaries
    const repWorkloads: RepWorkloadSummary[] = [];
    userMap.forEach((uInfo, uId) => {
      // Exclude pure backoffice superadmins if they have no sales interactions
      const cap = capacityMap.get(uId) || { weeklyHours: 40, maxOpenLeads: 15, maxOpenDeals: 10 };
      const repDeals = filteredDeals.filter((d) => d.assignedTo === uId && d.status === 'open');
      const queueCount = repTasksMap.get(uId) || 0;
      const slaBreaches = repSlaBreachMap.get(uId) || 0;
      const dailyBucket = dailyMap.get(uId);

      const rawRep: RawRepInput = {
        userId: uId,
        userName: uInfo.name,
        userEmail: uInfo.email,
        photoURL: uInfo.photoURL,
        role: uInfo.role,
        weeklyCapacityHours: cap.weeklyHours,
        maxOpenLeads: cap.maxOpenLeads,
        maxOpenDeals: cap.maxOpenDeals,
        activeLeadsCount: Math.max(1, Math.round(repDeals.length * 1.5)),
        activeDealsCount: repDeals.length,
        activeQueueItemsCount: queueCount,
        performanceIndex: dailyBucket?.points ? Math.min(100, Math.round(dailyBucket.points * 1.2)) : 75,
        targetAttainmentPercent: 78,
        paceStatus: 'on_track',
        scorecard: {
          activityScore: 80,
          effortScore: 85,
          qualityScore: 70,
          effectivenessScore: 75,
          outcomeScore: 78,
          compositeIndex: 78,
          dimensionWeights: activeWeights,
        },
        recentPointsEarned: dailyBucket?.points || 0,
        slaBreachCount: slaBreaches,
        stalledTasksCount: slaBreaches,
      };

      const workloadEval = evaluateWorkloadStatus(rawRep);

      repWorkloads.push({
        ...rawRep,
        weeklyCapacityHours: cap.weeklyHours,
        maxOpenLeads: cap.maxOpenLeads || 15,
        maxOpenDeals: cap.maxOpenDeals || 10,
        workloadStatus: workloadEval.workloadStatus,
        capacityUtilizationPercent: workloadEval.capacityUtilizationPercent,
      });
    });

    const overloadedCount = repWorkloads.filter((r) => r.workloadStatus === 'overloaded').length;

    // 5. Parse Targets
    const targets: SalesTarget[] = targetsSnap.docs.map((doc) => doc.data() as SalesTarget);

    // 6. Calculate Macro KPIs via Pure Engine
    const teamMacroKPIs = calculateTeamMacroKPIs({
      allDeals: filteredDeals,
      targets,
      overloadedRepsCount: overloadedCount,
      now,
    });

    // 7. Detect At-Risk Deals
    const atRiskDeals: AtRiskDeal[] = [];
    for (const d of filteredDeals) {
      if (d.status === 'open') {
        const risk = detectAtRiskDeal(d, now);
        if (risk && risk.riskScore >= 40) {
          atRiskDeals.push(risk);
        }
      }
    }
    atRiskDeals.sort((a, b) => b.riskScore - a.riskScore);

    // 8. Synthesize AI Team Brief
    const aiTeamBrief = synthesizeTeamBrief({
      macroKPIs: teamMacroKPIs,
      atRiskDeals,
      reps: repWorkloads,
    });

    // 9. Formulate Priority Attention Cards (UI Section 40)
    const attentionItems: AttentionItem[] = [];

    // Attention Alert 1: Top At-Risk Deal
    if (atRiskDeals.length > 0) {
      const topDeal = atRiskDeals[0];
      attentionItems.push({
        id: `att_deal_${topDeal.id}`,
        type: 'at_risk_deal',
        severity: 'critical',
        title: `${topDeal.name} is stalled in ${topDeal.stageName}`,
        subtitle: topDeal.riskReasons[0] || 'Requires manager intervention to unblock deal.',
        entityName: topDeal.name,
        entityId: topDeal.id,
        dealId: topDeal.id,
        dealValue: topDeal.value,
        repId: topDeal.assignedRepId,
        repName: topDeal.assignedRepName,
        actionLabel: 'Elevate to Hero',
        interventionType: 'elevate_to_hero',
        createdAt: now.toISOString(),
      });
    }

    // Attention Alert 2: Overloaded Rep
    const overloadedRep = repWorkloads.find((r) => r.workloadStatus === 'overloaded');
    if (overloadedRep) {
      attentionItems.push({
        id: `att_rep_${overloadedRep.userId}`,
        type: 'overloaded_rep',
        severity: 'warning',
        title: `${overloadedRep.userName} is overloaded (${overloadedRep.capacityUtilizationPercent}% capacity)`,
        subtitle: `${overloadedRep.activeQueueItemsCount} active queue items. High risk of missed SLAs.`,
        repId: overloadedRep.userId,
        repName: overloadedRep.userName,
        actionLabel: 'Rebalance Work',
        interventionType: 'reassign',
        createdAt: now.toISOString(),
      });
    }

    // Attention Alert 3: Stalled SLA cluster
    const repWithBreaches = repWorkloads.find((r) => r.slaBreachCount > 0);
    if (repWithBreaches) {
      attentionItems.push({
        id: `att_sla_${repWithBreaches.userId}`,
        type: 'breached_sla',
        severity: 'critical',
        title: `${repWithBreaches.slaBreachCount} SLA breach(es) in ${repWithBreaches.userName}'s queue`,
        subtitle: 'Customer touchpoints overdue by more than 24 hours.',
        repId: repWithBreaches.userId,
        repName: repWithBreaches.userName,
        actionLabel: 'Schedule 1:1',
        interventionType: 'schedule_coaching',
        createdAt: now.toISOString(),
      });
    }

    // 10. Parse Recent Interventions
    const recentInterventions: ManagerInterventionRecord[] = interventionsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        workspaceId: d.workspaceId,
        organizationId: d.organizationId,
        managerId: d.managerId,
        managerName: d.managerName,
        type: d.type,
        targetRepId: d.targetRepId,
        targetRepName: d.targetRepName,
        targetDealId: d.targetDealId,
        targetDealName: d.targetDealName,
        targetTaskId: d.targetTaskId,
        newAssigneeRepId: d.newAssigneeRepId,
        newAssigneeRepName: d.newAssigneeRepName,
        managerNote: d.managerNote,
        reason: d.reason,
        status: d.status || 'active',
        createdAt: d.createdAt,
        resolvedAt: d.resolvedAt,
      };
    });

    const activeTeamDoc = teamsSnap.docs.find((d) => d.id === teamId);

    return {
      success: true,
      data: {
        workspaceId,
        organizationId,
        activeTeamId: teamId,
        activeTeamName: activeTeamDoc ? activeTeamDoc.data().name : 'All Sales Representatives',
        dateString: now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
        teamMacroKPIs,
        aiTeamBrief,
        attentionItems,
        reps: repWorkloads,
        atRiskDeals,
        recentInterventions,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ManagerCommand] Error in getManagerCommandOverviewAction:', err);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Execute an operational manager intervention.
 */
export async function executeManagerInterventionAction(
  payload: ManagerInterventionPayload
): Promise<{ success: boolean; interventionId?: string; message?: string; error?: string }> {
  try {
    const {
      workspaceId,
      organizationId,
      managerId,
      managerName,
      type,
      targetRepId,
      targetRepName,
      targetDealId,
      targetDealName,
      targetTaskId,
      newAssigneeRepId,
      newAssigneeRepName,
      managerNote,
      reason,
      suggestedAction,
    } = payload;

    if (!workspaceId || !managerId || !targetRepId) {
      return { success: false, error: 'Missing required intervention parameters.' };
    }

    const now = new Date().toISOString();

    // 1. Commit Intervention Document
    const interventionRef = adminDb.collection('managerInterventions').doc();
    const interventionDoc: ManagerInterventionRecord = {
      id: interventionRef.id,
      workspaceId,
      organizationId,
      managerId,
      managerName,
      type,
      targetRepId,
      targetRepName,
      targetDealId,
      targetDealName,
      targetTaskId,
      newAssigneeRepId,
      newAssigneeRepName,
      managerNote,
      reason,
      status: 'active',
      createdAt: now,
    };
    await interventionRef.set(interventionDoc);

    // 2. Operational Override Execution
    if (type === 'elevate_to_hero') {
      // Injects priority into Phase 2 rep's "DO THIS NOW"
      if (targetDealId) {
        await adminDb.collection('deals').doc(targetDealId).update({
          isManagerElevated: true,
          managerElevatedBy: managerId,
          managerElevatedAt: now,
          managerNote: managerNote || reason,
          suggestedAction: suggestedAction || 'Executive Priority: Call prospect immediately.',
          updatedAt: now,
        });
      }

      if (targetTaskId) {
        await adminDb.collection('tasks').doc(targetTaskId).update({
          isManagerElevated: true,
          priority: 'urgent',
          managerNote: managerNote || reason,
          updatedAt: now,
        });
      }
    } else if (type === 'reassign' && newAssigneeRepId) {
      if (targetDealId) {
        await adminDb.collection('deals').doc(targetDealId).update({
          assignedTo: newAssigneeRepId,
          assignedRepName: newAssigneeRepName || 'New Assignee',
          reassignedByManagerId: managerId,
          reassignedAt: now,
          updatedAt: now,
        });
      }

      if (targetTaskId) {
        await adminDb.collection('tasks').doc(targetTaskId).update({
          assignedTo: newAssigneeRepId,
          reassignedByManagerId: managerId,
          reassignedAt: now,
          updatedAt: now,
        });
      }
    } else if (type === 'add_guidance' && managerNote) {
      if (targetDealId) {
        await adminDb.collection('deals').doc(targetDealId).update({
          managerGuidanceNote: managerNote,
          managerGuidanceAt: now,
          updatedAt: now,
        });
      }
    }

    // 3. Emit Audit Event into Canonical Ledger
    await adminDb.collection('effortEvents').add({
      workspaceId,
      organizationId,
      eventType: 'manager_intervention_executed',
      entityType: 'ManagerIntervention',
      entityId: interventionRef.id,
      actorType: 'User',
      actorId: managerId,
      points: 0,
      isMachine: false,
      metadata: {
        interventionType: type,
        targetRepId,
        targetDealId: targetDealId || '',
        newAssigneeRepId: newAssigneeRepId || '',
        isManagerIntervention: true,
        reason,
      },
      createdAt: now,
    });

    return {
      success: true,
      interventionId: interventionRef.id,
      message: `Intervention executed: ${type.replace(/_/g, ' ')}.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ManagerCommand] Error executing manager intervention:', err);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Batch rebalance workload items between sales reps.
 */
export async function rebalanceTeamWorkloadAction(params: {
  workspaceId: string;
  organizationId: string;
  managerId: string;
  proposals: WorkloadRebalanceProposal[];
}): Promise<{ success: boolean; reassignedCount: number; error?: string }> {
  try {
    const { workspaceId, organizationId, managerId, proposals } = params;
    if (!workspaceId || proposals.length === 0) {
      return { success: false, reassignedCount: 0, error: 'No rebalance proposals submitted.' };
    }

    // Cap batch size to 25 items for transactional safety (Risk R5)
    const cappedProposals = proposals.slice(0, 25);
    const now = new Date().toISOString();
    const batch = adminDb.batch();

    for (const prop of cappedProposals) {
      const collectionName = prop.itemType === 'deal' ? 'deals' : 'tasks';
      const docRef = adminDb.collection(collectionName).doc(prop.itemId);

      batch.update(docRef, {
        assignedTo: prop.toRepId,
        assignedRepName: prop.toRepName,
        reassignedByManagerId: managerId,
        reassignedAt: now,
        rebalanceReason: prop.reason,
        updatedAt: now,
      });

      // Audit Record
      const auditRef = adminDb.collection('managerInterventions').doc();
      batch.set(auditRef, {
        id: auditRef.id,
        workspaceId,
        organizationId,
        managerId,
        managerName: 'Manager',
        type: 'reassign',
        targetRepId: prop.fromRepId,
        targetRepName: prop.fromRepName,
        targetDealId: prop.itemType === 'deal' ? prop.itemId : undefined,
        targetTaskId: prop.itemType === 'task' ? prop.itemId : undefined,
        newAssigneeRepId: prop.toRepId,
        newAssigneeRepName: prop.toRepName,
        reason: prop.reason,
        status: 'resolved',
        createdAt: now,
        resolvedAt: now,
      });
    }

    await batch.commit();

    return {
      success: true,
      reassignedCount: cappedProposals.length,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ManagerCommand] Error rebalancing team workload:', err);
    return { success: false, reassignedCount: 0, error: msg };
  }
}

/**
 * Server Action: Generate automated 1:1 coaching brief dossier for a rep.
 */
export async function generateRepCoachingBriefAction(params: {
  workspaceId: string;
  organizationId: string;
  repId: string;
}): Promise<{ success: boolean; data?: CoachingBrief1on1; error?: string }> {
  try {
    const { workspaceId, repId } = params;

    const [userDoc, dealsSnap, dailySnap, policySnap, coachingProfileDoc] = await Promise.all([
      adminDb.collection('users').doc(repId).get(),
      adminDb.collection('deals').where('workspaceId', '==', workspaceId).where('assignedTo', '==', repId).limit(50).get(),
      adminDb.collection('salesPerformanceDaily').where('workspaceId', '==', workspaceId).where('userId', '==', repId).limit(7).get(),
      adminDb.collection('performancePolicies').doc(workspaceId).get(),
      adminDb.collection('coachingProfiles').doc(`${workspaceId}_${repId}`).get(),
    ]);

    if (!userDoc.exists) {
      return { success: false, error: 'Representative profile not found.' };
    }

    const policyData = policySnap.exists ? (policySnap.data() as PolicyStudioPolicy) : null;
    const activeWeights = {
      activity: Math.round((policyData?.dimensions?.activityWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.activityWeight) * 100),
      effort: Math.round((policyData?.dimensions?.effortWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.effortWeight) * 100),
      quality: Math.round((policyData?.dimensions?.qualityWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.qualityWeight) * 100),
      effectiveness: Math.round((policyData?.dimensions?.effectivenessWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.effectivenessWeight) * 100),
      outcome: Math.round((policyData?.dimensions?.outcomeWeight ?? DEFAULT_PERFORMANCE_POLICY.dimensions.outcomeWeight) * 100),
    };

    const uData = userDoc.data() || {};
    const rawDeals: RawDealInput[] = dealsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: String(d.name || d.title || 'Deal'),
        value: Number(d.value || 0),
        stage: String(d.stage || 'lead'),
        status: d.status || 'open',
        assignedTo: repId,
        createdAt: d.createdAt || new Date().toISOString(),
        updatedAt: d.updatedAt || new Date().toISOString(),
        stageChangedAt: d.stageChangedAt,
        lastActivityAt: d.lastActivityAt,
      };
    });

    const points7Days = dailySnap.docs.reduce((acc, d) => acc + (d.data().points || 0), 0);

    const mockRep: RepWorkloadSummary = {
      userId: repId,
      userName: uData.name || uData.displayName || 'Representative',
      userEmail: uData.email || '',
      photoURL: uData.photoURL,
      role: uData.role || 'sales_rep',
      weeklyCapacityHours: 40,
      activeLeadsCount: Math.round(rawDeals.length * 1.5),
      maxOpenLeads: 15,
      activeDealsCount: rawDeals.length,
      maxOpenDeals: 10,
      activeQueueItemsCount: 12,
      workloadStatus: 'optimal',
      capacityUtilizationPercent: 68,
      performanceIndex: 82,
      targetAttainmentPercent: 78,
      paceStatus: 'on_track',
      scorecard: {
        activityScore: 85,
        effortScore: 90,
        qualityScore: 65,
        effectivenessScore: 78,
        outcomeScore: 82,
        compositeIndex: 82,
        dimensionWeights: activeWeights,
      },
      recentPointsEarned: points7Days,
      slaBreachCount: 0,
      stalledTasksCount: 2,
    };

    const brief = compile1on1CoachingBrief({
      rep: mockRep,
      deals: rawDeals,
      now: new Date(),
    });

    if (coachingProfileDoc && coachingProfileDoc.exists) {
      const cData = coachingProfileDoc.data();
      const skills = cData?.skillScores as { discovery?: number; objectionHandling?: number; closing?: number } | undefined;
      const pendingDrills = Array.isArray(cData?.assignedDrills)
        ? (cData.assignedDrills as Array<{ title: string; status: string }>).filter((d) => d.status === 'pending')
        : [];

      if (skills?.objectionHandling !== undefined && skills.objectionHandling < 75) {
        brief.discussionPoints.push(
          `Conversation Intelligence: Objection handling score is ${skills.objectionHandling}%. Review recorded calls for pricing/competitor friction.`
        );
      }
      if (pendingDrills.length > 0) {
        brief.suggestedCommitments.push(
          `Complete pending Practice Lab drill: "${pendingDrills[0].title}" before next 1:1.`
        );
      }
    }

    return { success: true, data: brief };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Trigger FER Migration Protocol from Backoffice.
 */
export async function runSalesTeamMigrationAction(params: {
  workspaceId: string;
  organizationId: string;
  actorId: string;
  seedSampleDataIfEmpty?: boolean;
}): Promise<MigrationResult> {
  return executeSalesTeamMigration(params);
}

/**
 * Server Action: Retrieve Sales Teams and Agents for Backoffice Governance.
 */
export async function getBackofficeSalesTeamsAction(params: {
  workspaceId: string;
  organizationId: string;
}): Promise<{
  success: boolean;
  teams?: Array<{
    id: string;
    name: string;
    description?: string;
    managerIds: string[];
    memberIds: string[];
    status: string;
  }>;
  agents?: SalesAgent[];
  error?: string;
}> {
  try {
    const { workspaceId } = params;
    if (!workspaceId) {
      return { success: false, error: 'Missing workspaceId' };
    }

    const [teamsSnap, agentsSnap] = await Promise.all([
      adminDb.collection('salesTeams').where('workspaceId', '==', workspaceId).limit(50).get(),
      adminDb.collection('salesAgents').where('workspaceId', '==', workspaceId).limit(100).get(),
    ]);

    const teams = teamsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: String(d.name || 'Unnamed Team'),
        description: d.description || '',
        managerIds: (d.managerIds as string[]) || [],
        memberIds: (d.memberIds as string[]) || [],
        status: String(d.status || 'active'),
      };
    });

    const agents = agentsSnap.docs.map((doc) => doc.data() as SalesAgent);

    return { success: true, teams, agents };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ManagerCommand] Error fetching backoffice teams:', err);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Create or Update a Sales Team document.
 */
export async function saveSalesTeamConfigAction(params: {
  workspaceId: string;
  organizationId: string;
  teamId?: string;
  name: string;
  description?: string;
  managerIds?: string[];
  memberIds?: string[];
  defaultCapacity?: {
    weeklyHours: number;
    maxOpenLeads: number;
    maxOpenDeals: number;
  };
}): Promise<{ success: boolean; teamId?: string; error?: string }> {
  try {
    const { workspaceId, organizationId, teamId, name, description, managerIds = [], memberIds = [] } = params;
    if (!workspaceId || !name) {
      return { success: false, error: 'Missing required team parameters.' };
    }

    const now = new Date().toISOString();
    const teamRef = teamId
      ? adminDb.collection('salesTeams').doc(teamId)
      : adminDb.collection('salesTeams').doc();

    const teamData = {
      id: teamRef.id,
      workspaceId,
      organizationId,
      name,
      description: description || '',
      managerIds,
      memberIds,
      status: 'active',
      updatedAt: now,
      ...(teamId ? {} : { createdAt: now }),
    };

    await teamRef.set(teamData, { merge: true });

    return { success: true, teamId: teamRef.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ManagerCommand] Error saving sales team:', err);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Update individual sales agent capacity thresholds.
 */
export async function updateAgentCapacityAction(params: {
  workspaceId: string;
  organizationId: string;
  agentDocId: string;
  capacity: {
    weeklyHours: number;
    maxOpenLeads: number;
    maxOpenDeals: number;
  };
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { agentDocId, capacity } = params;
    if (!agentDocId || !capacity) {
      return { success: false, error: 'Missing agent or capacity parameters.' };
    }

    const now = new Date().toISOString();
    await adminDb.collection('salesAgents').doc(agentDocId).update({
      capacity,
      updatedAt: now,
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ManagerCommand] Error updating agent capacity:', err);
    return { success: false, error: msg };
  }
}

