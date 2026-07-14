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
 * FER Protocol: Message Logs Historical Scoring Seeder (Lightweight Pure Transactions)
 * 
 * Run using:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=serviceAccountKey.json npx tsx scripts/migrate-message-scores.ts
 */
async function runMessageScoringMigration(): Promise<void> {
  console.log('[FER:MESSAGE_SCORING] Starting historical message logs scoring backfill...');

  try {
    // 1. Load global defaults for fallback
    const globalSettingsSnap = await adminDb.collection('system_settings').doc('lead_scoring').get();
    const globalSettings = globalSettingsSnap.exists
      ? (globalSettingsSnap.data() as LeadScoringSettings)
      : {
          engagementRules: {
            'email_opened': 2,
            'email_clicked': 5,
            'email_bounced': -10,
            'sms_failed': -5,
            'sms_link_clicked': 8
          }
        };

    const globalRules = globalSettings.engagementRules || {};

    // 2. Fetch workspaces to load custom lead scoring settings
    console.log('[FER:MESSAGE_SCORING] Fetching workspaces configurations...');
    const workspacesSnap = await adminDb.collection('workspaces').get();
    const workspaceSettings = new Map<string, LeadScoringSettings>();
    workspacesSnap.forEach(doc => {
      const wsData = doc.data();
      if (wsData.leadScoringSettings) {
        workspaceSettings.set(doc.id, wsData.leadScoringSettings as LeadScoringSettings);
      }
    });

    // 3. Fetch all unscored message logs
    console.log('[FER:MESSAGE_SCORING] Fetching message logs metadata (excluding large bodies)...');
    const logsSnap = await adminDb
      .collection('message_logs')
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
        'direction'
      )
      .get();
      
    console.log(`[FER:MESSAGE_SCORING] Found ${logsSnap.size} total message logs in database.`);

    const unscoredLogs = logsSnap.docs.filter(doc => {
      const data = doc.data();
      return data.isScored !== true && data.direction !== 'inbound';
    });

    console.log(`[FER:MESSAGE_SCORING] Found ${unscoredLogs.length} unscored outbound logs to process.`);

    if (unscoredLogs.length === 0) {
      console.log('[FER:MESSAGE_SCORING] No unscored message logs found. Exiting.');
      return;
    }

    // Extract unique entityIds
    const uniqueEntityIds = Array.from(
      new Set(
        unscoredLogs
          .map(logDoc => logDoc.data().entityId)
          .filter(Boolean) as string[]
      )
    );

    console.log(`[FER:MESSAGE_SCORING] Pre-fetching ${uniqueEntityIds.length} unique entities in parallel...`);

    const entityCache = new Map<string, Entity | null>();
    // Fetch in parallel chunks using adminDb.getAll
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
      console.log(`[FER:MESSAGE_SCORING] Pre-fetched ${entityCache.size} / ${uniqueEntityIds.length} entities...`);
    }

    // Map of entityId -> contactId -> list of adjustments
    const adjustmentsMap = new Map<string, Map<string, ScoreAdjustment>>();
    // Helper to get workspaceId for an entity
    const entityWorkspaceMap = new Map<string, string>();
    // Accumulate log IDs that have 0 points to update at the end
    const zeroPointsLogIds: string[] = [];

    // 4. Group score adjustments by contact
    console.log('[FER:MESSAGE_SCORING] Resolving score adjustments (100% in-memory from cache)...');

    for (const logDoc of unscoredLogs) {
      const log = logDoc.data();
      const logId = logDoc.id;
      const workspaceId = log.workspaceId || (log.workspaceIds && log.workspaceIds[0]);
      const entityId = log.entityId;
      const recipient = log.recipient;
      const channel = log.channel;
      const status = log.status;
      const providerStatus = log.providerStatus;
      const openedCount = log.openedCount || 0;
      const clickedCount = log.clickedCount || 0;

      if (!workspaceId || !entityId) {
        zeroPointsLogIds.push(logId);
        continue;
      }

      entityWorkspaceMap.set(entityId, workspaceId);

      // Load settings
      const settings = workspaceSettings.get(workspaceId) || globalSettings;
      const rules = settings.engagementRules || globalRules;

      let points = 0;
      let reason = '';

      if (channel === 'email') {
        const isBounced = status === 'failed' || providerStatus === 'failed' || providerStatus === 'bounced';
        const isClicked = clickedCount > 0 || providerStatus === 'clicked';
        const isOpened = openedCount > 0 || providerStatus === 'opened';

        if (isBounced) {
          points = Number(rules['email_bounced'] ?? -10);
          reason = 'Backfill: Email bounced';
        } else if (isClicked) {
          points = Number(rules['email_clicked'] ?? 5);
          reason = 'Backfill: Email link clicked';
        } else if (isOpened) {
          points = Number(rules['email_opened'] ?? 2);
          reason = 'Backfill: Email opened';
        }
      } else if (channel === 'sms') {
        const isFailed = status === 'failed' || providerStatus === 'failed';
        const isClicked = clickedCount > 0 || providerStatus === 'clicked';

        if (isFailed) {
          points = Number(rules['sms_failed'] ?? -5);
          reason = 'Backfill: SMS delivery failed';
        } else if (isClicked) {
          points = Number(rules['sms_link_clicked'] ?? 8);
          reason = 'Backfill: SMS link clicked';
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

    console.log(`[FER:MESSAGE_SCORING] Resolved adjustments for ${adjustmentsMap.size} entities.`);
    console.log(`[FER:MESSAGE_SCORING] Total 0-point logs to update: ${zeroPointsLogIds.length}`);

    // 5. Restore / Save new scores in parallel transactional batches
    let updatedContactsCount = 0;
    const restoreBatchSize = 30;
    const adjustmentsArray = Array.from(adjustmentsMap.entries());
    const scoredLogIds: string[] = [];

    console.log(`[FER:MESSAGE_SCORING] Restoring contact scores in parallel batches of ${restoreBatchSize}...`);

    for (let i = 0; i < adjustmentsArray.length; i += restoreBatchSize) {
      const chunk = adjustmentsArray.slice(i, i + restoreBatchSize);
      
      await Promise.all(chunk.map(async ([entityId, contactMap]) => {
        const workspaceId = entityWorkspaceMap.get(entityId)!;
        const entityRef = adminDb.collection('entities').doc(entityId);
        const weRef = adminDb.collection('workspace_entities').doc(`${workspaceId}_${entityId}`);

        try {
          await adminDb.runTransaction(async (transaction) => {
            const entitySnap = await transaction.get(entityRef);
            if (!entitySnap.exists) return;

            const weSnap = await transaction.get(weRef);
            if (!weSnap.exists) return;

            const entityData = entitySnap.data() as Entity;
            const contacts = (entityData.entityContacts || []).map(c => ({ ...c }));

            let totalAdjustment = 0;

            for (const [contactId, adjustment] of contactMap.entries()) {
              const contact = contacts.find(c => c.id === contactId);
              if (contact) {
                const oldScore = contact.score || 0;
                const newScore = Math.max(0, oldScore + adjustment.points);
                contact.score = newScore;
                totalAdjustment += (newScore - oldScore);

                // Record leadScoreHistory ledger entry
                const historyRef = adminDb.collection('leadScoreHistory').doc();
                transaction.set(historyRef, {
                  contactId,
                  entityId,
                  workspaceId,
                  oldScore,
                  newScore,
                  change: newScore - oldScore,
                  reason: adjustment.reason,
                  source: 'system',
                  actorId: 'fer-message-backfill',
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
          console.error(`[FER:MESSAGE_SCORING] Failed to restore scores for entity ${entityId}:`, err);
        }
      }));

      console.log(`[FER:MESSAGE_SCORING] Restore progress: ${Math.min(i + restoreBatchSize, adjustmentsArray.length)} / ${adjustmentsArray.length} entities updated...`);
    }

    // 6. Update zero-point logs and scored logs in batch chunks of 500
    const allLogIdsToMark = [...zeroPointsLogIds, ...scoredLogIds];
    console.log(`[FER:MESSAGE_SCORING] Committing ${allLogIdsToMark.length} log status completions in batches...`);
    const writeBatchSize = 500;
    for (let i = 0; i < allLogIdsToMark.length; i += writeBatchSize) {
      const chunk = allLogIdsToMark.slice(i, i + writeBatchSize);
      const batch = adminDb.batch();
      chunk.forEach(id => {
        batch.update(adminDb.collection('message_logs').doc(id), { isScored: true });
      });
      await batch.commit();
      console.log(`[FER:MESSAGE_SCORING] Marked ${Math.min(i + writeBatchSize, allLogIdsToMark.length)} / ${allLogIdsToMark.length} logs as scored...`);
    }

    console.log(`[FER:MESSAGE_SCORING] Backfill complete. Updated ${updatedContactsCount} contact scores.`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown backfill error';
    console.error('[FER:MESSAGE_SCORING] Migration failed:', msg);
    process.exit(1);
  }
}

runMessageScoringMigration().catch(err => {
  console.error('[FER:MESSAGE_SCORING] Unhandled fatal error:', err);
  process.exit(1);
});
