'use server';

import { adminDb, FieldValue } from './firebase-admin';
import { syncContactProjectionForWE } from './contacts/contact-projection-writer';
import type { EntityContact, WorkspaceEntity, Entity } from './types';
import type { PerformancePolicy } from '@/lib/policy-studio/types';
import { evaluateEventUnderPolicy } from '@/lib/policy-studio/policy-engine';

// Re-export strict TypeScript types (types are erased at runtime by TS compiler)
export type {
  LeadScoreDoc,
  LeadScoreHistoryDoc,
  EffortRuleDoc,
  EffortEventDoc,
  UserEffortSummaryDoc,
  UserProfileEffort,
  ScoringEvent,
} from './scoring-constants';

import {
  DEFAULT_EFFORT_RULES,
  type LeadScoreDoc,
  type LeadScoreHistoryDoc,
  type EffortRuleDoc,
  type EffortEventDoc,
  type UserEffortSummaryDoc,
  type UserProfileEffort,
  type ScoringEvent,
} from './scoring-constants';

/**
 * Seeding default effort rules into Firestore for a workspace.
 */
export async function seedDefaultRules(organizationId: string, workspaceId: string): Promise<void> {
  const collectionRef = adminDb.collection('effortRules');
  const snap = await collectionRef
    .where('workspaceId', '==', workspaceId)
    .limit(1)
    .get();

  if (!snap.empty) return;

  const batch = adminDb.batch();
  for (const r of DEFAULT_EFFORT_RULES) {
    const docId = `${workspaceId}_${r.eventType}`;
    const docRef = collectionRef.doc(docId);
    batch.set(docRef, {
      id: docId,
      workspaceId,
      organizationId,
      eventType: r.eventType,
      entityType: r.entityType,
      points: r.points,
      enabled: r.enabled,
      description: r.description
    });
  }
  await batch.commit();
}

/**
 * Helper to adjust a contact's score within the contacts array.
 */
function adjustContactScoreInArray(
  contacts: EntityContact[],
  contactEmailOrId: string | undefined,
  value: number,
  operation: 'add' | 'subtract' | 'set' | 'reset'
): { contacts: EntityContact[]; contactId: string; contactName: string; oldScore: number; newScore: number; change: number } {
  const updated = contacts.map(c => ({ ...c }));
  if (updated.length === 0) {
    return { contacts: updated, contactId: '', contactName: '', oldScore: 0, newScore: 0, change: 0 };
  }

  const cleanTarget = contactEmailOrId?.toLowerCase().trim();
  let index = -1;

  if (cleanTarget) {
    index = updated.findIndex(c => c.id === contactEmailOrId || c.email?.toLowerCase().trim() === cleanTarget);
  }
  if (index === -1) {
    index = updated.findIndex(c => c.isPrimary);
  }
  if (index === -1) {
    index = 0;
  }

  const contact = updated[index];
  const oldScore = contact.score || 0;
  let newScore = oldScore;

  if (operation === 'add') {
    newScore = oldScore + value;
  } else if (operation === 'subtract') {
    newScore = Math.max(0, oldScore - value);
  } else if (operation === 'set') {
    newScore = Math.max(0, value);
  } else if (operation === 'reset') {
    newScore = 0;
  }

  contact.score = newScore;
  const change = newScore - oldScore;

  return {
    contacts: updated,
    contactId: contact.id,
    contactName: contact.name,
    oldScore,
    newScore,
    change
  };
}

/**
 * Server Action: Modify a contact's lead score. Runs transactionally.
 */
export async function adjustLeadScoreAction(params: {
  organizationId: string;
  workspaceId: string;
  entityId: string;
  contactEmailOrId?: string;
  value: number;
  operation: 'add' | 'subtract' | 'set' | 'reset';
  reason: string;
  source: 'user' | 'automation' | 'system';
  actorId: string;
  actorType: 'User' | 'Automation' | 'API' | 'System';
}): Promise<{ success: boolean; error?: string; change?: number }> {
  try {
    const {
      organizationId: _organizationId,
      workspaceId,
      entityId,
      contactEmailOrId,
      value,
      operation,
      reason,
      source,
      actorId,
      actorType
    } = params;

    const entityRef = adminDb.collection('entities').doc(entityId);
    const weQuery = adminDb
      .collection('workspace_entities')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .limit(1);

    const result = await adminDb.runTransaction(async (transaction) => {
      const entitySnap = await transaction.get(entityRef);
      if (!entitySnap.exists) {
        throw new Error(`Entity ${entityId} not found.`);
      }

      const weSnap = await transaction.get(weQuery);
      if (weSnap.empty) {
        throw new Error(`WorkspaceEntity relationship not found for entity ${entityId} in workspace ${workspaceId}.`);
      }

      const weDoc = weSnap.docs[0];
      const entityData = entitySnap.data() as Entity;
      const weData = weDoc.data() as WorkspaceEntity;

      const entityContacts = entityData.entityContacts || [];

      const { contacts: updatedContacts, contactId, contactName: _contactName, oldScore, newScore, change } =
        adjustContactScoreInArray(entityContacts, contactEmailOrId, value, operation);

      if (!contactId) {
        throw new Error('Could not resolve target contact for score adjustment.');
      }

      const totalLeadScore = updatedContacts.reduce((sum, c) => sum + (c.score || 0), 0);

      // Perform updates
      transaction.update(entityRef, {
        entityContacts: updatedContacts,
        leadScore: totalLeadScore,
        updatedAt: new Date().toISOString()
      });

      transaction.update(weDoc.ref, {
        entityContacts: updatedContacts,
        leadScore: totalLeadScore,
        updatedAt: new Date().toISOString()
      });

      // Write current score mapping
      const scoreRef = adminDb.collection('leadScores').doc(contactId);
      transaction.set(scoreRef, {
        id: contactId,
        contactId,
        currentScore: newScore
      });

      // Write scoring ledger entry
      const historyRef = adminDb.collection('leadScoreHistory').doc();
      const historyEntry: LeadScoreHistoryDoc = {
        id: historyRef.id,
        contactId,
        oldScore,
        newScore,
        change,
        reason: reason || `Manual score adjustment: ${operation}`,
        source,
        actorId,
        actorType,
        createdAt: new Date().toISOString()
      };
      transaction.set(historyRef, historyEntry);

      return { change, updatedWE: { ...weData, entityContacts: updatedContacts, leadScore: totalLeadScore } };
    });

    // Sync projection outside transaction scope for efficiency
    if (result.updatedWE) {
      await syncContactProjectionForWE(result.updatedWE);
    }

    return { success: true, change: result.change };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown adjustment failure';
    console.error('[scoring-engine] adjustLeadScoreAction failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Evaluates effort events and adds salesperson stats.
 */
export async function evaluateEffortEvent(event: ScoringEvent): Promise<{ pointsAwarded: number }> {
  try {
    const { organizationId, workspaceId, eventType, entityType, entityId, actorType, actorId, metadata, durationSeconds } = event;
    if (!workspaceId || !actorId || actorId === 'system-scoring-engine') return { pointsAwarded: 0 };

    // Seeding trigger check
    await seedDefaultRules(organizationId, workspaceId);

    let points = 0;
    let enabled = false;

    // Check if workspace has an active PerformancePolicy (Phase 4 Policy Studio)
    const todayDate = new Date().toISOString().split('T')[0];
    const [policySnap, dailySnap, recentEventsSnap] = await Promise.all([
      adminDb.collection('performancePolicies').doc(workspaceId).get(),
      adminDb.collection('salesPerformanceDaily').doc(`${workspaceId}_${actorId}_${todayDate}`).get(),
      entityId
        ? adminDb
            .collection('effortEvents')
            .where('actorId', '==', actorId)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get()
        : Promise.resolve(null),
    ]);

    let dailyEventCount = 0;
    if (dailySnap && dailySnap.exists) {
      dailyEventCount = dailySnap.data()?.activityCount || 0;
    }

    let lastEventTimeForSameEntity: string | undefined;
    if (recentEventsSnap && !recentEventsSnap.empty) {
      const match = recentEventsSnap.docs.find((d) => d.data().entityId === entityId);
      if (match) {
        lastEventTimeForSameEntity = match.data().createdAt;
      }
    }

    if (policySnap.exists) {
      const policy = policySnap.data() as PerformancePolicy;
      const evalRes = evaluateEventUnderPolicy({
        event: {
          eventType,
          entityId,
          actorId,
          durationSeconds,
          isMachine: actorType !== 'User',
          occurredAt: new Date().toISOString(),
          metadata: metadata as Record<string, string | number | boolean>,
        },
        policy,
        dailyEventCountForActor: dailyEventCount,
        lastEventTimeForSameEntity,
      });
      points = evalRes.pointsAwarded;
      enabled = points > 0;
    } else {
      // Baseline fallback to effortRules
      const ruleRef = adminDb.collection('effortRules').doc(`${workspaceId}_${eventType}`);
      const ruleSnap = await ruleRef.get();

      if (ruleSnap.exists) {
        const data = ruleSnap.data() as EffortRuleDoc;
        points = data.points;
        enabled = data.enabled;
      } else {
        const defaultRule = DEFAULT_EFFORT_RULES.find(r => r.eventType === eventType);
        if (defaultRule) {
          points = defaultRule.points;
          enabled = defaultRule.enabled;
        }
      }
    }

    if (!enabled || points === 0) return { pointsAwarded: 0 };

    const now = new Date().toISOString();
    const today = now.split('T')[0];
    const isMachine = actorType !== 'User';

    // 1. Ledger Document: canonical write to 'effortEvents' with workspace partitioning
    const ledgerRef = adminDb.collection('effortEvents').doc();
    const ledgerDoc: EffortEventDoc = {
      id: ledgerRef.id,
      workspaceId,
      organizationId,
      eventType,
      entityType,
      entityId,
      actorType,
      actorId,
      points,
      isMachine,
      metadata: { ...(metadata || {}), ...(durationSeconds ? { durationSeconds } : {}) },
      idempotencyKey: metadata?.idempotencyKey ? String(metadata.idempotencyKey) : undefined,
      createdAt: now
    };
    await ledgerRef.set(ledgerDoc);

    // Dual-write to 'effortScoringLedger' for backward compatibility with existing indexes/clients
    try {
      const legacyLedgerRef = adminDb.collection('effortScoringLedger').doc(ledgerRef.id);
      await legacyLedgerRef.set(ledgerDoc);
    } catch (dualWriteErr) {
      console.warn('[scoring-engine] Dual-write to legacy effortScoringLedger failed:', dualWriteErr);
    }

    if (metadata?.activityId) {
      try {
        const actRef = adminDb.collection('activities').doc(String(metadata.activityId));
        await actRef.update({
          'metadata.effortPoints': points
        });
      } catch (e) {
        console.error('[scoring-engine] Failed to append effortPoints to activity:', e);
      }
    }

    // 2. Machine Activity Guard: Only award human sales representative points if actor is a User
    if (isMachine) {
      return { pointsAwarded: 0 };
    }

    // 3. Update workspace-partitioned userEffortSummary (${workspaceId}_${actorId}) AND legacy (${actorId})
    const isMeeting = eventType.includes('meeting') || eventType.includes('appointment');
    const isCall = eventType.includes('call') || eventType.includes('phone');
    const isTask = eventType.includes('task') || eventType.includes('checklist');
    const isDeal = eventType.includes('deal') || eventType.includes('forecast') || eventType.includes('attribution');
    const isCampaign = eventType.includes('campaign');

    const workspaceSummaryRef = adminDb.collection('userEffortSummary').doc(`${workspaceId}_${actorId}`);
    const legacySummaryRef = adminDb.collection('userEffortSummary').doc(actorId);

    await adminDb.runTransaction(async (transaction) => {
      const [wsSnap, legSnap] = await Promise.all([
        transaction.get(workspaceSummaryRef),
        transaction.get(legacySummaryRef)
      ]);

      const incrementFields = {
        totalPoints: FieldValue.increment(points),
        meetings: FieldValue.increment(isMeeting ? 1 : 0),
        calls: FieldValue.increment(isCall ? 1 : 0),
        tasks: FieldValue.increment(isTask ? 1 : 0),
        deals: FieldValue.increment(isDeal ? 1 : 0),
        campaigns: FieldValue.increment(isCampaign ? 1 : 0),
        lastUpdated: now
      };

      // Workspace-scoped document
      if (wsSnap.exists) {
        transaction.update(workspaceSummaryRef, incrementFields);
      } else {
        const initialDoc: UserEffortSummaryDoc = {
          id: `${workspaceId}_${actorId}`,
          userId: actorId,
          workspaceId,
          organizationId,
          totalPoints: points,
          meetings: isMeeting ? 1 : 0,
          calls: isCall ? 1 : 0,
          tasks: isTask ? 1 : 0,
          deals: isDeal ? 1 : 0,
          campaigns: isCampaign ? 1 : 0,
          lastUpdated: now
        };
        transaction.set(workspaceSummaryRef, initialDoc);
      }

      // Legacy global document (ensures backward compatibility)
      if (legSnap.exists) {
        transaction.update(legacySummaryRef, incrementFields);
      } else {
        const initialDoc: UserEffortSummaryDoc = {
          id: actorId,
          userId: actorId,
          totalPoints: points,
          meetings: isMeeting ? 1 : 0,
          calls: isCall ? 1 : 0,
          tasks: isTask ? 1 : 0,
          deals: isDeal ? 1 : 0,
          campaigns: isCampaign ? 1 : 0,
          lastUpdated: now
        };
        transaction.set(legacySummaryRef, initialDoc);
      }
    });

    // 4. Ingest into daily bucket: salesPerformanceDaily/${workspaceId}_${actorId}_${today}
    try {
      const dailyRef = adminDb.collection('salesPerformanceDaily').doc(`${workspaceId}_${actorId}_${today}`);
      await dailyRef.set({
        id: `${workspaceId}_${actorId}_${today}`,
        organizationId,
        workspaceId,
        userId: actorId,
        date: today,
        activityCount: FieldValue.increment(1),
        points: FieldValue.increment(points),
        calls: FieldValue.increment(isCall ? 1 : 0),
        meetings: FieldValue.increment(isMeeting ? 1 : 0),
        tasks: FieldValue.increment(isTask ? 1 : 0),
        deals: FieldValue.increment(isDeal ? 1 : 0),
        campaigns: FieldValue.increment(isCampaign ? 1 : 0),
        emails: FieldValue.increment(eventType.includes('email') ? 1 : 0),
        updatedAt: now
      }, { merge: true });
    } catch (dailyErr) {
      console.warn('[scoring-engine] Daily aggregate bucketing failed:', dailyErr);
    }

    return { pointsAwarded: points };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown evaluation error';
    console.error('[scoring-engine] evaluateEffortEvent failed:', errorMsg);
    return { pointsAwarded: 0 };
  }
}

/**
 * Translates raw activity type and metadata into lead-scoring mapping keys.
 */
export async function resolveEngagementRuleKey(
  eventType: string,
  metadata?: Record<string, string | number | boolean>
): Promise<string> {
  if (eventType === 'campaign_event' && metadata) {
    const channel = String(metadata.channel || '').toLowerCase();
    const event = String(metadata.event || '').toLowerCase();
    if (channel === 'email') {
      if (event === 'opened') return 'email_opened';
      if (event === 'clicked') return 'email_clicked';
      if (event === 'failed') return 'email_bounced';
    } else if (channel === 'sms') {
      if (event === 'clicked') return 'sms_link_clicked';
      if (event === 'failed') return 'sms_failed';
    }
  }

  if (eventType === 'webpage_visited') {
    return 'page_visited';
  }
  if (eventType === 'button_clicked') {
    return 'button_clicked';
  }
  if (eventType === 'survey_started') {
    return 'survey_started';
  }
  if (eventType === 'form_submission') {
    return 'survey_completed';
  }
  if (eventType === 'pdf_form_submitted' || eventType === 'form_submitted') {
    return 'document_signed';
  }

  return eventType;
}

/**
 * Coordinator mapping event types to scores. Called by activity log bus.
 */
export async function emitScoringEvent(event: ScoringEvent): Promise<void> {
  const { organizationId, workspaceId, eventType, entityId, contactId, actorId, actorType, metadata } = event;
  
  // 1. Process Effort Points
  await evaluateEffortEvent(event);

  // 2. Process Lead Score (based on workspace settings config rules mapping)
  try {
    const wsSnap = await adminDb.collection('workspaces').doc(workspaceId).get();
    const wsData = wsSnap.data();
    const rules = wsData?.leadScoringSettings?.engagementRules || {};
    
    let pointsIncrement = 0;
    const resolvedKey = await resolveEngagementRuleKey(eventType, metadata);
    
    if (eventType === 'call_completed' && metadata?.outcome) {
      const outcomeValue = String(metadata.outcome);
      const explicitOutcomeKey = `call_outcome:${outcomeValue}`;
      
      if (rules[explicitOutcomeKey] !== undefined) {
        pointsIncrement = rules[explicitOutcomeKey];
      } else {
        const positiveOutcomes = wsData?.leadScoringSettings?.callCampaignPositiveOutcomes || [];
        if (positiveOutcomes.includes(outcomeValue)) {
          pointsIncrement = wsData?.leadScoringSettings?.callCampaignDefaultPoints || 0;
        }
      }
    } else {
      pointsIncrement = rules[resolvedKey] || 0;
    }

    if (pointsIncrement && pointsIncrement !== 0) {
      await adjustLeadScoreAction({
        organizationId,
        workspaceId,
        entityId,
        contactEmailOrId: contactId || (metadata?.email as string) || (metadata?.contactId as string),
        value: Math.abs(pointsIncrement),
        operation: pointsIncrement < 0 ? 'subtract' : 'add',
        reason: `Engagement triggered: ${resolvedKey}`,
        source: actorType === 'Automation' ? 'automation' : actorType === 'System' ? 'system' : 'user',
        actorId,
        actorType
      });

      if (metadata?.activityId) {
        try {
          const actRef = adminDb.collection('activities').doc(String(metadata.activityId));
          await actRef.update({
            'metadata.leadScoreChange': pointsIncrement
          });
        } catch (e) {
          console.error('[scoring-engine] Failed to append leadScoreChange to activity:', e);
        }
      }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown score mapping failure';
    console.error('[scoring-engine] emitScoringEvent lead-score routing failed:', errorMsg);
  }
}

/**
 * Fetch leaderboard performance details.
 */
export async function getLeaderboardAction(organizationId: string, workspaceId?: string): Promise<UserProfileEffort[]> {
  try {
    const usersSnap = await adminDb
      .collection('users')
      .where('organizationId', '==', organizationId)
      .get();

    if (usersSnap.empty) return [];

    const usersMap = new Map<string, { name: string; email: string; photoURL?: string }>();
    usersSnap.forEach(d => {
      const data = d.data();
      usersMap.set(d.id, {
        name: data.name || 'Anonymous User',
        email: data.email || '',
        photoURL: data.photoURL
      });
    });

    // Query userEffortSummary
    const summarySnap = await adminDb.collection('userEffortSummary').get();
    if (summarySnap.empty) return [];

    const summariesByUserId = new Map<string, UserEffortSummaryDoc>();

    summarySnap.docs.forEach(doc => {
      const data = doc.data() as UserEffortSummaryDoc;
      const docId = doc.id;

      if (workspaceId && docId.startsWith(`${workspaceId}_`)) {
        const rawUserId = docId.replace(`${workspaceId}_`, '');
        summariesByUserId.set(rawUserId, data);
      } else if (!summariesByUserId.has(docId)) {
        summariesByUserId.set(docId, data);
      }
    });

    const leaderboard: UserProfileEffort[] = [];
    usersMap.forEach((userMeta, userId) => {
      const summary = summariesByUserId.get(userId);
      if (summary) {
        leaderboard.push({
          ...summary,
          userId,
          userName: userMeta.name,
          userEmail: userMeta.email,
          photoURL: userMeta.photoURL
        });
      }
    });

    return leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[scoring-engine] getLeaderboardAction failed:', errorMsg);
    return [];
  }
}

/**
 * Server Action: Retrieve effort rules for a workspace.
 */
export async function getEffortRulesAction(organizationId: string, workspaceId: string): Promise<EffortRuleDoc[]> {
  try {
    await seedDefaultRules(organizationId, workspaceId);
    const snap = await adminDb.collection('effortRules')
      .where('workspaceId', '==', workspaceId)
      .get();
    
    const rules: EffortRuleDoc[] = [];
    snap.forEach(d => {
      rules.push(d.data() as EffortRuleDoc);
    });

    return rules;
  } catch (err) {
    console.error('[scoring-engine] getEffortRulesAction failed:', err);
    return [];
  }
}

/**
 * Server Action: Update a specific effort rule.
 */
export async function saveEffortRuleAction(
  workspaceId: string,
  ruleId: string,
  points: number,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const ruleRef = adminDb.collection('effortRules').doc(ruleId);
    const snap = await ruleRef.get();
    if (!snap.exists) {
      throw new Error(`Rule ${ruleId} not found.`);
    }

    const data = snap.data() as EffortRuleDoc;
    if (data.workspaceId !== workspaceId) {
      throw new Error('Unauthorized modifications to rule parameters.');
    }

    await ruleRef.update({
      points,
      enabled,
      updatedAt: new Date().toISOString()
    });

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update rule';
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Reset effort rules to system defaults.
 */
export async function resetEffortRulesToDefaultsAction(
  organizationId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const collectionRef = adminDb.collection('effortRules');
    const snap = await collectionRef
      .where('workspaceId', '==', workspaceId)
      .get();

    const batch = adminDb.batch();
    snap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    await seedDefaultRules(organizationId, workspaceId);

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Reset failed';
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Bulk adjust scores for multiple contacts.
 */
export async function bulkAdjustScoresAction(params: {
  organizationId: string;
  workspaceId: string;
  contactRefs: Array<{ entityId: string; contactId: string }>;
  value: number;
  operation: 'add' | 'subtract' | 'reset';
  actorId: string;
  actorType: 'User' | 'Automation' | 'API' | 'System';
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { organizationId: _organizationId, workspaceId, contactRefs, value, operation, actorId, actorType } = params;

    const entityGroupMap = new Map<string, string[]>();
    contactRefs.forEach(ref => {
      const arr = entityGroupMap.get(ref.entityId) || [];
      arr.push(ref.contactId);
      entityGroupMap.set(ref.entityId, arr);
    });

    const timestamp = new Date().toISOString();

    await adminDb.runTransaction(async (transaction) => {
      for (const [entityId, contactIds] of entityGroupMap.entries()) {
        const entityRef = adminDb.collection('entities').doc(entityId);
        const weQuery = adminDb
          .collection('workspace_entities')
          .where('entityId', '==', entityId)
          .where('workspaceId', '==', workspaceId)
          .limit(1);

        const entitySnap = await transaction.get(entityRef);
        if (!entitySnap.exists) continue;

        const weSnap = await transaction.get(weQuery);
        if (weSnap.empty) continue;

        const weDoc = weSnap.docs[0];
        const entityData = entitySnap.data() as Entity;
        let entityContacts = entityData.entityContacts || [];

        for (const contactId of contactIds) {
          const { contacts: updatedContacts, oldScore, newScore, change } =
            adjustContactScoreInArray(entityContacts, contactId, value, operation);

          entityContacts = updatedContacts;

          // Write current score mapping
          const scoreRef = adminDb.collection('leadScores').doc(contactId);
          transaction.set(scoreRef, {
            id: contactId,
            contactId,
            currentScore: newScore
          });

          // Write scoring ledger entry
          const historyRef = adminDb.collection('leadScoreHistory').doc();
          transaction.set(historyRef, {
            id: historyRef.id,
            contactId,
            oldScore,
            newScore,
            change,
            reason: `Bulk score adjustment: ${operation} (${value} points)`,
            source: 'user',
            actorId,
            actorType,
            createdAt: timestamp
          });
        }

        const totalLeadScore = entityContacts.reduce((sum, c) => sum + (c.score || 0), 0);

        transaction.update(entityRef, {
          entityContacts,
          leadScore: totalLeadScore,
          updatedAt: timestamp
        });

        transaction.update(weDoc.ref, {
          entityContacts,
          leadScore: totalLeadScore,
          updatedAt: timestamp
        });
      }
    });

    // Re-sync projections outside transaction
    for (const entityId of entityGroupMap.keys()) {
      const weSnap = await adminDb
        .collection('workspace_entities')
        .where('entityId', '==', entityId)
        .where('workspaceId', '==', workspaceId)
        .limit(1)
        .get();

      if (!weSnap.empty) {
        await syncContactProjectionForWE(weSnap.docs[0].data() as WorkspaceEntity);
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Bulk adjustment failed';
    console.error('[scoring-engine] bulkAdjustScoresAction failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Bulk archive parent entities.
 */
export async function bulkArchiveEntitiesAction(
  workspaceId: string,
  entityIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const timestamp = new Date().toISOString();
    const batch = adminDb.batch();

    for (const entityId of entityIds) {
      const weSnap = await adminDb.collection('workspace_entities')
        .where('entityId', '==', entityId)
        .where('workspaceId', '==', workspaceId)
        .limit(1)
        .get();

      if (!weSnap.empty) {
        batch.update(weSnap.docs[0].ref, { status: 'archived', updatedAt: timestamp });
      }

      batch.update(adminDb.collection('entities').doc(entityId), { status: 'archived', updatedAt: timestamp });
    }

    await batch.commit();
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Bulk archive failed';
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Bulk delete relationships.
 */
export async function bulkDeleteEntitiesAction(
  workspaceId: string,
  entityIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const batch = adminDb.batch();

    for (const entityId of entityIds) {
      const weSnap = await adminDb.collection('workspace_entities')
        .where('entityId', '==', entityId)
        .where('workspaceId', '==', workspaceId)
        .limit(1)
        .get();

      if (!weSnap.empty) {
        batch.delete(weSnap.docs[0].ref);
      }
    }

    await batch.commit();
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Bulk delete failed';
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Bulk assign entities.
 */
export async function bulkAssignEntitiesAction(
  workspaceId: string,
  entityIds: string[],
  userId: string | null,
  userName: string | null,
  userEmail: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const timestamp = new Date().toISOString();
    const batch = adminDb.batch();

    for (const entityId of entityIds) {
      const weSnap = await adminDb.collection('workspace_entities')
        .where('entityId', '==', entityId)
        .where('workspaceId', '==', workspaceId)
        .limit(1)
        .get();

      if (!weSnap.empty) {
        batch.update(weSnap.docs[0].ref, {
          assignedTo: userId ? { userId, name: userName, email: userEmail } : null,
          updatedAt: timestamp
        });
      }
    }

    await batch.commit();
    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Bulk assign failed';
    return { success: false, error: errorMsg };
  }
}
