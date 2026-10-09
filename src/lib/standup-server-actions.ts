'use server';

/**
 * @fileOverview Standup & Blocker Server Actions (Phase 4B).
 *
 * Implements:
 * - Standup draft saving and final submission.
 * - Automatic blocker synchronization into first-class `blockers` collection.
 * - Blocker lifecycle mutation (acknowledgement, assignment, resolution).
 * - TOCTOU concurrency checks via `expectedUpdatedAt` (Rule 18).
 * - Idempotency key handling (Rule 19).
 * - Private manager notes redaction for peer members (Privacy & RBAC defense).
 */

import { adminDb } from './firebase-admin';
import type {
  StandupSubmission,
  StandupBlockerItem,
  StandupWorkItem,
  BlockerRecord,
  BlockerStatus,
  UserProfile,
} from './types';
import { requireWorkspace } from '@/lib/auth/require-auth';
import { getErrorMessage } from '@/lib/errors/report-error';

export interface SaveStandupDraftInput {
  date: string; // YYYY-MM-DD
  completedWork?: StandupWorkItem[];
  plannedWork?: StandupWorkItem[];
  blockers?: StandupBlockerItem[];
  helpNeeded?: string;
  privateManagerNote?: string;
  expectedUpdatedAt?: string;
}

export interface SubmitStandupInput {
  date: string; // YYYY-MM-DD
  completedWork: StandupWorkItem[];
  plannedWork: StandupWorkItem[];
  blockers: StandupBlockerItem[];
  helpNeeded?: string;
  privateManagerNote?: string;
  idempotencyKey?: string;
}

export interface MutateBlockerInput {
  status?: BlockerStatus;
  ownerId?: string | null;
  ownerName?: string | null;
  resolutionNote?: string | null;
  expectedUpdatedAt?: string;
  idempotencyKey?: string;
}

export interface StandupActionResult<T = undefined> {
  success: boolean;
  id?: string;
  data?: T;
  error?: string;
}

/**
 * Saves a standup draft for the authenticated user.
 */
export async function saveStandupDraftAction(
  workspaceId: string,
  draft: SaveStandupDraftInput
): Promise<StandupActionResult> {
  try {
    const { uid } = await requireWorkspace(workspaceId);
    const docId = `${workspaceId}_${uid}_${draft.date}`;
    const docRef = adminDb.collection('standups').doc(docId);
    const existingSnap = await docRef.get();

    const timestamp = new Date().toISOString();

    if (existingSnap.exists) {
      const existingData = existingSnap.data() as Partial<StandupSubmission>;

      // Rule 18: TOCTOU check if expectedUpdatedAt was supplied
      if (draft.expectedUpdatedAt && existingData.updatedAt && existingData.updatedAt !== draft.expectedUpdatedAt) {
        return {
          success: false,
          error: 'CONCURRENCY_CONFLICT: Record was modified by another session.',
        };
      }
    }

    // Enrich author info if available
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() as UserProfile) : null;

    const record: StandupSubmission = {
      id: docId,
      workspaceId,
      userId: uid,
      userName: userData?.name || 'Workspace Member',
      userEmail: userData?.email,
      userPhotoUrl: userData?.photoURL,
      date: draft.date,
      status: 'draft',
      completedWork: draft.completedWork ?? [],
      plannedWork: draft.plannedWork ?? [],
      blockers: draft.blockers ?? [],
      helpNeeded: draft.helpNeeded ?? '',
      privateManagerNote: draft.privateManagerNote,
      updatedAt: timestamp,
    };

    await docRef.set(record, { merge: true });

    return { success: true, id: docId };
  } catch (error: unknown) {
    console.error('[STANDUP] Failed to save standup draft:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Submits a daily standup for the authenticated user and synchronizes blockers.
 */
export async function submitStandupAction(
  workspaceId: string,
  submission: SubmitStandupInput
): Promise<StandupActionResult> {
  try {
    const { uid } = await requireWorkspace(workspaceId);

    // Rule 19: Check idempotency key if provided
    if (submission.idempotencyKey) {
      const existingQuery = await adminDb
        .collection('standups')
        .where('workspaceId', '==', workspaceId)
        .where('idempotencyKey', '==', submission.idempotencyKey)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        const existingDoc = existingQuery.docs[0];
        return { success: true, id: existingDoc.id };
      }
    }

    const docId = `${workspaceId}_${uid}_${submission.date}`;
    const docRef = adminDb.collection('standups').doc(docId);
    const timestamp = new Date().toISOString();

    // Fetch author info
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() as UserProfile) : null;

    const record: StandupSubmission = {
      id: docId,
      workspaceId,
      userId: uid,
      userName: userData?.name || 'Workspace Member',
      userEmail: userData?.email,
      userPhotoUrl: userData?.photoURL,
      date: submission.date,
      status: 'submitted',
      completedWork: submission.completedWork,
      plannedWork: submission.plannedWork,
      blockers: submission.blockers,
      helpNeeded: submission.helpNeeded,
      privateManagerNote: submission.privateManagerNote,
      submittedAt: timestamp,
      updatedAt: timestamp,
      idempotencyKey: submission.idempotencyKey,
    };

    await docRef.set(record, { merge: true });

    // Synchronize blockers to first-class blockers collection
    if (submission.blockers && submission.blockers.length > 0) {
      const batch = adminDb.batch();
      for (const item of submission.blockers) {
        const blockerId = `${docId}_blk_${item.id}`;
        const blockerRef = adminDb.collection('blockers').doc(blockerId);
        const blockerData: BlockerRecord = {
          id: blockerId,
          workspaceId,
          standupId: docId,
          summary: item.summary,
          category: item.category,
          severity: item.severity,
          status: 'open',
          affectedTaskIds: item.affectedTaskId ? [item.affectedTaskId] : [],
          raisedBy: uid,
          raisedByName: userData?.name || 'Workspace Member',
          ownerId: null,
          ownerName: null,
          resolutionNote: null,
          resolvedAt: null,
          resolvedBy: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        batch.set(blockerRef, blockerData, { merge: true });
      }
      await batch.commit();
    }

    return { success: true, id: docId };
  } catch (error: unknown) {
    console.error('[STANDUP] Failed to submit standup:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Mutates a blocker record (status update, assignment, or resolution).
 */
export async function mutateBlockerAction(
  workspaceId: string,
  blockerId: string,
  mutation: MutateBlockerInput
): Promise<StandupActionResult> {
  try {
    const { uid } = await requireWorkspace(workspaceId);
    const blockerRef = adminDb.collection('blockers').doc(blockerId);
    const snap = await blockerRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Blocker not found or access denied.' };
    }

    const current = snap.data() as BlockerRecord;
    if (current.workspaceId !== workspaceId) {
      return { success: false, error: 'Blocker not found or access denied.' };
    }

    // Rule 19: Idempotency check
    if (mutation.idempotencyKey && current.idempotencyKey === mutation.idempotencyKey) {
      return { success: true, id: blockerId };
    }

    // Rule 18: TOCTOU concurrency check
    if (mutation.expectedUpdatedAt && current.updatedAt !== mutation.expectedUpdatedAt) {
      return {
        success: false,
        error: 'CONCURRENCY_CONFLICT: Blocker was updated by another user.',
      };
    }

    const timestamp = new Date().toISOString();
    const updates: Partial<BlockerRecord> = {
      updatedAt: timestamp,
    };

    if (mutation.status !== undefined) {
      updates.status = mutation.status;
      if (mutation.status === 'resolved') {
        updates.resolvedAt = timestamp;
        updates.resolvedBy = uid;
        if (mutation.resolutionNote !== undefined) {
          updates.resolutionNote = mutation.resolutionNote;
        }
      }
    }

    if (mutation.ownerId !== undefined) {
      updates.ownerId = mutation.ownerId;
      updates.ownerName = mutation.ownerName ?? null;
    }

    if (mutation.resolutionNote !== undefined && mutation.status !== 'resolved') {
      updates.resolutionNote = mutation.resolutionNote;
    }

    if (mutation.idempotencyKey) {
      updates.idempotencyKey = mutation.idempotencyKey;
    }

    await blockerRef.update(updates);

    return { success: true, id: blockerId };
  } catch (error: unknown) {
    console.error('[BLOCKER] Failed to mutate blocker:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Retrieves daily standups for team overview with privacy protection.
 * Private manager notes are redacted unless the caller is the author or an authorized admin/manager.
 */
export async function getStandupsForDateAction(
  workspaceId: string,
  date: string
): Promise<{ success: boolean; standups?: StandupSubmission[]; error?: string }> {
  try {
    const { uid } = await requireWorkspace(workspaceId);

    // Check user authority
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() as UserProfile) : null;
    const isManagerOrAdmin = Boolean(userData?.permissions?.includes('system_admin'));

    const querySnap = await adminDb
      .collection('standups')
      .where('workspaceId', '==', workspaceId)
      .where('date', '==', date)
      .get();

    const standups: StandupSubmission[] = querySnap.docs.map((docSnap) => {
      const data = docSnap.data() as StandupSubmission;
      // Privacy defense: omit private manager notes if viewer is neither author nor manager
      if (data.userId !== uid && !isManagerOrAdmin) {
        const { privateManagerNote: _note, ...rest } = data;
        return rest as StandupSubmission;
      }
      return data;
    });

    return { success: true, standups };
  } catch (error: unknown) {
    console.error('[STANDUP] Failed to get standups for date:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Retrieves active blockers for the workspace.
 */
export async function getBlockersAction(
  workspaceId: string,
  options?: { status?: BlockerStatus; limitCount?: number }
): Promise<{ success: boolean; blockers?: BlockerRecord[]; error?: string }> {
  try {
    await requireWorkspace(workspaceId);

    let queryRef = adminDb
      .collection('blockers')
      .where('workspaceId', '==', workspaceId);

    if (options?.status) {
      queryRef = queryRef.where('status', '==', options.status);
    }

    if (options?.limitCount) {
      queryRef = queryRef.limit(options.limitCount);
    }

    const querySnap = await queryRef.get();
    const blockers = querySnap.docs.map((d) => d.data() as BlockerRecord);

    return { success: true, blockers };
  } catch (error: unknown) {
    console.error('[BLOCKER] Failed to get blockers:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Retrieves past standup submissions for the current authenticated user.
 */
export async function getMyStandupHistoryAction(
  workspaceId: string,
  limitCount = 30
): Promise<{ success: boolean; standups?: StandupSubmission[]; error?: string }> {
  try {
    const { uid } = await requireWorkspace(workspaceId);

    const querySnap = await adminDb
      .collection('standups')
      .where('workspaceId', '==', workspaceId)
      .where('userId', '==', uid)
      .limit(limitCount)
      .get();

    const standups = querySnap.docs.map((d) => d.data() as StandupSubmission);

    return { success: true, standups };
  } catch (error: unknown) {
    console.error('[STANDUP] Failed to get standup history:', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
