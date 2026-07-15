import { adminDb } from '../src/lib/firebase-admin';
import { executeAutomation } from '../src/lib/automations/executor';
import type { Automation } from '../src/lib/types';

async function backfill() {
  const tagId = 'rnvuZGtjuO70YGlUqEup';
  const automationId = 'MCs1nHdHK7AgcffzX6w0';
  const workspaceId = 'prospect';

  console.log('>>> [BACKFILL] Starting tag leakage repair...');

  // 1. Fetch the target tag to confirm details
  const tagSnap = await adminDb.collection('tags').doc(tagId).get();
  if (!tagSnap.exists) {
    throw new Error(`Tag with ID ${tagId} not found.`);
  }
  const tagData = tagSnap.data()!;
  console.log(`>>> [BACKFILL] Target Tag found: "${tagData.name}"`);

  // 2. Fetch the target automation blueprint
  const autoSnap = await adminDb.collection('automations').doc(automationId).get();
  if (!autoSnap.exists) {
    throw new Error(`Automation with ID ${automationId} not found.`);
  }
  const automation = { id: autoSnap.id, ...autoSnap.data() } as Automation;
  console.log(`>>> [BACKFILL] Target Automation found: "${automation.name}"`);

  // 3. Query all contacts containing this tag in the prospect workspace
  console.log('>>> [BACKFILL] Querying workspace_entities...');
  const weSnap = await adminDb.collection('workspace_entities')
    .where('workspaceId', '==', workspaceId)
    .where('workspaceTags', 'array-contains', tagId)
    .get();

  console.log(`>>> [BACKFILL] Found ${weSnap.size} tagged contacts in workspace "${workspaceId}".`);

  // 4. Query existing runs for this automation
  console.log('>>> [BACKFILL] Querying existing automation runs...');
  const runsSnap = await adminDb.collection('automation_runs')
    .where('automationId', '==', automationId)
    .get();

  console.log(`>>> [BACKFILL] Found ${runsSnap.size} existing automation runs.`);

  const enrolledEntityIds = new Set(runsSnap.docs.map(doc => doc.data().entityId));

  // 5. Determine which contacts are missing runs
  const missingTargets: Array<{ entityId: string; entityType: string; displayName?: string; organizationId: string }> = [];

  weSnap.docs.forEach((doc) => {
    const data = doc.data();
    const entityId = data.entityId || doc.id;
    if (!enrolledEntityIds.has(entityId)) {
      missingTargets.push({
        entityId,
        entityType: data.entityType || 'contact',
        displayName: data.displayName || data.name,
        organizationId: data.organizationId || 'default',
      });
    }
  });

  console.log(`>>> [BACKFILL] Found ${missingTargets.length} leaked/missing contacts to enroll.`);

  if (missingTargets.length === 0) {
    console.log('>>> [BACKFILL] Complete! No missing contacts detected.');
    return;
  }

  // 6. Enroll missing contacts in concurrent chunks of 50 to avoid database overload
  const chunkSize = 50;
  let enrolledCount = 0;

  for (let i = 0; i < missingTargets.length; i += chunkSize) {
    const chunk = missingTargets.slice(i, i + chunkSize);
    console.log(`>>> [BACKFILL] Processing chunk ${i / chunkSize + 1} of ${Math.ceil(missingTargets.length / chunkSize)} (${chunk.length} contacts)...`);

    await Promise.all(
      chunk.map(async (target) => {
        const enrichedPayload = {
          entityId: target.entityId,
          entityType: target.entityType,
          workspaceId,
          organizationId: target.organizationId,
          tagId,
          tagName: tagData.name,
          _firingTrigger: 'TAG_ADDED',
        };

        try {
          await executeAutomation(automation, enrichedPayload);
        } catch (err) {
          console.error(`>>> [BACKFILL] Failed to enroll contact ${target.entityId}:`, err);
        }
      })
    );

    enrolledCount += chunk.length;
    console.log(`>>> [BACKFILL] Progress: ${enrolledCount}/${missingTargets.length} enrolled.`);
  }

  console.log('>>> [BACKFILL] Leakage repair backfill execution completed successfully!');
}

backfill().catch(console.error);
