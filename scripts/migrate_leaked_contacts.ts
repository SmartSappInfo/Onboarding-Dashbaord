import { adminDb } from '../src/lib/firebase-admin';
import { calculateExecuteAt } from '../src/lib/automations/nodes/delay';
import { scheduleDelayTask } from '../src/lib/gcp-tasks-client';
import type { AutomationJob } from '../src/lib/automations/execution-types';

async function migrateLeakedContacts() {
  console.log('[Migration] Starting leaked contacts migration...');
  
  const automationId = 'MCs1nHdHK7AgcffzX6w0';
  const oldNodeId = 'delayNode_1784137968984'; // Temporal Wait, 5 Weeks
  const targetNodeId = 'delayNode_1784137936317'; // Wait for Tuesday 09:15 AM
  
  // The correct config for target node
  const targetConfig = {
    "value": 6,
    "scheduledTime": "09:15",
    "waitType": "scheduled_day",
    "scheduledDayPreset": "tuesday",
    "unit": "Minutes"
  };

  const limit = 100;
  let lastDoc: any = null;
  let totalProcessed = 0;
  let hasMore = true;

  while (hasMore) {
    let query = adminDb.collection('automation_jobs')
      .where('automationId', '==', automationId)
      .where('targetNodeId', '==', oldNodeId)
      .where('status', '==', 'pending')
      .orderBy('__name__')
      .limit(limit);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('[Migration] No more jobs found.');
      hasMore = false;
      break;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    console.log(`[Migration] Processing batch of ${snapshot.size} jobs...`);
    const batch = adminDb.batch();
    
    for (const doc of snapshot.docs) {
      const job = doc.data() as AutomationJob;
      
      // Calculate correct new time based on timezone logic
      const now = new Date();
      const executeAt = await calculateExecuteAt(targetConfig, {
        runId: job.runId,
        automationId: job.automationId,
        workspaceId: job.workspaceId,
        entityId: job.entityId,
        entityType: job.entityType,
        payload: job.payload,
        organizationId: job.organizationId
      }, now);

      console.log(`[Migration] Job ${doc.id} -> New executeAt: ${executeAt.toISOString()}`);

      // Schedule the new GCP Task
      const newTaskId = await scheduleDelayTask({
        runId: job.runId,
        nodeId: targetNodeId,
        automationId: job.automationId,
        executeAt,
        workspaceId: job.workspaceId
      });

      // Update the document
      batch.update(doc.ref, {
        targetNodeId: targetNodeId,
        taskId: newTaskId,
        executeAt: executeAt.toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    await batch.commit();
    totalProcessed += snapshot.size;
    console.log(`[Migration] Batch committed. Total processed: ${totalProcessed}`);

    // Sleep to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`[Migration] Finished. Total jobs processed: ${totalProcessed}`);
}

migrateLeakedContacts().catch(console.error);
