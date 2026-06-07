import { adminDb } from '../firebase-admin';
import type { Automation, AutomationJob, AutomationTrigger } from '../types';

const AUTOMATIONS = 'automations';
const AUTOMATION_JOBS = 'automation_jobs';
const AUTOMATION_RUNS = 'automation_runs';

const GET_ALL_CHUNK = 30;

export async function getAutomationById(id: string): Promise<Automation | null> {
  const snap = await adminDb.collection(AUTOMATIONS).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Automation;
}

export async function findActiveAutomationsByTrigger(
  trigger: AutomationTrigger
): Promise<Automation[]> {
  const snap = await adminDb
    .collection(AUTOMATIONS)
    .where('triggerTypes', 'array-contains', trigger)
    .where('isActive', '==', true)
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Automation);
}

export async function persistAutomationDocument(
  id: string | null,
  payload: Record<string, unknown>,
  workspaceIds: string[]
): Promise<string> {
  if (id) {
    await adminDb.collection(AUTOMATIONS).doc(id).update(payload);
    return id;
  }

  const docRef = await adminDb.collection(AUTOMATIONS).add({
    ...payload,
    workspaceIds,
    isActive: false,
  });
  return docRef.id;
}

export async function deleteAutomation(id: string): Promise<void> {
  await adminDb.collection(AUTOMATIONS).doc(id).delete();
}

export async function setAutomationActive(id: string, isActive: boolean): Promise<void> {
  await adminDb.collection(AUTOMATIONS).doc(id).update({ isActive });
}

export async function findDuePendingJobs(limit: number): Promise<AutomationJob[]> {
  const now = new Date().toISOString();
  const snap = await adminDb
    .collection(AUTOMATION_JOBS)
    .where('status', '==', 'pending')
    .where('executeAt', '<=', now)
    .limit(limit)
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AutomationJob);
}

/**
 * Atomically claims a pending job (prevents duplicate cron workers processing the same job).
 */
export async function claimAutomationJob(jobId: string): Promise<AutomationJob | null> {
  const now = new Date().toISOString();

  return adminDb.runTransaction(async (tx) => {
    const ref = adminDb.collection(AUTOMATION_JOBS).doc(jobId);
    const snap = await tx.get(ref);
    if (!snap.exists) return null;

    const data = snap.data() as AutomationJob;
    if (data.status !== 'pending') return null;
    if (data.executeAt > now) return null;

    tx.update(ref, {
      status: 'processing',
      claimedAt: now,
    });

    return { ...data, id: snap.id };
  });
}

export async function finalizeAutomationJob(
  jobId: string,
  status: 'completed' | 'failed'
): Promise<void> {
  await adminDb.collection(AUTOMATION_JOBS).doc(jobId).update({
    status,
    finishedAt: new Date().toISOString(),
  });
}

export async function getWorkspaceOrganizationId(workspaceId: string): Promise<string> {
  const snap = await adminDb.collection('workspaces').doc(workspaceId).get();
  return snap.data()?.organizationId || 'default';
}

/** Batch-fetch document existence (chunks of 30 — Firestore getAll limit). */
export async function documentsExist(
  collectionName: string,
  ids: string[]
): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const existing = new Set<string>();

  for (let i = 0; i < unique.length; i += GET_ALL_CHUNK) {
    const chunk = unique.slice(i, i + GET_ALL_CHUNK);
    const refs = chunk.map((id) => adminDb.collection(collectionName).doc(id));
    const snaps = await adminDb.getAll(...refs);
    snaps.forEach((snap) => {
      if (snap.exists) existing.add(snap.id);
    });
  }

  return existing;
}

export { AUTOMATION_RUNS };
