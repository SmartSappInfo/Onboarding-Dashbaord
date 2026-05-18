'use server';

import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logBackofficeAction } from './audit-logger';
import type { AuditActor, PlatformJob } from './backoffice-types';
import type { TemplateCategory, RecipientType } from '../types';
import { MESSAGING_TRIGGERS } from '../messaging-triggers';

// ─────────────────────────────────────────────────────────────────────────────
// FER Protocol: Fetch, Enrich, Restore — Messaging Templates Migration
//
// Purpose:
//   Aligns all existing `message_templates` documents to the canonical
//   MESSAGING_TRIGGERS registry using Trio Filters (channel, category,
//   recipientType) plus name-based heuristics. Seeds any missing global
//   default blueprints from the canonical TEMPLATES definition.
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 450; // Stay well under the Firestore 500-op limit
const BACKUP_COLLECTION = 'backup_phase3_message_templates';

// ── Trio-Filter Matching Engine ─────────────────────────────────────────────

/**
 * Heuristic rules: each rule matches a combination of (category, recipientType,
 * channel?) and a set of name keywords to a canonical trigger ID.
 *
 * Evaluation order matters: more specific rules must come first.
 */
interface MatchRule {
  triggerId: string;
  category: TemplateCategory;
  recipientType?: RecipientType;
  /** At least one keyword must appear in the lowercase template name / subject */
  nameKeywords: string[];
  /** If set, the template's channel must be in this list */
  channels?: string[];
}

const MATCH_RULES: MatchRule[] = [
  // ── Meetings: External Alerts ───────────────────────────────────────────
  { triggerId: 'meeting_registration_ack',            category: 'meetings', recipientType: 'external_alert', nameKeywords: ['registration', 'acknowledgement', 'ack', 'confirmed'] },
  { triggerId: 'meeting_reminder_2days',              category: 'meetings', recipientType: 'external_alert', nameKeywords: ['2 day', '2day', '2days', '2-day'] },
  { triggerId: 'meeting_reminder_1day',               category: 'meetings', recipientType: 'external_alert', nameKeywords: ['1 day', '1day', '1days', '1-day', 'tomorrow'] },
  { triggerId: 'meeting_reminder_1hour',              category: 'meetings', recipientType: 'external_alert', nameKeywords: ['1 hour', '1hour', '1-hour'] },
  { triggerId: 'meeting_reminder_15min',              category: 'meetings', recipientType: 'external_alert', nameKeywords: ['15 min', '15min', '15-min'] },
  { triggerId: 'meeting_time_up',                     category: 'meetings', recipientType: 'external_alert', nameKeywords: ['starting now', 'time up', 'time_up'] },
  { triggerId: 'meeting_post_event_thankyou',         category: 'meetings', recipientType: 'external_alert', nameKeywords: ['thank you', 'thankyou', 'thanks'] },
  { triggerId: 'meeting_post_event_absentee',         category: 'meetings', recipientType: 'external_alert', nameKeywords: ['absentee', 'missed', 'no-show', 'no show'] },

  // ── Meetings: Internal Alerts ───────────────────────────────────────────
  { triggerId: 'meeting_facilitator_new_registration', category: 'meetings', recipientType: 'internal_alert', nameKeywords: ['new registration', 'new_registration', 'registration alert'] },
  { triggerId: 'meeting_facilitator_pre_event',        category: 'meetings', recipientType: 'internal_alert', nameKeywords: ['pre-event', 'pre_event', 'briefing', 'pre event'] },
  { triggerId: 'meeting_facilitator_post_event',       category: 'meetings', recipientType: 'internal_alert', nameKeywords: ['post-event', 'post_event', 'debrief', 'post event', 'complete'] },

  // ── Forms ───────────────────────────────────────────────────────────────
  { triggerId: 'form_invitation',          category: 'forms', nameKeywords: ['invitation', 'invite'] },
  { triggerId: 'submission_confirmation',  category: 'forms', nameKeywords: ['confirmation', 'submitted', 'received', 'submission confirmation'] },
  { triggerId: 'submission_reminder',      category: 'forms', nameKeywords: ['reminder', 'due soon', 'overdue'] },

  // ── Surveys ─────────────────────────────────────────────────────────────
  { triggerId: 'survey_invitation',  category: 'surveys', nameKeywords: ['invitation', 'invite'] },
  { triggerId: 'survey_completion',  category: 'surveys', nameKeywords: ['completion', 'completed', 'finished', 'thank'] },
  { triggerId: 'survey_reminder',    category: 'surveys', nameKeywords: ['reminder', 'waiting'] },

  // ── Agreements ──────────────────────────────────────────────────────────
  { triggerId: 'contract_sent',     category: 'agreements', nameKeywords: ['sent', 'ready for'] },
  { triggerId: 'contract_signed',   category: 'agreements', nameKeywords: ['signed', 'successfully'] },
  { triggerId: 'contract_pending',  category: 'agreements', nameKeywords: ['pending', 'awaiting'] },
  { triggerId: 'contract_reminder', category: 'agreements', nameKeywords: ['reminder', 'expires', 'deadline'] },

  // ── General / Entities ──────────────────────────────────────────────────
  { triggerId: 'welcome_message',         category: 'general', nameKeywords: ['welcome'] },
  { triggerId: 'stage_change',            category: 'general', nameKeywords: ['stage change', 'stage_change', 'moved to'] },
  { triggerId: 'assignment_notification', category: 'general', nameKeywords: ['assignment', 'assigned to'] },
  { triggerId: 'status_update',           category: 'general', nameKeywords: ['status update', 'status_update', 'status changed'] },

  // ── Tasks ───────────────────────────────────────────────────────────────
  { triggerId: 'task_assigned',       category: 'tasks', nameKeywords: ['assigned', 'new task'] },
  { triggerId: 'task_reminder_1day',  category: 'tasks', nameKeywords: ['reminder', '1 day', 'due tomorrow'] },
  { triggerId: 'task_overdue',        category: 'tasks', nameKeywords: ['overdue', 'past due'] },
  { triggerId: 'task_completed',      category: 'tasks', nameKeywords: ['completed', 'done', 'finished'] },

  // ── Automations ─────────────────────────────────────────────────────────
  { triggerId: 'automation_failed',    category: 'automations', nameKeywords: ['failed', 'error', 'alert'] },
  { triggerId: 'automation_completed', category: 'automations', nameKeywords: ['completed', 'success', 'finished'] },

  // ── QR Codes ────────────────────────────────────────────────────────────
  { triggerId: 'qr_scan_alert', category: 'qr_codes', nameKeywords: ['scan', 'scanned', 'alert'] },
];

/**
 * Attempts to resolve a legacy template document to a canonical trigger ID
 * using the Trio Filters (category + recipientType + channel) and
 * name-keyword heuristics.
 *
 * Returns the matched trigger ID, or null if no match was found.
 */
function resolveTriggerIdFromDocument(doc: FirebaseFirestore.DocumentData): string | null {
  const category = (doc.category || '').toLowerCase() as TemplateCategory;
  const recipientType = (doc.recipientType || '').toLowerCase() as RecipientType;
  const channel = (doc.channel || '').toLowerCase();
  const searchText = [
    doc.name || '',
    doc.subject || '',
    doc.templateType || '',
  ].join(' ').toLowerCase();

  // 1. Direct match: templateType already equals a trigger ID
  const directMatch = MESSAGING_TRIGGERS.find(t => t.id === doc.templateType);
  if (directMatch) return directMatch.id;

  // 2. Heuristic match via rules
  for (const rule of MATCH_RULES) {
    if (rule.category !== category) continue;
    if (rule.recipientType && rule.recipientType !== recipientType) continue;
    if (rule.channels && !rule.channels.includes(channel)) continue;

    const keywordHit = rule.nameKeywords.some(kw => searchText.includes(kw));
    if (keywordHit) return rule.triggerId;
  }

  return null;
}

// ── Default Template Copy Registry ──────────────────────────────────────────

/**
 * Lazily imports the canonical default template definitions from
 * seed-global-templates-action.ts so we can seed missing global blueprints.
 */
async function getCanonicalTemplates() {
  const { TEMPLATES } = await import('@/lib/messaging-templates-registry');
  return TEMPLATES;
}

// ── Main FER Processor ──────────────────────────────────────────────────────

export async function processMessagingTemplatesFer(
  jobId: string,
  actor: AuditActor
): Promise<{ success: boolean; error?: string }> {
  const jobRef = adminDb.collection('platform_jobs').doc(jobId);

  try {
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) throw new Error('Job document missing.');

    const jobData = jobSnap.data() as PlatformJob;
    const isDryRun = jobData.isDryRun;

    // Mark running
    await jobRef.update({
      status: 'running',
      startedAt: new Date().toISOString(),
      'logs': FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `FER Protocol started. Dry Run: ${isDryRun}. Actor: ${actor.name}`
      })
    });

    // ── PHASE 1: Fetch & Backup ─────────────────────────────────────────
    const allDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let hasMore = true;

    while (hasMore) {
      let q = adminDb
        .collection('message_templates')
        .orderBy('__name__')
        .limit(BATCH_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) { hasMore = false; break; }

      lastDoc = snap.docs[snap.docs.length - 1];
      hasMore = snap.docs.length === BATCH_SIZE;
      allDocs.push(...snap.docs);
    }

    const totalDocuments = allDocs.length;

    await jobRef.update({
      'progress.total': totalDocuments,
      'logs': FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Fetched ${totalDocuments} template documents from Firestore.`
      })
    });

    // Backup (batched)
    if (!isDryRun) {
      const backupBatches: FirebaseFirestore.WriteBatch[] = [];
      let currentBatch = adminDb.batch();
      let opCount = 0;

      for (const docSnap of allDocs) {
        const backupRef = adminDb.collection(BACKUP_COLLECTION).doc(docSnap.id);
        currentBatch.set(backupRef, {
          ...docSnap.data(),
          backedUpAt: new Date().toISOString()
        });
        opCount++;
        if (opCount >= BATCH_SIZE) {
          backupBatches.push(currentBatch);
          currentBatch = adminDb.batch();
          opCount = 0;
        }
      }
      if (opCount > 0) backupBatches.push(currentBatch);

      for (const batch of backupBatches) {
        await batch.commit();
      }

      await jobRef.update({
        'logs': FieldValue.arrayUnion({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Backed up ${totalDocuments} documents to ${BACKUP_COLLECTION}.`
        })
      });
    } else {
      await jobRef.update({
        'logs': FieldValue.arrayUnion({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `[DRY RUN] Skipped backup. Would back up ${totalDocuments} documents.`
        })
      });
    }

    // ── PHASE 2: Enrich & Match ─────────────────────────────────────────
    let processed = 0;
    let enriched = 0;
    let skipped = 0;
    let errors = 0;

    const enrichBatches: FirebaseFirestore.WriteBatch[] = [];
    let enrichBatch = adminDb.batch();
    let enrichOpCount = 0;

    for (const docSnap of allDocs) {
      processed++;
      const data = docSnap.data();
      const existingType = data.templateType || '';

      // Check if already mapped to a valid trigger
      const alreadyMapped = MESSAGING_TRIGGERS.some(t => t.id === existingType);
      if (alreadyMapped) {
        skipped++;
        continue;
      }

      // Attempt resolution
      const resolvedTriggerId = resolveTriggerIdFromDocument(data);

      if (!resolvedTriggerId) {
        // No match found — log and skip. Don't overwrite with garbage.
        await jobRef.update({
          'logs': FieldValue.arrayUnion({
            timestamp: new Date().toISOString(),
            level: 'warn',
            message: `No trigger match for "${data.name || docSnap.id}" (category=${data.category}, recipient=${data.recipientType}, type=${existingType}). Skipping.`
          })
        });
        skipped++;
        continue;
      }

      // Resolve the trigger for additional metadata
      const trigger = MESSAGING_TRIGGERS.find(t => t.id === resolvedTriggerId)!;

      const updatePayload: Record<string, unknown> = {
        templateType: resolvedTriggerId,
        updatedAt: new Date().toISOString(),
      };

      // Enrich missing fields from the trigger registry
      if (!data.recipientType && trigger.recipientType) {
        updatePayload.recipientType = trigger.recipientType;
      }
      if (!data.target && trigger.target) {
        updatePayload.target = trigger.target;
      }
      if (!data.status) {
        updatePayload.status = 'active';
      }
      if (data.version === undefined || data.version === null) {
        updatePayload.version = 1;
      }

      if (isDryRun) {
        await jobRef.update({
          'logs': FieldValue.arrayUnion({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `[DRY RUN] Would enrich "${data.name || docSnap.id}": ${existingType || '(empty)'} → ${resolvedTriggerId}`
          })
        });
        enriched++;
      } else {
        enrichBatch.update(docSnap.ref, updatePayload);
        enrichOpCount++;
        enriched++;

        if (enrichOpCount >= BATCH_SIZE) {
          enrichBatches.push(enrichBatch);
          enrichBatch = adminDb.batch();
          enrichOpCount = 0;
        }
      }
    }

    // Commit remaining enrichments
    if (!isDryRun && enrichOpCount > 0) {
      enrichBatches.push(enrichBatch);
    }

    for (const batch of enrichBatches) {
      try {
        await batch.commit();
      } catch (err: any) {
        errors++;
        await jobRef.update({
          'logs': FieldValue.arrayUnion({
            timestamp: new Date().toISOString(),
            level: 'error',
            message: `Enrichment batch commit failed: ${err.message}`
          })
        });
      }
    }

    await jobRef.update({
      'progress.processed': processed,
      'progress.errors': errors,
      'logs': FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Enrichment complete. Enriched: ${enriched}, Skipped: ${skipped}, Errors: ${errors}`
      })
    });

    // ── PHASE 3: Restore Missing Global Defaults ────────────────────────
    const canonicalTemplates = await getCanonicalTemplates();

    // Build a set of existing global template keys: (templateType + channel)
    const existingGlobalKeys = new Set<string>();
    for (const docSnap of allDocs) {
      const data = docSnap.data();
      if (data.scope === 'global' && data.templateType && data.channel) {
        existingGlobalKeys.add(`${data.templateType}__${data.channel}`);
      }
    }

    // Also check any documents we may have just enriched (they might now have
    // valid templateType values). Re-scan the enriched data conceptually:
    // Our enrichment writes haven't changed the allDocs array, so also add
    // the resolved triggers from the enrichment phase.
    // (Already covered above since we checked templateType → trigger match)

    const missingTemplates = canonicalTemplates.filter(tpl => {
      const key = `${tpl.templateType}__${tpl.channel}`;
      return !existingGlobalKeys.has(key);
    });

    let seeded = 0;

    if (missingTemplates.length > 0) {
      const timestamp = new Date().toISOString();
      const seedBatches: FirebaseFirestore.WriteBatch[] = [];
      let seedBatch = adminDb.batch();
      let seedOpCount = 0;

      for (const tpl of missingTemplates) {
        const docId = `global_${tpl.templateType}_${tpl.channel}`;
        const docRef = adminDb.collection('message_templates').doc(docId);

        const trigger = MESSAGING_TRIGGERS.find(t => t.id === tpl.templateType);

        const templateDoc: Record<string, unknown> = {
          id: docId,
          scope: 'global',
          category: tpl.category,
          channel: tpl.channel,
          target: trigger?.target || (tpl.recipientType === 'internal_alert' ? 'internal_team' : 'external_client'),
          name: tpl.name,
          contentMode: 'plain_text',
          subject: tpl.subject || '',
          body: tpl.body,
          templateType: tpl.templateType,
          recipientType: tpl.recipientType || trigger?.recipientType || 'external_alert',
          variableContext: tpl.variableContext || 'common',
          declaredVariables: tpl.declaredVariables || [],
          status: 'active',
          version: 1,
          isActive: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: 'fer_protocol',
        };

        if (tpl.reminderConfig) {
          templateDoc.reminderConfig = tpl.reminderConfig;
        }

        if (isDryRun) {
          await jobRef.update({
            'logs': FieldValue.arrayUnion({
              timestamp: new Date().toISOString(),
              level: 'info',
              message: `[DRY RUN] Would seed missing global blueprint: "${tpl.name}" (${tpl.templateType}/${tpl.channel})`
            })
          });
        } else {
          seedBatch.set(docRef, templateDoc);
          seedOpCount++;

          if (seedOpCount >= BATCH_SIZE) {
            seedBatches.push(seedBatch);
            seedBatch = adminDb.batch();
            seedOpCount = 0;
          }
        }

        seeded++;
      }

      if (!isDryRun && seedOpCount > 0) {
        seedBatches.push(seedBatch);
      }

      for (const batch of seedBatches) {
        try {
          await batch.commit();
        } catch (err: any) {
          errors++;
          await jobRef.update({
            'logs': FieldValue.arrayUnion({
              timestamp: new Date().toISOString(),
              level: 'error',
              message: `Seed batch commit failed: ${err.message}`
            })
          });
        }
      }
    }

    await jobRef.update({
      'logs': FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Restore phase complete. Seeded ${seeded} missing global blueprints.`
      })
    });

    // ── FINALIZE ────────────────────────────────────────────────────────
    const resultSummary = {
      totalDocuments,
      enriched,
      skipped,
      seeded,
      errors,
    };

    await jobRef.update({
      status: 'completed',
      completedAt: new Date().toISOString(),
      result: resultSummary,
      'logs': FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `FER Protocol ${isDryRun ? '(DRY RUN) ' : ''}complete. Total: ${totalDocuments}, Enriched: ${enriched}, Skipped: ${skipped}, Seeded: ${seeded}, Errors: ${errors}`
      })
    });

    await logBackofficeAction(actor, 'job.fer_migration', 'messaging_templates', jobId, {
      metadata: resultSummary,
    });

    return { success: true };

  } catch (error: any) {
    console.error('[FER_PROTOCOL] Critical Failure:', error);
    await jobRef.update({
      status: 'failed',
      'logs': FieldValue.arrayUnion({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: `Critical Failure: ${error.message}`
      })
    });
    return { success: false, error: error.message };
  }
}
