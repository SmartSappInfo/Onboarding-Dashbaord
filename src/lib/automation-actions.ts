'use server';

import type { Automation, MessageLog } from './types';
import type { AutomationExportEnvelope, ImportMappings } from './automations/portability';
import {
  removeAutomation,
  saveAutomation,
  seedDefaultDealAutomation,
  setAutomationStatus,
  manuallyReleaseWaitJob,
  manuallyEndAutomationRun,
  archiveAutomation,
  restoreAutomation,
  deleteAllArchivedAutomations,
  enrollContactsInAutomation,
  type EnrollContactsOptions,
} from './automations/service';
import { testAutomationFlow } from './automations/test-flow';
import type { TestAutomationFlowInput } from './automations/test-flow';

/**
 * Thin server-action boundary — business logic lives in `automations/service.ts`.
 */
export async function saveAutomationAction(
  id: string | null,
  data: Partial<Automation>,
  userId: string
) {
  return saveAutomation(id, data, userId);
}

export async function deleteAutomationAction(id: string, userId: string) {
  return removeAutomation(id, userId);
}

export async function archiveAutomationAction(id: string, userId: string) {
  return archiveAutomation(id, userId);
}

export async function restoreAutomationAction(id: string, userId: string) {
  return restoreAutomation(id, userId);
}

export async function deleteAllArchivedAutomationsAction(workspaceId: string, userId: string) {
  return deleteAllArchivedAutomations(workspaceId, userId);
}

export async function toggleAutomationStatusAction(id: string, active: boolean, userId: string) {
  return setAutomationStatus(id, active, userId);
}

export async function seedDefaultAutomationsAction(
  workspaceId: string,
  organizationId: string,
  userId: string
) {
  return seedDefaultDealAutomation(workspaceId, organizationId, userId);
}

export async function testAutomationFlowAction(
  automationId: string,
  userId: string,
  input: TestAutomationFlowInput
) {
  return testAutomationFlow(automationId, userId, input);
}

export async function testAutomationStepAction(
  automationId: string,
  nodeId: string,
  entityId: string,
  nodeDataOverride: any,
  userId: string
) {
  const { testAutomationStep } = await import('./automations/test-step');
  return testAutomationStep(automationId, nodeId, entityId, nodeDataOverride, userId);
}

export async function pulseAutomationEngineAction() {
  const { processScheduledJobsAction } = await import('./automations/processor');
  return processScheduledJobsAction();
}

export async function manuallyReleaseWaitJobAction(jobId: string, userId: string) {
  return manuallyReleaseWaitJob(jobId, userId);
}

export async function manuallyEndAutomationRunAction(runId: string, userId: string) {
  return manuallyEndAutomationRun(runId, userId);
}

// ── Run Management Actions ──────────────────────────────────────────────────────

export async function restartRunAction(runId: string, userId: string) {
  const { restartAutomationRun } = await import('./automations/run-management');
  return restartAutomationRun(runId, userId);
}

export async function retryFailedStepAction(runId: string, nodeId: string, userId: string) {
  const { retryFailedStep } = await import('./automations/run-management');
  return retryFailedStep(runId, nodeId, userId);
}

export async function forceEndRunAction(runId: string, userId: string) {
  const { forceEndRun } = await import('./automations/run-management');
  return forceEndRun(runId, userId);
}

export async function forceAdvanceRunAction(runId: string, userId: string) {
  const { forceAdvanceRun } = await import('./automations/run-management');
  return forceAdvanceRun(runId, userId);
}

export async function pauseRunAction(runId: string, userId: string) {
  const { pauseRun } = await import('./automations/run-management');
  return pauseRun(runId, userId);
}

export async function resumeRunAction(runId: string, userId: string) {
  const { resumePausedRun } = await import('./automations/run-management');
  return resumePausedRun(runId, userId);
}

// ── Message-step delivery stats ───────────────────────────────────────────────

/**
 * Returns the denormalized per-node delivery counters for a message step, or
 * `null` when the node has not sent anything yet. Drives the stats section under
 * the message step and the inspector statistics tab.
 */
export async function getMessageNodeStatsAction(automationId: string, nodeId: string) {
  const { readMessageNodeStats } = await import('./messaging/message-node-stats');
  return readMessageNodeStats(automationId, nodeId);
}

/**
 * Returns all message logs associated with a specific message node in an automation.
 * Fetches via equality constraints and sorts on the client to avoid composite index overhead.
 */
export async function getMessageNodeLogsAction(automationId: string, nodeId: string): Promise<MessageLog[]> {
  const { adminDb } = await import('./firebase-admin');
  const snap = await adminDb.collection('message_logs')
    .where('automationId', '==', automationId)
    .where('nodeId', '==', nodeId)
    .limit(1000)
    .get();

  const logs = snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as MessageLog[];

  // Sort by sentAt descending on client
  return logs.sort((a, b) => {
    const timeA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
    const timeB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
    return timeB - timeA;
  });
}


// ── Portability Export / Import Actions ──────────────────────────────────────────

export async function exportAutomationAction(automationId: string): Promise<AutomationExportEnvelope> {
  const { buildAutomationExport } = await import('./automations/portability');
  return buildAutomationExport(automationId);
}

export async function importAutomationAction(
  envelope: AutomationExportEnvelope,
  mappings: ImportMappings,
  workspaceId: string,
  userId: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { importAutomationAction: executeImport } = await import('./automations/portability');
  return executeImport(envelope, mappings, workspaceId, userId);
}

// ── Contact Hygiene & Deletion Server Actions ──────────────────────────────────

interface ContactItem {
  email?: string;
  phone?: string;
  isPrimary?: boolean;
  isSignatory?: boolean;
  emailStatus?: string;
  emailVerificationScore?: number;
  phoneStatus?: string;
  phoneVerificationScore?: number;
}

export async function cleanContactEmailAction(
  currentEmail: string,
  mode: 'correct' | 'archive' | 'delete',
  replacementValue?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { adminDb } = await import('./firebase-admin');
    const { removeSuppression } = await import('./suppression-service');

    const cleanEmail = currentEmail.toLowerCase().trim();
    const cleanRepl = replacementValue?.toLowerCase().trim();

    // Update entities in 'entities'
    const entitiesSnap = await adminDb.collection('entities').get();
    for (const doc of entitiesSnap.docs) {
      const data = doc.data();
      const entityContacts = (data.entityContacts || []) as ContactItem[];
      const hasContact = entityContacts.some(c => c.email?.toLowerCase().trim() === cleanEmail);
      if (!hasContact) continue;

      let updatedContacts: ContactItem[] = [...entityContacts];
      const workspaceId = data.workspaceId || 'default';

      if (mode === 'correct' && cleanRepl) {
        try {
          await removeSuppression(cleanEmail, workspaceId);
        } catch (err) {
          console.warn(`[CleanContact] Suppression removal failed for ${cleanEmail} in ${workspaceId}:`, err);
        }

        updatedContacts = entityContacts.map(c => {
          if (c.email?.toLowerCase().trim() === cleanEmail) {
            return {
              ...c,
              email: cleanRepl,
              emailStatus: 'valid',
              emailVerificationScore: 100,
            };
          }
          return c;
        });
      } else if (mode === 'archive') {
        updatedContacts = entityContacts.map(c => {
          if (c.email?.toLowerCase().trim() === cleanEmail) {
            return {
              ...c,
              emailStatus: 'archived',
            };
          }
          return c;
        });
      } else if (mode === 'delete') {
        updatedContacts = entityContacts.filter(c => c.email?.toLowerCase().trim() !== cleanEmail);
        const wasPrimaryDeleted = entityContacts.some(c => c.email?.toLowerCase().trim() === cleanEmail && c.isPrimary);
        const wasSignatoryDeleted = entityContacts.some(c => c.email?.toLowerCase().trim() === cleanEmail && c.isSignatory);
        if (updatedContacts.length > 0) {
          if (wasPrimaryDeleted) {
            updatedContacts[0].isPrimary = true;
          }
          if (wasSignatoryDeleted) {
            updatedContacts[0].isSignatory = true;
          }
        }
      }

      if (updatedContacts.length === 0) {
        await doc.ref.delete();
      } else {
        await doc.ref.update({ entityContacts: updatedContacts });
      }
    }

    // Sync to workspace_entities
    const wsEntitiesSnap = await adminDb.collection('workspace_entities').get();
    for (const doc of wsEntitiesSnap.docs) {
      const data = doc.data();
      const entityContacts = (data.entityContacts || []) as ContactItem[];
      const hasContact = entityContacts.some(c => c.email?.toLowerCase().trim() === cleanEmail);
      if (!hasContact) continue;

      let updatedContacts: ContactItem[] = [...entityContacts];

      if (mode === 'correct' && cleanRepl) {
        updatedContacts = entityContacts.map(c => {
          if (c.email?.toLowerCase().trim() === cleanEmail) {
            return {
              ...c,
              email: cleanRepl,
              emailStatus: 'valid',
              emailVerificationScore: 100,
            };
          }
          return c;
        });
      } else if (mode === 'archive') {
        updatedContacts = entityContacts.map(c => {
          if (c.email?.toLowerCase().trim() === cleanEmail) {
            return {
              ...c,
              emailStatus: 'archived',
            };
          }
          return c;
        });
      } else if (mode === 'delete') {
        updatedContacts = entityContacts.filter(c => c.email?.toLowerCase().trim() !== cleanEmail);
        const wasPrimaryDeleted = entityContacts.some(c => c.email?.toLowerCase().trim() === cleanEmail && c.isPrimary);
        const wasSignatoryDeleted = entityContacts.some(c => c.email?.toLowerCase().trim() === cleanEmail && c.isSignatory);
        if (updatedContacts.length > 0) {
          if (wasPrimaryDeleted) {
            updatedContacts[0].isPrimary = true;
          }
          if (wasSignatoryDeleted) {
            updatedContacts[0].isSignatory = true;
          }
        }
      }

      if (updatedContacts.length === 0) {
        await doc.ref.delete();
      } else {
        await doc.ref.update({ entityContacts: updatedContacts });
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[cleanContactEmailAction] Error:', err);
    return { success: false, error: errorMsg };
  }
}

export async function deleteContactAction(
  entityId: string,
  email: string
): Promise<{ success: boolean; deletedEntity: boolean; error?: string }> {
  try {
    const { adminDb } = await import('./firebase-admin');

    const cleanEmail = email.toLowerCase().trim();
    let deletedEntity = false;

    await adminDb.runTransaction(async (transaction) => {
      const entityRef = adminDb.collection('entities').doc(entityId);
      const entityDoc = await transaction.get(entityRef);

      if (!entityDoc.exists) {
        throw new Error(`Entity ${entityId} not found`);
      }

      const entityContacts = (entityDoc.data()?.entityContacts || []) as ContactItem[];
      const updatedContacts = entityContacts.filter(c => c.email?.toLowerCase().trim() !== cleanEmail);

      const wasPrimaryDeleted = entityContacts.some(c => c.email?.toLowerCase().trim() === cleanEmail && c.isPrimary);
      const wasSignatoryDeleted = entityContacts.some(c => c.email?.toLowerCase().trim() === cleanEmail && c.isSignatory);

      if (updatedContacts.length > 0) {
        if (wasPrimaryDeleted) {
          updatedContacts[0].isPrimary = true;
        }
        if (wasSignatoryDeleted) {
          updatedContacts[0].isSignatory = true;
        }
        transaction.update(entityRef, { entityContacts: updatedContacts });
      } else {
        transaction.delete(entityRef);
        deletedEntity = true;
      }

      // Sync workspace_entities
      const wsRef = adminDb.collection('workspace_entities').doc(entityId);
      const wsDoc = await transaction.get(wsRef);
      if (wsDoc.exists) {
        if (deletedEntity) {
          transaction.delete(wsRef);
        } else {
          transaction.update(wsRef, { entityContacts: updatedContacts });
        }
      }
    });

    return { success: true, deletedEntity };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[deleteContactAction] Error:', err);
    return { success: false, deletedEntity: false, error: errorMsg };
  }
}

export async function verifySingleContactAction(
  entityId: string,
  recipient: string,
  type: 'email' | 'phone'
): Promise<{ success: boolean; result?: { valid: boolean; score: number; status: string }; error?: string }> {
  try {
    const { adminDb } = await import('./firebase-admin');
    const cleanRecipient = recipient.toLowerCase().trim();

    let valid = false;
    let score = 0;
    let status = 'invalid';

    if (type === 'email') {
      const { EmailVerificationEngine } = await import('./email-verifier');
      const engine = new EmailVerificationEngine();
      const res = await engine.verify(cleanRecipient, { forceRefresh: true });
      valid = res.valid;
      score = res.score;
      status = res.status;
    } else {
      const { PhoneVerificationEngine } = await import('./phone-verifier');
      const engine = new PhoneVerificationEngine();
      const res = await engine.verify(cleanRecipient, undefined, { forceRefresh: true });
      valid = res.valid;
      score = res.score;
      status = res.status;
    }

    const verificationResult = { valid, score, status };

    // Update entities
    const entityRef = adminDb.collection('entities').doc(entityId);
    const entityDoc = await entityRef.get();
    if (entityDoc.exists) {
      const entityContacts = (entityDoc.data()?.entityContacts || []) as ContactItem[];
      const updatedContacts = entityContacts.map(c => {
        const contactVal = (type === 'email' ? c.email : c.phone)?.toLowerCase().trim();
        if (contactVal === cleanRecipient) {
          if (type === 'email') {
            return {
              ...c,
              emailStatus: verificationResult.valid ? 'valid' : 'invalid',
              emailVerificationScore: verificationResult.score,
            };
          } else {
            return {
              ...c,
              phoneStatus: verificationResult.valid ? 'valid' : 'invalid',
              phoneVerificationScore: verificationResult.score,
            };
          }
        }
        return c;
      });
      await entityRef.update({ entityContacts: updatedContacts });
    }

    // Sync workspace_entities
    const wsRef = adminDb.collection('workspace_entities').doc(entityId);
    const wsDoc = await wsRef.get();
    if (wsDoc.exists) {
      const entityContacts = (wsDoc.data()?.entityContacts || []) as ContactItem[];
      const updatedContacts = entityContacts.map(c => {
        const contactVal = (type === 'email' ? c.email : c.phone)?.toLowerCase().trim();
        if (contactVal === cleanRecipient) {
          if (type === 'email') {
            return {
              ...c,
              emailStatus: verificationResult.valid ? 'valid' : 'invalid',
              emailVerificationScore: verificationResult.score,
            };
          } else {
            return {
              ...c,
              phoneStatus: verificationResult.valid ? 'valid' : 'invalid',
              phoneVerificationScore: verificationResult.score,
            };
          }
        }
        return c;
      });
      await wsRef.update({ entityContacts: updatedContacts });
    }

    return { success: true, result: verificationResult };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[verifySingleContactAction] Error:', err);
    return { success: false, error: errorMsg };
  }
}

export async function bulkCleanContactsAction(
  contactsToClean: Array<{ entityId: string; email?: string; phone?: string }>,
  mode: 'archive' | 'delete'
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const { adminDb } = await import('./firebase-admin');
    const { removeSuppression } = await import('./suppression-service');

    if (!contactsToClean || contactsToClean.length === 0) {
      return { success: true, count: 0 };
    }

    // Group contacts by entityId
    const entityGroups = new Map<string, Array<{ email?: string; phone?: string }>>();
    contactsToClean.forEach(c => {
      if (!entityGroups.has(c.entityId)) {
        entityGroups.set(c.entityId, []);
      }
      entityGroups.get(c.entityId)!.push({
        email: c.email?.toLowerCase().trim(),
        phone: c.phone?.toLowerCase().trim()
      });
    });

    let count = 0;
    const suppressionsToClear: Array<{ email: string; workspaceId: string }> = [];

    // Process each entity transactionally
    for (const [entityId, targets] of entityGroups.entries()) {
      await adminDb.runTransaction(async (transaction) => {
        const entityRef = adminDb.collection('entities').doc(entityId);
        const wsRef = adminDb.collection('workspace_entities').doc(entityId);

        const entityDoc = await transaction.get(entityRef);
        const wsDoc = await transaction.get(wsRef);

        if (!entityDoc.exists) return;

        const data = entityDoc.data() || {};
        const workspaceId = data.workspaceId || 'default';
        const entityContacts = (data.entityContacts || []) as ContactItem[];

        let updatedContacts = [...entityContacts];

        for (const target of targets) {
          if (mode === 'archive') {
            updatedContacts = updatedContacts.map(c => {
              const matchesEmail = target.email && c.email?.toLowerCase().trim() === target.email;
              const matchesPhone = target.phone && c.phone?.toLowerCase().trim() === target.phone;
              if (matchesEmail || matchesPhone) {
                count++;
                return {
                  ...c,
                  emailStatus: matchesEmail ? 'archived' : c.emailStatus,
                  phoneStatus: matchesPhone ? 'failed' : c.phoneStatus,
                };
              }
              return c;
            });
          } else if (mode === 'delete') {
            const initialLen = updatedContacts.length;
            updatedContacts = updatedContacts.filter(c => {
              const matchesEmail = target.email && c.email?.toLowerCase().trim() === target.email;
              const matchesPhone = target.phone && c.phone?.toLowerCase().trim() === target.phone;
              return !(matchesEmail || matchesPhone);
            });
            const removedCount = initialLen - updatedContacts.length;
            count += removedCount;

            // Handle primary/signatory preservation
            const wasPrimaryDeleted = entityContacts.some(c => {
              const matchesEmail = target.email && c.email?.toLowerCase().trim() === target.email;
              const matchesPhone = target.phone && c.phone?.toLowerCase().trim() === target.phone;
              return (matchesEmail || matchesPhone) && c.isPrimary;
            });
            const wasSignatoryDeleted = entityContacts.some(c => {
              const matchesEmail = target.email && c.email?.toLowerCase().trim() === target.email;
              const matchesPhone = target.phone && c.phone?.toLowerCase().trim() === target.phone;
              return (matchesEmail || matchesPhone) && c.isSignatory;
            });

            if (updatedContacts.length > 0) {
              if (wasPrimaryDeleted) {
                updatedContacts[0].isPrimary = true;
              }
              if (wasSignatoryDeleted) {
                updatedContacts[0].isSignatory = true;
              }
            }
        }

        }

        if (updatedContacts.length === 0) {
          transaction.delete(entityRef);
          if (wsDoc.exists) {
            transaction.delete(wsRef);
          }
        } else {
          transaction.update(entityRef, { entityContacts: updatedContacts });
          if (wsDoc.exists) {
            transaction.update(wsRef, { entityContacts: updatedContacts });
          }
        }

        // Collect suppressions to remove after transaction commits
        if (mode === 'archive') {
          for (const target of targets) {
            if (target.email) {
              suppressionsToClear.push({ email: target.email, workspaceId });
            }
          }
        }
      });
    }

    // Call suppressions outside transaction blocks in parallel batches of 10
    const batchSize = 10;
    for (let i = 0; i < suppressionsToClear.length; i += batchSize) {
      const batch = suppressionsToClear.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (item) => {
          try {
            await removeSuppression(item.email, item.workspaceId);
          } catch (err) {
            console.warn(`[BulkClean] Suppression removal failed for ${item.email}:`, err);
          }
        })
      );
    }

    return { success: true, count };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[bulkCleanContactsAction] Error:', err);
    return { success: false, count: 0, error: errorMsg };
  }
}

export async function enrollContactsInAutomationAction(
  entityIds: string[],
  automationId: string,
  workspaceId: string,
  userId: string,
  options?: EnrollContactsOptions
) {
  return enrollContactsInAutomation(entityIds, automationId, workspaceId, userId, options);
}

export async function manuallyReleaseAllWaitJobsAction(
  automationId: string,
  nodeId: string,
  userId: string,
  workspaceId: string
) {
  const { manuallyReleaseAllWaitJobs } = await import('./automations/service');
  return manuallyReleaseAllWaitJobs(automationId, nodeId, userId, workspaceId);
}

export async function cancelAutomationRunAction(
  runId: string,
  entityId: string,
  userId: string
) {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('UserId is required and must be a string.');
    }

    const { adminDb } = await import('./firebase-admin');
    const runRef = adminDb.collection('automation_runs').doc(runId);
    const runSnap = await runRef.get();
    if (!runSnap.exists) {
      throw new Error('Automation run not found.');
    }

    const runData = runSnap.data();
    if (runData?.entityId !== entityId) {
      throw new Error('Unauthorized: Entity ID mismatch for target run.');
    }

    // Resolve workspace permissions check
    let workspaceIds = runData?.workspaceIds;
    if (!workspaceIds || workspaceIds.length === 0) {
      const autoSnap = await adminDb.collection('automations').doc(runData.automationId).get();
      workspaceIds = autoSnap.data()?.workspaceIds || (runData.workspaceId ? [runData.workspaceId] : null);
    }
    if (!workspaceIds || workspaceIds.length === 0) {
      workspaceIds = [runData?.workspaceId || 'onboarding'];
    }

    const { assertAutomationManagePermission } = await import('./automation-permissions');
    await assertAutomationManagePermission(userId, workspaceIds, 'edit');

    const { terminateAutomationRunInternal } = await import('./automations/run-management');
    await terminateAutomationRunInternal(runId, 'cancelled', true);

    return { success: true };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errMsg };
  }
}

export async function reconcilePendingSmsLogsAction(
  automationId: string,
  nodeId: string,
  userId: string,
  workspaceId: string
) {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('UserId is required and must be a string.');
    }
    const { reconcilePendingSmsLogs } = await import('./automations/reconciliation');
    return await reconcilePendingSmsLogs(automationId, nodeId, userId, workspaceId);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errMsg };
  }
}

export async function bulkRetryRunsAction(
  automationId: string,
  payload: { runIds?: string[]; retryAllFailed?: boolean },
  userId: string,
  workspaceId: string
) {
  try {
    if (!userId || typeof userId !== 'string') {
      throw new Error('UserId is required.');
    }
    if (!automationId || !workspaceId) {
      throw new Error('AutomationId and workspaceId are required.');
    }

    const { assertAutomationManagePermission } = await import('./automation-permissions');
    await assertAutomationManagePermission(userId, [workspaceId], 'edit');

    const { scheduleBulkRetryTask } = await import('./gcp-tasks-client');
    await scheduleBulkRetryTask({
      automationId,
      workspaceId,
      userId,
      runIds: payload.runIds,
      retryAll: payload.retryAllFailed,
    });

    return { success: true };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: errMsg };
  }
}
