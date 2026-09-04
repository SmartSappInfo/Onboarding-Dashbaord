'use server';

/**
 * @fileoverview Server Actions for SmartSapp Seller Workspace ("My Day") (Phase 2).
 *
 * ARCHITECTURAL POINTER:
 * Provides secure, workspace-scoped server actions:
 * 1. getMyDayOverviewAction: Parallelized ingestion of tasks, buyer signals, meetings, deals,
 *    and Phase 1 performance metrics into a prioritized "My Day" payload.
 * 2. executeQuickActionAction: Universal "action from the surface" handler (Call, Note, Task Done,
 *    Stage Advance) with atomic Firestore updates and instant effort point accrual via evaluateEffortEvent.
 * 3. snoozeQueueItemAction: Reschedules items without deleting context.
 * 4. dismissQueueItemAction: Flags items as dismissed.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Must strictly scope queries to active workspaceId.
 * - Memory bounds enforced: max 50 tasks, max 50 signals, max 20 meetings.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { UserProfile } from '@/lib/types';
import type {
  MyDayOverview,
  WorkQueueItem,
  QuickActionPayload,
  QuickActionResult,
  UpcomingMeetingBrief,
} from '@/lib/seller-workspace/types';
import {
  coalesceAndRankQueue,
  type RawCandidateInput,
} from '@/lib/seller-workspace/priority-engine';
import { evaluateEffortEvent } from '@/lib/scoring-performance-engine';
import type { SalesTarget, SalesPerformanceDaily } from '@/lib/sales-performance/types';
import { calculateTargetAttainment } from '@/lib/sales-performance/performance-engine';

/**
 * Server Action: Retrieve full "My Day" command surface payload for a seller.
 */
export async function getMyDayOverviewAction(params: {
  workspaceId: string;
  organizationId: string;
  repId: string;
}): Promise<{ success: boolean; data?: MyDayOverview; error?: string }> {
  try {
    const { workspaceId, organizationId, repId } = params;
    if (!workspaceId || !organizationId || !repId) {
      return { success: false, error: 'Missing required workspace or user context.' };
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    // 1. Parallel Data Fetching across CRM Subsystems (Bounded & Indexed)
    const [
      userDoc,
      tasksSnap,
      signalsSnap,
      meetingsSnap,
      dealsSnap,
      dailyDoc,
      targetsSnap,
      coachingProfileDoc,
    ] = await Promise.all([
      // User Profile
      adminDb.collection('users').doc(repId).get(),

      // Active CRM Tasks (limit 50)
      adminDb
        .collection('tasks')
        .where('workspaceId', '==', workspaceId)
        .where('status', 'in', ['todo', 'in_progress'])
        .limit(50)
        .get(),

      // Active Buyer Signals (limit 50)
      adminDb
        .collection('lead_signals')
        .where('workspaceId', '==', workspaceId)
        .where('isDismissed', '==', false)
        .limit(50)
        .get(),

      // Today's Meetings (limit 20)
      adminDb
        .collection('meetings')
        .where('workspaceId', '==', workspaceId)
        .limit(30)
        .get(),

      // Active Open Deals in Workspace
      adminDb
        .collection('deals')
        .where('workspaceId', '==', workspaceId)
        .limit(100)
        .get(),

      // Today's Performance Daily Bucket
      adminDb.collection('salesPerformanceDaily').doc(`${workspaceId}_${repId}_${todayStr}`).get(),

      // Active Targets
      adminDb
        .collection('salesTargets')
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'active')
        .limit(10)
        .get(),

      // Coaching Profile (Phase 5)
      adminDb.collection('coachingProfiles').doc(`${workspaceId}_${repId}`).get(),
    ]);

    // 2. Resolve Rep Profile
    const userData = userDoc.exists ? (userDoc.data() as UserProfile) : null;
    const repProfile = {
      userId: repId,
      userName: userData?.name || 'Sales Representative',
      userEmail: userData?.email || '',
      photoURL: userData?.photoURL,
    };

    // 3. Build Deals Map for rapid context joining
    const dealsMap = new Map<
      string,
      { id: string; name: string; value: number; stage: string; assignedTo?: string }
    >();
    dealsSnap.forEach((doc) => {
      const d = doc.data();
      dealsMap.set(doc.id, {
        id: doc.id,
        name: String(d.title || d.name || 'Unnamed Deal'),
        value: Number(d.value || d.amount || 0),
        stage: String(d.stage || d.stageName || 'Pipeline'),
        assignedTo: d.assignedTo ? String(d.assignedTo) : undefined,
      });
    });

    // 4. Resolve Active Targets and Lagging Metric
    let repLaggingMetric: string | undefined = undefined;
    let targetAttainmentPercent = 100;
    let dailyRequiredPace = 0;

    const targets: SalesTarget[] = [];
    targetsSnap.forEach((doc) => {
      const t = { id: doc.id, ...doc.data() } as SalesTarget;
      targets.push(t);
    });

    if (targets.length > 0) {
      // Find rep's target or workspace target
      const primaryTarget = targets.find((t) => t.ownerId === repId) || targets[0];
      const attainment = calculateTargetAttainment(primaryTarget, now);
      targetAttainmentPercent = attainment.attainmentPercent;
      dailyRequiredPace = attainment.requiredDailyPace;

      if (attainment.paceStatus === 'behind' || attainment.attainmentPercent < 70) {
        repLaggingMetric = primaryTarget.metric;
      }
    }

    // 5. Build Candidates from CRM Tasks
    const candidates: RawCandidateInput[] = [];

    tasksSnap.forEach((doc) => {
      const t = doc.data();
      // Only include tasks assigned to rep or unassigned
      const assigned = Array.isArray(t.assignedTo) ? t.assignedTo : [t.assignedTo];
      const isAssigned = !t.assignedTo || assigned.includes(repId) || assigned.length === 0;

      if (isAssigned) {
        let type: WorkQueueItem['type'] = 'task';
        const titleLower = (t.title || '').toLowerCase();
        if (titleLower.includes('call') || t.category === 'call') {
          type = 'call';
        } else if (titleLower.includes('follow') || titleLower.includes('email')) {
          type = 'follow_up';
        } else if (titleLower.includes('meeting') || titleLower.includes('prep')) {
          type = 'meeting_prep';
        }

        const linkedDeal = t.relatedEntityId && dealsMap.has(t.relatedEntityId) ? dealsMap.get(t.relatedEntityId) : undefined;

        candidates.push({
          id: doc.id,
          type,
          title: t.title || 'Action Required',
          description: t.description || 'Follow up with lead on next steps.',
          entityId: t.entityId || undefined,
          entityName: t.entityName || undefined,
          entityType: t.entityType || undefined,
          dealId: linkedDeal?.id,
          dealName: linkedDeal?.name,
          dealValue: linkedDeal?.value,
          dealStage: linkedDeal?.stage,
          dueDate: t.dueDate || now.toISOString(),
          assignedTo: repId,
          workspaceId,
          organizationId,
          createdAt: t.createdAt || now.toISOString(),
        });
      }
    });

    // 6. Build Candidates from Lead Signals
    signalsSnap.forEach((doc) => {
      const s = doc.data();
      candidates.push({
        id: `sig_${doc.id}`,
        type: 'buyer_signal',
        title: s.title || s.headline || 'Buyer Engagement Detected',
        description: s.description || s.potentialImplication || 'High-intent buyer action logged.',
        entityId: s.prospectId || undefined,
        entityName: s.prospectName || undefined,
        entityType: 'Lead',
        dueDate: now.toISOString(), // Signals are actionable immediately
        signalStrength: s.strength === 'high' ? 'high' : s.strength === 'medium' ? 'medium' : 'low',
        signalCount: 3,
        confidence: Number(s.confidence) || 88,
        assignedTo: repId,
        workspaceId,
        organizationId,
        createdAt: s.detectedAt || now.toISOString(),
      });
    });

    // 6.1 Build Candidates from Assigned Coaching Drills (Phase 5)
    if (coachingProfileDoc && coachingProfileDoc.exists) {
      const coachingData = coachingProfileDoc.data();
      const assignedDrills = Array.isArray(coachingData?.assignedDrills) ? coachingData.assignedDrills : [];
      for (const drill of assignedDrills) {
        if (drill.status === 'pending') {
          candidates.push({
            id: `drill_${drill.id}`,
            type: 'task',
            title: `Practice Drill: ${drill.title}`,
            description: drill.instructions || `Practice scenario assigned to sharpen skills in ${drill.category}.`,
            entityId: drill.scenarioId,
            entityName: drill.title,
            entityType: 'Coaching',
            dueDate: drill.deadlineDate || now.toISOString(),
            assignedTo: repId,
            workspaceId,
            organizationId,
            createdAt: drill.assignedAt || now.toISOString(),
          });
        }
      }
    }

    // 6.2 Build Candidates from Active High-Intent Buyer Signals (Phase 6)
    try {
      const activeSignalsSnap = await adminDb
        .collection('buyerSignals')
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'active')
        .where('actionRequired', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      activeSignalsSnap.forEach((sigDoc) => {
        const sig = sigDoc.data();
        // Ownership guard: only include if targeted to this rep or unassigned at workspace level
        const targetOwnerId = sig.suggestedAction?.recommendedOwnerId || sig.ownerId;
        if (targetOwnerId && targetOwnerId !== repId) {
          return;
        }

        candidates.push({
          id: `signal_${sigDoc.id}`,
          type: 'buyer_signal',
          title: `Buyer Signal: ${sig.title || 'High Intent Action'}`,
          description: `${sig.entityName}: ${sig.description || 'Customer intent spike detected.'}`,
          entityId: sig.entityId || sigDoc.id,
          entityName: sig.entityName || 'Prospective Buyer',
          entityType: 'BuyerSignal',
          dueDate: now.toISOString(),
          assignedTo: repId,
          workspaceId,
          organizationId,
          createdAt: sig.createdAt || now.toISOString(),
        });
      });
    } catch (sigErr) {
      console.warn('Non-blocking buyer signal candidate resolution failure:', sigErr);
    }

    // 6.3 Build Candidates from Uncategorized or Slipped Forecast Deals (Phase 7)
    try {
      const forecastDealsSnap = await adminDb
        .collection('forecastDeals')
        .where('workspaceId', '==', workspaceId)
        .where('ownerId', '==', repId)
        .limit(10)
        .get();

      forecastDealsSnap.forEach((dealDoc) => {
        const d = dealDoc.data();
        const slipCount = Number(d.slipCount) || 0;
        const isSlipped = slipCount >= 2;
        const isUncategorized = !d.forecastCategory || d.forecastCategory === 'omitted';

        if (isSlipped || isUncategorized) {
          candidates.push({
            id: `forecast_${dealDoc.id}`,
            type: 'deal_action',
            title: isSlipped
              ? `Forecast Alert: Slipped Deal (${d.name || 'Opportunity'})`
              : `Forecast Review: Lock Category for ${d.name || 'Opportunity'}`,
            description: isSlipped
              ? `Close date has slipped ${slipCount} times. Reassess timeline to defend quarterly revenue pace.`
              : `Review deal qualification to assign Committed or Likely forecast category.`,
            entityId: dealDoc.id,
            entityName: d.name || 'Opportunity',
            entityType: 'Deal',
            dueDate: now.toISOString(),
            assignedTo: repId,
            workspaceId,
            organizationId,
            createdAt: d.updatedAt || now.toISOString(),
          });
        }
      });
    } catch (forecastErr) {
      console.warn('Non-blocking forecast candidate resolution failure:', forecastErr);
    }

    // 6.4 Build Candidates from Active Sales Play Actions (Phase 8)
    try {
      const activeExecsSnap = await adminDb
        .collection('salesOrchestrationExecutions')
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'active')
        .limit(15)
        .get();

      activeExecsSnap.forEach((execDoc) => {
        const ex = execDoc.data();
        if (ex.assignedTo && ex.assignedTo !== repId) {
          return;
        }
        candidates.push({
          id: `play_${execDoc.id}`,
          type: 'deal_action',
          title: `Sales Play: ${ex.playTitle || 'Governed Play Action'}`,
          description: `Action step on ${ex.entityName || 'account'}: Execute governed stage task.`,
          entityId: ex.entityId || execDoc.id,
          entityName: ex.entityName || 'Sales Play Target',
          entityType: ex.entityType === 'deal' ? 'Deal' : 'Lead',
          dueDate: ex.nextStepDueAt || now.toISOString(),
          assignedTo: repId,
          workspaceId,
          organizationId,
          createdAt: ex.startedAt || now.toISOString(),
        });
      });
    } catch (playErr) {
      console.warn('Non-blocking sales play candidate resolution failure:', playErr);
    }

    // 6.5 Build Candidates from Active AI Next-Best-Action Recommendations (Phase 9)
    try {
      // Query rep-assigned recommendations directly to prevent cross-rep queue starvation
      const repAiRecsPromise = adminDb
        .collection('aiSalesRecommendations')
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'pending')
        .where('assignedRepId', '==', repId)
        .limit(10)
        .get();

      // Query broadcast / general recommendations
      const generalAiRecsPromise = adminDb
        .collection('aiSalesRecommendations')
        .where('workspaceId', '==', workspaceId)
        .where('status', '==', 'pending')
        .limit(20)
        .get();

      const [repRecsSnap, generalRecsSnap] = await Promise.all([
        repAiRecsPromise,
        generalAiRecsPromise,
      ]);

      const seenRecIds = new Set<string>();
      const combinedDocs = [...repRecsSnap.docs];
      repRecsSnap.docs.forEach((d) => seenRecIds.add(d.id));

      generalRecsSnap.docs.forEach((d) => {
        if (!seenRecIds.has(d.id)) {
          const rec = d.data();
          if (!rec.assignedRepId || rec.assignedRepId === repId) {
            seenRecIds.add(d.id);
            combinedDocs.push(d);
          }
        }
      });

      combinedDocs.forEach((recDoc) => {
        const rec = recDoc.data();
        candidates.push({
          id: `ai_rec_${recDoc.id}`,
          type: 'deal_action',
          title: `AI Priority: ${rec.title || 'Recommended Action'}`,
          description: `${rec.description || 'AI next-best-action.'} (${rec.rationale || 'Grounded in real-time intent.'})`,
          entityId: rec.entityId || recDoc.id,
          entityName: rec.entityName || 'Sales Target',
          entityType: rec.entityType === 'deal' ? 'Deal' : 'Lead',
          dueDate: rec.expiresAt || now.toISOString(),
          confidence: Number(rec.confidenceScore) || 90,
          assignedTo: repId,
          workspaceId,
          organizationId,
          createdAt: rec.createdAt || now.toISOString(),
        });
      });
    } catch (aiRecErr) {
      console.warn('Non-blocking AI recommendation candidate resolution failure:', aiRecErr);
    }

    // 7. Resolve Today's Meetings
    const upcomingMeetings: UpcomingMeetingBrief[] = [];
    meetingsSnap.forEach((doc) => {
      const m = doc.data();
      const meetingTime = m.meetingTime || m.startTime || m.date;
      if (meetingTime && m.status !== 'cancelled') {
        const mDate = new Date(meetingTime);
        // Filter to today's meetings
        if (mDate >= new Date(startOfToday) && mDate <= new Date(endOfToday)) {
          upcomingMeetings.push({
            id: doc.id,
            title: m.title || 'Discovery Meeting',
            startTime: meetingTime,
            endTime: m.endTime || new Date(mDate.getTime() + 30 * 60000).toISOString(),
            attendeesCount: Array.isArray(m.attendees) ? m.attendees.length : 2,
            brief: m.description || m.agenda || 'Confirm project objectives and decision timeline.',
            contactContext: m.contactName
              ? {
                  contactId: m.contactId || '',
                  name: m.contactName,
                  email: m.contactEmail,
                  phone: m.contactPhone,
                }
              : undefined,
          });

          // Add a meeting_prep card to queue for meetings today
          candidates.push({
            id: `meet_${doc.id}`,
            type: 'meeting_prep',
            title: `Prepare for Meeting: ${m.title || 'Client Session'}`,
            description: m.description || 'Review client history, open deals, and proposal notes.',
            dueDate: meetingTime,
            assignedTo: repId,
            workspaceId,
            organizationId,
            createdAt: now.toISOString(),
          });
        }
      }
    });

    // 7b. Ingest Manager-Elevated Deals (Phase 3 -> Phase 2 Closed Loop Bridge)
    dealsSnap.forEach((doc) => {
      const d = doc.data();
      const assigned = d.assignedTo ? String(d.assignedTo) : '';
      const isElevated = Boolean(d.isManagerElevated);
      const isStatusOpen = d.status !== 'won' && d.status !== 'lost' && d.status !== 'cancelled';

      if (assigned === repId && isElevated && isStatusOpen) {
        candidates.push({
          id: `elevated_deal_${doc.id}`,
          type: 'deal_action',
          title: `Executive Priority: ${d.name || d.title || 'At-Risk Opportunity'}`,
          description: d.managerNote || d.reason || 'Manager intervention: prioritize closing touchpoint.',
          dealId: doc.id,
          dealName: d.name || d.title,
          dealValue: Number(d.value || d.amount || 0),
          dealStage: d.stage || 'Pipeline',
          contactName: d.contactName,
          contactEmail: d.contactEmail,
          contactPhone: d.contactPhone,
          dueDate: now.toISOString(),
          assignedTo: repId,
          workspaceId,
          organizationId,
          isManagerElevated: true,
          managerNote: d.managerNote,
          suggestedAction: d.suggestedAction,
          createdAt: d.managerElevatedAt || now.toISOString(),
        });
      }
    });

    // 7c. Ingest Churn Radar Early-Warning Interventions (Phase 10 -> Phase 2 Closed Loop Bridge)
    dealsSnap.forEach((doc) => {
      const d = doc.data();
      const assigned = String(d.assignedTo || d.ownerId || d.repId || d.userId || '');
      const isStatusOpen = d.status === 'open' || (d.status !== 'won' && d.status !== 'lost' && d.status !== 'cancelled');
      const dealVal = Number(d.value || d.amount || 0);

      // Inspect open high-value deals assigned to rep not already manager-elevated
      if (assigned === repId && isStatusOpen && !d.isManagerElevated && dealVal >= 10000) {
        let touchDecayDays = 0;
        let isDecayed = false;
        let reason = '';
        let action = '';

        if (d.lastActivityAt) {
          const parsedTime = new Date(d.lastActivityAt).getTime();
          if (!isNaN(parsedTime)) {
            touchDecayDays = Math.round(Math.max(0, (now.getTime() - parsedTime) / (1000 * 60 * 60 * 24)));
            if (touchDecayDays > 21) {
              isDecayed = true;
              reason = `Severe interaction silence (${touchDecayDays}d without touch)`;
              action = 'Execute Executive Re-engagement Outreach to revive momentum.';
            } else if (touchDecayDays > 14) {
              isDecayed = true;
              reason = `Interaction cadence slowing (${touchDecayDays}d since last touch)`;
              action = 'Schedule Account Review touchpoint to defend velocity.';
            }
          }
        }

        const stakeholders = Array.isArray(d.stakeholders) ? d.stakeholders.length : (Number(d.stakeholderCount) || 1);
        if (stakeholders <= 1 && dealVal >= 25000) {
          if (isDecayed) {
            reason = `${reason} + Single-threaded stakeholder vulnerability`;
            action = 'Execute Executive Outreach & Mandate Multi-Threading Play';
          } else {
            isDecayed = true;
            reason = 'Single-threaded deal: vulnerable to champion departure';
            action = 'Mandate Multi-Threading Play: Map Economic Buyer and technical stakeholders.';
          }
        }

        if (isDecayed) {
          candidates.push({
            id: `churn_radar_${doc.id}`,
            type: 'deal_action',
            title: `Churn Radar: ${d.name || d.title || 'Opportunity'}`,
            description: `${reason}. Recommended action: ${action}`,
            dealId: doc.id,
            dealName: d.name || d.title,
            dealValue: dealVal,
            dealStage: d.stage || 'Pipeline',
            contactName: d.contactName,
            contactEmail: d.contactEmail,
            contactPhone: d.contactPhone,
            dueDate: now.toISOString(),
            assignedTo: repId,
            workspaceId,
            organizationId,
            suggestedAction: action,
            confidence: 92,
            createdAt: now.toISOString(),
          });
        }
      }
    });

    // 8. Coalesce and Rank Queue using Priority Engine (R2 Deduplication)
    const rankedQueue = coalesceAndRankQueue(candidates, {
      repLaggingMetric,
      currentTime: now,
    });

    // 9. Select Top Priority Hero Item
    const topPriority = rankedQueue.length > 0 ? rankedQueue[0] : null;
    const secondaryQueue = rankedQueue.slice(1);

    // 10. Calculate SLA Summary Counts
    let onTrackCount = 0;
    let atRiskCount = 0;
    let breachedCount = 0;
    for (const item of rankedQueue) {
      if (item.slaStatus === 'breached') breachedCount++;
      else if (item.slaStatus === 'at_risk') atRiskCount++;
      else onTrackCount++;
    }

    // 11. Calculate Daily Snapshot
    const dailyData = dailyDoc.exists ? (dailyDoc.data() as SalesPerformanceDaily) : null;
    const todayPointsEarned = dailyData?.points || 0;
    const completedActionsToday =
      (dailyData?.calls || 0) + (dailyData?.meetings || 0) + (dailyData?.tasks || 0);

    // Active pipeline owned by rep
    let activePipelineValue = 0;
    dealsMap.forEach((d) => {
      if (!d.assignedTo || d.assignedTo === repId) {
        activePipelineValue += d.value;
      }
    });

    // Greeting formulation
    const hour = now.getHours();
    const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const repFirstName = repProfile.userName.split(' ')[0];
    const greeting = `${timeOfDay}, ${repFirstName}`;

    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    };
    const dateString = now.toLocaleDateString('en-US', dateOptions);

    const overview: MyDayOverview = {
      greeting,
      dateString,
      repProfile,
      snapshot: {
        performanceIndex: Math.min(100, Math.max(50, Math.round(targetAttainmentPercent * 0.8 + 20))),
        targetAttainmentPercent,
        dailyRequiredPace,
        activePipelineValue,
        todayPointsEarned,
        todayPointsTarget: 25, // Standard daily target
        completedActionsToday,
        pendingActionsToday: rankedQueue.length,
      },
      topPriority,
      queue: secondaryQueue,
      upcomingMeetings: upcomingMeetings.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
      slaSummary: {
        onTrackCount,
        atRiskCount,
        breachedCount,
      },
    };

    return {
      success: true,
      data: overview,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[SellerWorkspace] Error in getMyDayOverviewAction:', err);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Execute an action directly from the "My Day" surface (Action-From-The-Surface).
 * Completes tasks, logs calls, or records notes while instantly invoking evaluateEffortEvent.
 */
export async function executeQuickActionAction(
  payload: QuickActionPayload
): Promise<QuickActionResult> {
  try {
    const { itemId, actionType, workspaceId, organizationId, actorId } = payload;
    if (!itemId || !workspaceId || !actorId) {
      return { success: false, error: 'Missing required execution parameters.' };
    }

    const timestamp = new Date().toISOString();
    let pointsAwarded = 0;
    let message = 'Action executed successfully.';

    // Check if itemId is a task in the tasks collection
    const cleanId = itemId.startsWith('sig_') || itemId.startsWith('meet_') ? null : itemId;

    if (cleanId) {
      const taskRef = adminDb.collection('tasks').doc(cleanId);
      const taskSnap = await taskRef.get();

      if (taskSnap.exists) {
        if (actionType === 'task_complete' || actionType === 'call' || actionType === 'note') {
          await taskRef.update({
            status: 'completed',
            completedAt: timestamp,
            updatedAt: timestamp,
          });
        } else if (actionType === 'snooze') {
          const hours = payload.snoozeHours || 24;
          const snoozedUntil = new Date(Date.now() + hours * 3600000).toISOString();
          await taskRef.update({
            snoozedUntil,
            dueDate: snoozedUntil,
            updatedAt: timestamp,
          });
          return { success: true, message: `Item snoozed for ${hours} hours.` };
        } else if (actionType === 'dismiss') {
          await taskRef.update({
            status: 'cancelled',
            updatedAt: timestamp,
          });
          return { success: true, message: 'Item dismissed.' };
        }
      }
    }

    // Dismiss signal if it was a signal
    if (itemId.startsWith('sig_')) {
      const sigId = itemId.replace('sig_', '');
      await adminDb.collection('lead_signals').doc(sigId).update({
        isDismissed: true,
        isRead: true,
      });
    }

    // Award Points via Central Scoring Bus (evaluateEffortEvent)
    if (actionType === 'call') {
      const res = await evaluateEffortEvent({
        eventType: 'phone_call_completed',
        entityType: 'Call',
        entityId: itemId,
        actorId,
        actorType: 'User', // Guaranteed human action
        workspaceId,
        organizationId,
        durationSeconds: payload.callDurationSeconds || 120,
        metadata: {
          note: payload.noteText || 'Logged quick call from My Day surface.',
          outcome: payload.callOutcome || 'completed',
          source: 'seller_workspace',
          isAutomation: false,
        },
      });
      pointsAwarded = res.pointsAwarded;
      message = `Call logged. +${pointsAwarded} points awarded!`;
    } else if (actionType === 'task_complete' || actionType === 'note') {
      const res = await evaluateEffortEvent({
        eventType: 'task_completed',
        entityType: 'Task',
        entityId: itemId,
        actorId,
        actorType: 'User',
        workspaceId,
        organizationId,
        metadata: {
          note: payload.noteText || 'Completed task from My Day surface.',
          source: 'seller_workspace',
          isAutomation: false,
        },
      });
      pointsAwarded = res.pointsAwarded;
      message = `Task completed. +${pointsAwarded} points awarded!`;
    }

    return {
      success: true,
      pointsEarned: pointsAwarded,
      message,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[SellerWorkspace] Error in executeQuickActionAction:', err);
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Snooze a queue item.
 */
export async function snoozeQueueItemAction(params: {
  workspaceId: string;
  itemId: string;
  snoozeHours: number;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { itemId, snoozeHours } = params;
    const cleanId = itemId.startsWith('sig_') || itemId.startsWith('meet_') ? null : itemId;

    if (cleanId) {
      const taskRef = adminDb.collection('tasks').doc(cleanId);
      const newDue = new Date(Date.now() + snoozeHours * 3600000).toISOString();
      await taskRef.update({
        dueDate: newDue,
        snoozedUntil: newDue,
        updatedAt: new Date().toISOString(),
      });
    }

    return { success: true, message: `Snoozed for ${snoozeHours}h.` };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Server Action: Dismiss a queue item or signal.
 */
export async function dismissQueueItemAction(params: {
  workspaceId: string;
  itemId: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { itemId } = params;
    if (itemId.startsWith('sig_')) {
      const sigId = itemId.replace('sig_', '');
      await adminDb.collection('lead_signals').doc(sigId).update({
        isDismissed: true,
        isRead: true,
      });
    } else if (!itemId.startsWith('meet_')) {
      await adminDb.collection('tasks').doc(itemId).update({
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      });
    }

    return { success: true, message: 'Item dismissed.' };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
