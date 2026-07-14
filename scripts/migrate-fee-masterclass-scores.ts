#!/usr/bin/env tsx
process.env.FIREBASE_SERVICE_ACCOUNT_PATH = 'serviceAccountKey.json';
import { adminDb } from '../src/lib/firebase-admin';
import type { Entity, WorkspaceEntity, LeadScoringSettings, EntityContact } from '../src/lib/types';

interface ScoreAdjustment {
  points: number;
  reason: string;
  logIds: string[];
}

/**
 * FER Protocol: Fee Collection MasterClass Automation Scoring Backfill (Paginated)
 * 
 * Run using:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=serviceAccountKey.json npx tsx scripts/migrate-fee-masterclass-scores.ts
 */
async function runFeeMasterClassBackfill(): Promise<void> {
  console.log('[FER:FEE_MASTERCLASS] Starting targeted Fee Collection MasterClass scoring backfill...');

  const targetAutomationId = 'lfgT23os0w6CEKhKqFeA';
  const targetNodeId = 'actionNode_1783606160394';
  const targetWorkspaceId = 'prospect';

  try {
    // 1. Load prospect workspace settings
    console.log('[FER:FEE_MASTERCLASS] Loading prospect workspace settings...');
    const wsSnap = await adminDb.collection('workspaces').doc(targetWorkspaceId).get();
    if (!wsSnap.exists) {
      throw new Error(`Workspace ${targetWorkspaceId} not found.`);
    }

    const wsData = wsSnap.data()!;
    const settings = (wsData.leadScoringSettings || {}) as LeadScoringSettings;
    const rules = settings.engagementRules || {
      'email_opened': 2,
      'email_clicked': 5,
      'email_bounced': -10
    };

    // 2. Fetch all message logs using pagination to prevent timeouts
    console.log('[FER:FEE_MASTERCLASS] Fetching message logs in pages of 1000...');
    let lastDoc = null;
    let allLogs: any[] = [];
    while (true) {
      let q = adminDb.collection('message_logs')
        .select(
          'recipient',
          'channel',
          'status',
          'providerStatus',
          'openedCount',
          'clickedCount',
          'workspaceId',
          'workspaceIds',
          'entityId',
          'isScored',
          'direction',
          'automationId',
          'nodeId'
        )
        .limit(1000);
        
      if (lastDoc) {
        q = q.startAfter(lastDoc);
      }
      
      const snap = await q.get();
      if (snap.empty) break;
      allLogs = allLogs.concat(snap.docs);
      lastDoc = snap.docs[snap.docs.length - 1];
      console.log(`[FER:FEE_MASTERCLASS] Loaded ${allLogs.length} logs...`);
      if (snap.docs.length < 1000) break;
    }

    const targetLogs = allLogs.filter(doc => {
      const data = doc.data();
      return (
        data.automationId === targetAutomationId &&
        data.nodeId === targetNodeId
      );
    });

    console.log(`[FER:FEE_MASTERCLASS] Found ${targetLogs.length} total logs for automation ${targetAutomationId} / step ${targetNodeId}.`);

    if (targetLogs.length === 0) {
      console.log('[FER:FEE_MASTERCLASS] No message logs found for this automation step. Exiting.');
      return;
    }

    // 3. Reset existing scoring history for this backfill to ensure idempotency (prevent double counting)
    console.log('[FER:FEE_MASTERCLASS] Checking for previous backfill history to undo...');
    const historySnap = await adminDb
      .collection('leadScoreHistory')
      .where('actorId', '==', 'fer-fee-masterclass-backfill')
      .get();

    if (!historySnap.empty) {
      console.log(`[FER:FEE_MASTERCLASS] Found ${historySnap.size} previous backfill history entries. Undoing scores first...`);
      const undoMap = new Map<string, Map<string, number>>(); // entityId -> contactId -> points to subtract

      historySnap.forEach(doc => {
        const hist = doc.data();
        const entityId = hist.entityId;
        const contactId = hist.contactId;
        const change = hist.change || 0;

        if (entityId && contactId && change !== 0) {
          if (!undoMap.has(entityId)) {
            undoMap.set(entityId, new Map<string, number>());
          }
          const contactMap = undoMap.get(entityId)!;
          contactMap.set(contactId, (contactMap.get(contactId) || 0) + change);
        }
      });

      // Execute undo transactionally
      console.log(`[FER:FEE_MASTERCLASS] Subtracting previous points from ${undoMap.size} entities...`);
      for (const [entityId, contactMap] of undoMap.entries()) {
        const entityRef = adminDb.collection('entities').doc(entityId);
        const weRef = adminDb.collection('workspace_entities').doc(`${targetWorkspaceId}_${entityId}`);

        try {
          await adminDb.runTransaction(async (transaction) => {
            const entitySnap = await transaction.get(entityRef);
            if (!entitySnap.exists) return;

            const weSnap = await transaction.get(weRef);
            if (!weSnap.exists) return;

            const entityData = entitySnap.data() as Entity;
            const contacts = (entityData.entityContacts || []).map(c => ({ ...c }));

            for (const [contactId, pointsToSubtract] of contactMap.entries()) {
              const contact = contacts.find(c => c.id === contactId);
              if (contact) {
                const oldScore = contact.score || 0;
                contact.score = Math.max(0, oldScore - pointsToSubtract);
              }
            }

            const newLeadScore = contacts.reduce((sum, c) => sum + (c.score || 0), 0);

            transaction.update(entityRef, {
              entityContacts: contacts,
              leadScore: newLeadScore,
              updatedAt: new Date().toISOString()
            });

            transaction.update(weRef, {
              entityContacts: contacts,
              leadScore: newLeadScore,
              updatedAt: new Date().toISOString()
            });
          });
        } catch (err) {
          console.error(`[FER:FEE_MASTERCLASS] Failed to undo points for entity ${entityId}:`, err);
        }
      }

      // Delete history entries
      const deleteBatch = adminDb.batch();
      historySnap.forEach(doc => {
        deleteBatch.delete(doc.ref);
      });
      await deleteBatch.commit();
      console.log('[FER:FEE_MASTERCLASS] Previous backfill history successfully cleared.');
    }

    // 4. Pre-fetch target entities
    const uniqueEntityIds = Array.from(
      new Set(
        targetLogs
          .map(logDoc => logDoc.data().entityId)
          .filter(Boolean) as string[]
      )
    );

    console.log(`[FER:FEE_MASTERCLASS] Pre-fetching ${uniqueEntityIds.length} unique entities in parallel...`);
    const entityCache = new Map<string, Entity | null>();
    const chunkSize = 500;
    for (let i = 0; i < uniqueEntityIds.length; i += chunkSize) {
      const chunk = uniqueEntityIds.slice(i, i + chunkSize);
      const refs = chunk.map(id => adminDb.collection('entities').doc(id));
      const snaps = await adminDb.getAll(...refs);
      snaps.forEach(snap => {
        if (snap.exists) {
          entityCache.set(snap.id, snap.data() as Entity);
        } else {
          entityCache.set(snap.id, null);
        }
      });
    }

    // Map of entityId -> contactId -> list of adjustments
    const adjustmentsMap = new Map<string, Map<string, ScoreAdjustment>>();
    const zeroPointsLogIds: string[] = [];

    // 5. Group score adjustments by contact
    console.log('[FER:FEE_MASTERCLASS] Resolving score adjustments...');
    for (const logDoc of targetLogs) {
      const log = logDoc.data();
      const logId = logDoc.id;
      const entityId = log.entityId;
      const recipient = log.recipient;
      const channel = log.channel;
      const status = log.status;
      const providerStatus = log.providerStatus;
      const openedCount = log.openedCount || 0;
      const clickedCount = log.clickedCount || 0;

      if (!entityId) {
        zeroPointsLogIds.push(logId);
        continue;
      }

      let points = 0;
      let reason = '';

      if (channel === 'email') {
        const isBounced = status === 'failed' || providerStatus === 'failed' || providerStatus === 'bounced';
        const isClicked = clickedCount > 0 || providerStatus === 'clicked';
        const isOpened = openedCount > 0 || providerStatus === 'opened';

        if (isBounced) {
          points = Number(rules['email_bounced'] ?? -10);
          reason = 'Fee Collection MasterClass: Email bounced';
        } else if (isClicked) {
          points = Number(rules['email_clicked'] ?? 5);
          reason = 'Fee Collection MasterClass: Email link clicked';
        } else if (isOpened) {
          points = Number(rules['email_opened'] ?? 2);
          reason = 'Fee Collection MasterClass: Email opened';
        }
      }

      if (points === 0) {
        zeroPointsLogIds.push(logId);
        continue;
      }

      const entityData = entityCache.get(entityId);
      if (!entityData) {
        zeroPointsLogIds.push(logId);
        continue;
      }

      const contacts: EntityContact[] = entityData.entityContacts || [];
      const cleanTarget = recipient.toLowerCase().trim();
      
      const targetContact = contacts.find(c => 
        c.id === cleanTarget || 
        c.email?.toLowerCase().trim() === cleanTarget || 
        c.phone?.trim() === cleanTarget
      );

      if (!targetContact) {
        zeroPointsLogIds.push(logId);
        continue;
      }

      const contactId = targetContact.id;

      // Initialize nested map if missing
      if (!adjustmentsMap.has(entityId)) {
        adjustmentsMap.set(entityId, new Map<string, ScoreAdjustment>());
      }
      const contactMap = adjustmentsMap.get(entityId)!;

      if (!contactMap.has(contactId)) {
        contactMap.set(contactId, { points: 0, reason: '', logIds: [] });
      }

      const current = contactMap.get(contactId)!;
      current.points += points;
      current.reason = current.reason ? `${current.reason}; ${reason}` : reason;
      current.logIds.push(logId);
    }

    console.log(`[FER:FEE_MASTERCLASS] Resolved adjustments for ${adjustmentsMap.size} entities.`);
    console.log(`[FER:FEE_MASTERCLASS] Total 0-point logs to update: ${zeroPointsLogIds.length}`);

    // 6. Restore / Save new scores in parallel transactional batches
    let updatedContactsCount = 0;
    const restoreBatchSize = 30;
    const adjustmentsArray = Array.from(adjustmentsMap.entries());
    const scoredLogIds: string[] = [];

    console.log(`[FER:FEE_MASTERCLASS] Restoring contact scores in parallel batches...`);
    for (let i = 0; i < adjustmentsArray.length; i += restoreBatchSize) {
      const chunk = adjustmentsArray.slice(i, i + restoreBatchSize);
      
      await Promise.all(chunk.map(async ([entityId, contactMap]) => {
        const entityRef = adminDb.collection('entities').doc(entityId);
        const weRef = adminDb.collection('workspace_entities').doc(`${targetWorkspaceId}_${entityId}`);

        try {
          await adminDb.runTransaction(async (transaction) => {
            const entitySnap = await transaction.get(entityRef);
            if (!entitySnap.exists) return;

            const weSnap = await transaction.get(weRef);
            if (!weSnap.exists) return;

            const entityData = entitySnap.data() as Entity;
            const contacts = (entityData.entityContacts || []).map(c => ({ ...c }));

            for (const [contactId, adjustment] of contactMap.entries()) {
              const contact = contacts.find(c => c.id === contactId);
              if (contact) {
                const oldScore = contact.score || 0;
                const newScore = Math.max(0, oldScore + adjustment.points);
                contact.score = newScore;

                // Record leadScoreHistory ledger entry
                const historyRef = adminDb.collection('leadScoreHistory').doc();
                transaction.set(historyRef, {
                  contactId,
                  entityId,
                  workspaceId: targetWorkspaceId,
                  oldScore,
                  newScore,
                  change: newScore - oldScore,
                  reason: adjustment.reason,
                  source: 'system',
                  actorId: 'fer-fee-masterclass-backfill',
                  actorType: 'System',
                  createdAt: new Date().toISOString()
                });

                // Mark log entries as processed by saving IDs
                adjustment.logIds.forEach(id => scoredLogIds.push(id));
                updatedContactsCount++;
              }
            }

            const newLeadScore = contacts.reduce((sum, c) => sum + (c.score || 0), 0);

            transaction.update(entityRef, {
              entityContacts: contacts,
              leadScore: newLeadScore,
              updatedAt: new Date().toISOString()
            });

            transaction.update(weRef, {
              entityContacts: contacts,
              leadScore: newLeadScore,
              updatedAt: new Date().toISOString()
            });
          });
        } catch (err) {
          console.error(`[FER:FEE_MASTERCLASS] Failed to restore scores for entity ${entityId}:`, err);
        }
      }));
    }

    // 7. Update all log entries as scored
    const allLogIdsToMark = [...zeroPointsLogIds, ...scoredLogIds];
    console.log(`[FER:FEE_MASTERCLASS] Committing ${allLogIdsToMark.length} log status completions in batches...`);
    const writeBatchSize = 500;
    for (let i = 0; i < allLogIdsToMark.length; i += writeBatchSize) {
      const chunk = allLogIdsToMark.slice(i, i + writeBatchSize);
      const batch = adminDb.batch();
      chunk.forEach(id => {
        batch.update(adminDb.collection('message_logs').doc(id), { isScored: true });
      });
      await batch.commit();
    }

    console.log(`[FER:FEE_MASTERCLASS] Targeted backfill complete. Updated ${updatedContactsCount} contact scores.`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown backfill error';
    console.error('[FER:FEE_MASTERCLASS] Targeted migration failed:', msg);
    process.exit(1);
  }
}

runFeeMasterClassBackfill().catch(err => {
  console.error('[FER:FEE_MASTERCLASS] Unhandled fatal error:', err);
  process.exit(1);
});
