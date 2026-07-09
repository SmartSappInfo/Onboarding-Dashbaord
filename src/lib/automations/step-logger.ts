export interface StepLogEntry {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: 'success' | 'failed' | 'waiting' | 'skipped';
  executedAt: string;
  durationMs?: number;
  error?: string;
  metadata?: {
    evaluation?: string;             // For condition nodes
    actionType?: string;             // For action nodes
    delayUntil?: string;             // For delay nodes
    resumedAt?: string;              // For delay resume
    output?: Record<string, unknown>;
    [key: string]: any;
  };
}

/**
 * Atomically merges a single step entry into automation_runs/{runId}.steps.
 * Enforces a 500-step cap per run, writing steps.__overflow = true if exceeded.
 * Swallow all errors to ensure logging never breaks the main execution flow.
 */
export async function logStepExecution(
  runId: string,
  entry: StepLogEntry
): Promise<void> {
  try {
    const { adminDb } = await import('../firebase-admin');
    const docRef = adminDb.collection('automation_runs').doc(runId);
    
    // Read the document to check step counts and avoid overflow
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;
    
    const data = docSnap.data();
    const steps = data?.steps || {};
    
    if (steps.__overflow) {
      return;
    }
    
    const stepKeys = Object.keys(steps).filter((k) => k !== '__overflow');
    if (stepKeys.length >= 500) {
      await docRef.update({
        'steps.__overflow': true,
      });
      return;
    }

    const existingStep = steps[entry.nodeId];
    const mergedMetadata = {
      ...(existingStep?.metadata || {}),
      ...(entry.metadata || {}),
    };

    // Build the update payload — always persist the step itself
    const updatePayload: Record<string, unknown> = {
      [`steps.${entry.nodeId}`]: {
        ...entry,
        metadata: mergedMetadata,
        executedAt: entry.executedAt || new Date().toISOString(),
      },
    };

    // Track the contact's current position for the Activity Log.
    // Write on success (completed step) and waiting (delay node) so the
    // log always reflects the last meaningful node the contact reached.
    if (entry.status === 'success' || entry.status === 'waiting') {
      updatePayload['currentNodeId'] = entry.nodeId;
      updatePayload['currentNodeLabel'] = entry.nodeLabel;
    }

    // Dot-notation update to perform atomic merge on steps map
    await docRef.update(updatePayload);
  } catch (err) {
    // Swallow error so execution is not interrupted by logging failures
    console.error(`[step-logger] Failed to log step ${entry.nodeId} for run ${runId}:`, err);
  }
}
