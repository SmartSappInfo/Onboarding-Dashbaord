export interface StepLogEntry {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: 'success' | 'failed' | 'waiting' | 'skipped';
  executedAt: string;
  durationMs?: number;
  error?: string;
  metadata?: {
    evaluation?: 'true' | 'false';  // For condition nodes
    actionType?: string;             // For action nodes
    delayUntil?: string;             // For delay nodes
    resumedAt?: string;              // For delay resume
    output?: Record<string, unknown>;
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

    // Dot-notation update to perform atomic merge on steps map
    await docRef.update({
      [`steps.${entry.nodeId}`]: {
        ...entry,
        metadata: mergedMetadata,
        executedAt: entry.executedAt || new Date().toISOString(),
      },
    });
  } catch (err) {
    // Swallow error so execution is not interrupted by logging failures
    console.error(`[step-logger] Failed to log step ${entry.nodeId} for run ${runId}:`, err);
  }
}
