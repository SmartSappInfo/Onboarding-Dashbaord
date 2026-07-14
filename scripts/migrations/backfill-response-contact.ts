/**
 * @fileOverview Migration script to backfill respondent identity fields (contactEmail, respondentEntityId, channel)
 * on existing survey response documents in Firestore.
 *
 * Runs via ts-node:
 *   npx ts-node scripts/migrations/backfill-response-contact.ts --dry-run
 *   npx ts-node scripts/migrations/backfill-response-contact.ts
 */

import { adminDb } from '../../src/lib/firebase-admin';
import { decryptToken } from '../../src/lib/crypto';
import { FieldsVariablesService } from '../../src/lib/services/fields-variables-service-impl';

interface ResponseData {
  surveyId: string;
  assignedUserId?: string | null;
  contactEmail?: string | null;
  respondentEntityId?: string | null;
  channel?: string | null;
}

async function runMigration() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  console.log(`[Migration] Starting backfill-response-contact...`);
  console.log(`[Migration] Dry-Run Mode: ${isDryRun ? 'ENABLED (no writes will be made)' : 'DISABLED (LIVE WRITES)'}`);

  // Fetch all surveys to map workspaceIds (needed for parameter resolution context)
  console.log('[Migration] Fetching surveys for workspace mapping...');
  const surveySnap = await adminDb.collection('surveys').get();
  const surveyWorkspaceMap = new Map<string, string[]>();
  surveySnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.workspaceIds) {
      surveyWorkspaceMap.set(doc.id, data.workspaceIds);
    }
  });
  console.log(`[Migration] Mapped workspace IDs for ${surveyWorkspaceMap.size} surveys.`);

  // Query all responses across all surveys using collectionGroup
  console.log('[Migration] Fetching all survey responses...');
  const responsesSnap = await adminDb.collectionGroup('responses').get();
  console.log(`[Migration] Found ${responsesSnap.size} total responses in database.`);

  let processedCount = 0;
  let enrichedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const doc of responsesSnap.docs) {
    processedCount++;
    const path = doc.ref.path;
    const data = doc.data() as ResponseData;

    // Skip if already has contactEmail (idempotency check)
    if (data.contactEmail) {
      skippedCount++;
      continue;
    }

    const refParam = data.assignedUserId;
    const surveyId = data.surveyId;
    const workspaceIds = surveyWorkspaceMap.get(surveyId) || [];

    let resolvedRespondentEntityId: string | null = null;
    let resolvedRecipientContact: string | null = null;
    let resolvedChannel = 'direct';

    if (refParam && workspaceIds.length > 0) {
      const isEncrypted = refParam.split(':').length === 3;
      if (isEncrypted) {
        try {
          const decrypted = decryptToken(refParam);
          if (decrypted) {
            const [contactId, entityId] = decrypted.split(':');
            resolvedRespondentEntityId = entityId || null;
            resolvedChannel = 'email';

            // Resolve contact email from contactId
            if (entityId) {
              const weSnap = await adminDb.collection('workspace_entities')
                .where('workspaceId', 'in', workspaceIds)
                .where('entityId', '==', entityId)
                .limit(1)
                .get();
              if (!weSnap.empty) {
                const contacts = (weSnap.docs[0].data().entityContacts || []) as any[];
                const found = contacts.find(c => c.id === contactId);
                if (found) {
                  resolvedRecipientContact = found.email || null;
                }
              }
            } else {
              const contactSnap = await adminDb.collection('contacts').doc(contactId).get();
              if (contactSnap.exists) {
                resolvedRecipientContact = String(contactSnap.data()?.email || '') || null;
              }
            }
          }
        } catch (err) {
          console.error(`[Migration] Error decrypting token for response ${doc.id}:`, err);
          errorCount++;
        }
      } else {
        // Plain ref = entityId
        resolvedRespondentEntityId = refParam;
      }
    }

    // Build update payload
    const updatePayload: Record<string, any> = {
      contactEmail: resolvedRecipientContact || null,
      respondentEntityId: resolvedRespondentEntityId || null,
      channel: resolvedChannel,
    };

    enrichedCount++;
    console.log(`[Migration] Enriched response: ${path}`);
    console.log(`            assignedUserId: ${refParam}`);
    console.log(`            contactEmail: ${resolvedRecipientContact}`);
    console.log(`            respondentEntityId: ${resolvedRespondentEntityId}`);
    console.log(`            channel: ${resolvedChannel}`);

    if (!isDryRun) {
      try {
        await doc.ref.update(updatePayload);
        // Rate limit: sleep 100ms between writes to prevent rate limiting/load spikes
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`[Migration] Failed to write updates for response ${doc.id}:`, err);
        errorCount++;
      }
    }
  }

  console.log(`\n[Migration] Summary of run:`);
  console.log(`  Processed:  ${processedCount}`);
  console.log(`  Enriched:   ${enrichedCount}`);
  console.log(`  Skipped:    ${skippedCount}`);
  console.log(`  Errors:     ${errorCount}`);
  console.log(`[Migration] backfill-response-contact completed.`);
}

runMigration().catch(err => {
  console.error('[Migration] Uncaught error during run:', err);
  process.exit(1);
});
