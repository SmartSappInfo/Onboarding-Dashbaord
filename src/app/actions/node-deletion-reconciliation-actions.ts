'use server';

/**
 * @fileoverview Server Actions wrapper for Node Deletion Reconciliation engine.
 *
 * ARCHITECTURAL GUIDANCE:
 * Client components (e.g. AutomationBuilder.tsx) must invoke server-side Firestore Admin functions
 * via 'use server' Server Actions to prevent bundling Node.js server modules (firebase-admin, gcp-tasks)
 * into browser client bundles.
 */

import {
  getParkedJobsCount,
  reconcileParkedJobsOnNodeDeletion,
  type ReconcileNodeDeletionOptions,
  type ReconcileNodeDeletionResult,
} from '@/lib/automations/node-deletion-reconciliation';

export async function getParkedJobsCountAction(
  workspaceId: string,
  automationId: string,
  nodeId: string
): Promise<number> {
  return getParkedJobsCount(workspaceId, automationId, nodeId);
}

export async function reconcileParkedJobsOnNodeDeletionAction(
  options: ReconcileNodeDeletionOptions
): Promise<ReconcileNodeDeletionResult> {
  return reconcileParkedJobsOnNodeDeletion(options);
}
