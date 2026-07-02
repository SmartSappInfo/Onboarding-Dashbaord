'use server';

import { adminDb, FieldValue } from './firebase-admin';
import { syncContactProjectionForWE } from './contacts/contact-projection-writer';
import type { EntityContact, WorkspaceEntity, Entity } from './types';

// Types definition (strict TypeScript, no 'any')
export interface LeadScoreDoc {
  id: string;          // Maps to contactId
  contactId: string;   
  currentScore: number;
}

export interface LeadScoreHistoryDoc {
  id: string;          
  contactId: string;   
  oldScore: number;    
  newScore: number;    
  change: number;      
  reason: string;      
  source: 'user' | 'automation' | 'system';
  actorId: string;     
  actorType: 'User' | 'Automation' | 'API' | 'System';
  createdAt: string;   
}

export interface EffortRuleDoc {
  id: string;          // Maps to workspaceId_eventType
  workspaceId: string;
  organizationId: string;
  eventType: string;   
  entityType: string;  
  points: number;      
  enabled: boolean;    
  description: string; 
}

export interface EffortEventDoc {
  id: string;          
  eventType: string;   
  entityType: string;  
  entityId: string;    
  actorType: 'User' | 'Automation' | 'API' | 'System';
  actorId: string;     
  points: number;      
  metadata: Record<string, string | number | boolean>;
  createdAt: string;   
}

export interface UserEffortSummaryDoc {
  id: string;          // Maps to userId
  userId: string;
  totalPoints: number;
  meetings: number;    
  calls: number;       
  tasks: number;       
  deals: number;       
  campaigns: number;   
  lastUpdated: string; 
}

export interface UserProfileEffort extends UserEffortSummaryDoc {
  userName: string;
  userEmail: string;
  photoURL?: string;
}

export interface ScoringEvent {
  organizationId: string;
  workspaceId: string;
  eventType: string;   
  entityType: string;  
  entityId: string;    
  contactId?: string;  
  actorType: 'User' | 'Automation' | 'API' | 'System';
  actorId: string;     
  metadata?: Record<string, string | number | boolean>;
}

// Defaults list
export const DEFAULT_EFFORT_RULES: Omit<EffortRuleDoc, 'id' | 'workspaceId' | 'organizationId'>[] = [
  // CRM
  { eventType: 'lead_created', entityType: 'Lead', points: 5, enabled: true, description: 'Points awarded when a new lead/prospect is created.' },
  { eventType: 'lead_assigned', entityType: 'Lead', points: 2, enabled: true, description: 'Points awarded when a lead is assigned to a user.' },
  { eventType: 'lead_updated', entityType: 'Lead', points: 1, enabled: true, description: 'Points awarded when a lead profile is updated.' },
  { eventType: 'lead_merged', entityType: 'Lead', points: 5, enabled: true, description: 'Points awarded when duplicate leads are merged.' },
  { eventType: 'lead_converted', entityType: 'Lead', points: 20, enabled: true, description: 'Points awarded when a lead is converted into a client.' },
  { eventType: 'lead_archived', entityType: 'Lead', points: 0, enabled: false, description: 'Points awarded when a lead is archived.' },

  // Communication
  { eventType: 'email_sent', entityType: 'Contact', points: 2, enabled: true, description: 'Points awarded when an email is sent.' },
  { eventType: 'email_replied', entityType: 'Contact', points: 5, enabled: true, description: 'Points awarded when an email reply is received.' },
  { eventType: 'sms_sent', entityType: 'Contact', points: 2, enabled: true, description: 'Points awarded when an SMS is sent.' },
  { eventType: 'whatsapp_sent', entityType: 'Contact', points: 2, enabled: true, description: 'Points awarded when a WhatsApp message is sent.' },
  { eventType: 'phone_call_started', entityType: 'Contact', points: 1, enabled: true, description: 'Points awarded when an outbound phone call starts.' },
  { eventType: 'phone_call_completed', entityType: 'Contact', points: 10, enabled: true, description: 'Points awarded when a phone call is completed.' },
  { eventType: 'phone_call_connected', entityType: 'Contact', points: 5, enabled: true, description: 'Points awarded when a phone call connects with a contact.' },
  { eventType: 'call_recording_saved', entityType: 'Contact', points: 2, enabled: true, description: 'Points awarded when a call recording is saved.' },
  { eventType: 'voicemail_left', entityType: 'Contact', points: 3, enabled: true, description: 'Points awarded when a voicemail is left.' },

  // Meetings
  { eventType: 'meeting_scheduled', entityType: 'Meeting', points: 5, enabled: true, description: 'Points awarded when a meeting is scheduled.' },
  { eventType: 'meeting_rescheduled', entityType: 'Meeting', points: 2, enabled: true, description: 'Points awarded when a meeting is rescheduled.' },
  { eventType: 'meeting_completed', entityType: 'Meeting', points: 25, enabled: true, description: 'Points awarded when a meeting is successfully completed.' },
  { eventType: 'meeting_cancelled', entityType: 'Meeting', points: 0, enabled: false, description: 'Points awarded when a meeting is cancelled.' },
  { eventType: 'meeting_attended', entityType: 'Meeting', points: 20, enabled: true, description: 'Points awarded when a contact attends a meeting.' },
  { eventType: 'meeting_notes_added', entityType: 'Meeting', points: 3, enabled: true, description: 'Points awarded when meeting notes are recorded.' },

  // Tasks
  { eventType: 'task_created', entityType: 'Task', points: 1, enabled: true, description: 'Points awarded when a task is created.' },
  { eventType: 'task_completed', entityType: 'Task', points: 5, enabled: true, description: 'Points awarded when a task is completed.' },
  { eventType: 'task_reopened', entityType: 'Task', points: 0, enabled: false, description: 'Points awarded when a task is reopened.' },
  { eventType: 'checklist_completed', entityType: 'Task', points: 2, enabled: true, description: 'Points awarded when a sub-task checklist is completed.' },

  // Deals
  { eventType: 'deal_created', entityType: 'Deal', points: 10, enabled: true, description: 'Points awarded when a new sales deal is created.' },
  { eventType: 'deal_stage_changed', entityType: 'Deal', points: 5, enabled: true, description: 'Points awarded when a deal is progressed in the pipeline.' },
  { eventType: 'deal_won', entityType: 'Deal', points: 100, enabled: true, description: 'Points awarded when a deal is closed won.' },
  { eventType: 'deal_lost', entityType: 'Deal', points: 0, enabled: false, description: 'Points awarded when a deal is closed lost.' },

  // Documents
  { eventType: 'proposal_sent', entityType: 'Contact', points: 10, enabled: true, description: 'Points awarded when a proposal document is sent.' },
  { eventType: 'quote_sent', entityType: 'Contact', points: 5, enabled: true, description: 'Points awarded when a quote document is sent.' },
  { eventType: 'invoice_sent', entityType: 'Contact', points: 5, enabled: true, description: 'Points awarded when an invoice is sent.' },
  { eventType: 'form_sent', entityType: 'Contact', points: 2, enabled: true, description: 'Points awarded when a signature form is sent.' },
  { eventType: 'form_signed', entityType: 'Contact', points: 15, enabled: true, description: 'Points awarded when a form is signed.' },
  { eventType: 'contract_signed', entityType: 'Contact', points: 30, enabled: true, description: 'Points awarded when a contract is signed.' },

  // Surveys
  { eventType: 'survey_sent', entityType: 'Survey', points: 3, enabled: true, description: 'Points awarded when a survey is sent.' },
  { eventType: 'survey_completed', entityType: 'Survey', points: 15, enabled: true, description: 'Points awarded when a survey is completed.' },

  // Notes
  { eventType: 'note_created', entityType: 'Contact', points: 2, enabled: true, description: 'Points awarded when a note is logged.' },
  { eventType: 'comment_added', entityType: 'Contact', points: 1, enabled: true, description: 'Points awarded when a comment is added to a note.' },
  { eventType: 'attachment_uploaded', entityType: 'Contact', points: 2, enabled: true, description: 'Points awarded when an attachment is uploaded.' },

  // System
  { eventType: 'automation_executed', entityType: 'Contact', points: 1, enabled: true, description: 'Points awarded when an automation workflow is executed.' },
  { eventType: 'webhook_triggered', entityType: 'Contact', points: 1, enabled: true, description: 'Points awarded when an external webhook is received.' }
];

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
      organizationId,
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

      const { contacts: updatedContacts, contactId, contactName, oldScore, newScore, change } =
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
export async function evaluateEffortEvent(event: ScoringEvent): Promise<void> {
  try {
    const { organizationId, workspaceId, eventType, entityType, entityId, actorType, actorId, metadata } = event;
    if (!workspaceId || !actorId || actorId === 'system-scoring-engine') return;

    // Seeding trigger check
    await seedDefaultRules(organizationId, workspaceId);

    const ruleRef = adminDb.collection('effortRules').doc(`${workspaceId}_${eventType}`);
    const ruleSnap = await ruleRef.get();

    let points = 0;
    let enabled = false;

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

    if (!enabled || points === 0) return;

    const now = new Date().toISOString();

    // ledger document
    const ledgerRef = adminDb.collection('effortEvents').doc();
    const ledgerDoc: EffortEventDoc = {
      id: ledgerRef.id,
      eventType,
      entityType,
      entityId,
      actorType,
      actorId,
      points,
      metadata: metadata || {},
      createdAt: now
    };
    await ledgerRef.set(ledgerDoc);

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

    // Update userEffortSummary
    const summaryRef = adminDb.collection('userEffortSummary').doc(actorId);
    await adminDb.runTransaction(async (transaction) => {
      const summarySnap = await transaction.get(summaryRef);

      const isMeeting = eventType.includes('meeting') || eventType.includes('appointment');
      const isCall = eventType.includes('call') || eventType.includes('phone');
      const isTask = eventType.includes('task') || eventType.includes('checklist');
      const isDeal = eventType.includes('deal');
      const isCampaign = eventType.includes('campaign');

      if (summarySnap.exists) {
        transaction.update(summaryRef, {
          totalPoints: FieldValue.increment(points),
          meetings: FieldValue.increment(isMeeting ? 1 : 0),
          calls: FieldValue.increment(isCall ? 1 : 0),
          tasks: FieldValue.increment(isTask ? 1 : 0),
          deals: FieldValue.increment(isDeal ? 1 : 0),
          campaigns: FieldValue.increment(isCampaign ? 1 : 0),
          lastUpdated: now
        });
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
        transaction.set(summaryRef, initialDoc);
      }
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown evaluation error';
    console.error('[scoring-engine] evaluateEffortEvent failed:', errorMsg);
  }
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
    const pointsIncrement = rules[eventType];

    if (pointsIncrement && pointsIncrement !== 0) {
      await adjustLeadScoreAction({
        organizationId,
        workspaceId,
        entityId,
        contactEmailOrId: contactId || (metadata?.email as string) || (metadata?.contactId as string),
        value: Math.abs(pointsIncrement),
        operation: pointsIncrement < 0 ? 'subtract' : 'add',
        reason: `Engagement triggered: ${eventType}`,
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
export async function getLeaderboardAction(organizationId: string): Promise<UserProfileEffort[]> {
  try {
    const summarySnap = await adminDb.collection('userEffortSummary').get();
    if (summarySnap.empty) return [];

    const usersSnap = await adminDb
      .collection('users')
      .where('organizationId', '==', organizationId)
      .get();

    const usersMap = new Map<string, { name: string; email: string; photoURL?: string }>();
    usersSnap.forEach(d => {
      const data = d.data();
      usersMap.set(d.id, {
        name: data.name || 'Anonymous User',
        email: data.email || '',
        photoURL: data.photoURL
      });
    });

    const leaderboard: UserProfileEffort[] = [];
    summarySnap.docs.forEach(doc => {
      const data = doc.data() as UserEffortSummaryDoc;
      const userMeta = usersMap.get(doc.id);
      if (userMeta) {
        leaderboard.push({
          ...data,
          userName: userMeta.name,
          userEmail: userMeta.email,
          photoURL: userMeta.photoURL
        });
      }
    });

    return leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
  } catch (err) {
    console.error('[scoring-engine] getLeaderboardAction failed:', err);
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
    const { organizationId, workspaceId, contactRefs, value, operation, actorId, actorType } = params;

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
