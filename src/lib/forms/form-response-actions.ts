'use server';

/**
 * SmartSapp Forms 2.0: Response Center & Submissions Inbox Server Actions
 * 
 * Provides qualification lifecycle status updates, chunked bulk operations,
 * internal staff notes, saved view presets, and sanitized CSV exports.
 */

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/lib/collection-constants';
import type { FormSubmission } from '@/lib/types';
import type {
  SubmissionStatus,
  BulkSubmissionActionPayload,
  SubmissionNote,
  FormSavedView,
} from './form-response-types';
import { sanitizeCsvCell } from './form-utils';

/**
 * Updates the qualification status of an individual submission.
 */
export async function updateSubmissionStatusAction(
  submissionId: string,
  status: SubmissionStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!submissionId || !status) {
      return { success: false, error: 'submissionId and status are required' };
    }

    const subRef = adminDb.collection(COLLECTIONS.FORM_SUBMISSIONS).doc(submissionId);
    const subSnap = await subRef.get();
    if (!subSnap.exists) {
      return { success: false, error: 'Submission not found' };
    }

    const subData = subSnap.data() as FormSubmission;

    await subRef.update({
      status,
      updatedAt: new Date().toISOString(),
    });

    // Sync status update to linked Deal if present
    if (subData.dealId) {
      const dealRef = adminDb.collection(COLLECTIONS.DEALS).doc(subData.dealId);
      const dealSnap = await dealRef.get();
      if (dealSnap.exists) {
        await dealRef.update({
          formStatus: status,
          updatedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    }

    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[FORMS:RESPONSE] Error updating submission status:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Performs chunked atomic bulk operations (up to 400 operations per Firestore batch).
 */
export async function bulkUpdateSubmissionsAction(
  payload: BulkSubmissionActionPayload
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  try {
    const { submissionIds, action, status, assignedTo, tagIds } = payload;
    if (!submissionIds || submissionIds.length === 0) {
      return { success: true, updatedCount: 0 };
    }

    const CHUNK_SIZE = 400;
    let totalProcessed = 0;

    for (let i = 0; i < submissionIds.length; i += CHUNK_SIZE) {
      const chunk = submissionIds.slice(i, i + CHUNK_SIZE);
      const batch = adminDb.batch();

      for (const subId of chunk) {
        const ref = adminDb.collection(COLLECTIONS.FORM_SUBMISSIONS).doc(subId);

        if (action === 'delete') {
          batch.delete(ref);
        } else if (action === 'status' && status) {
          batch.update(ref, {
            status,
            updatedAt: new Date().toISOString(),
          });
        } else if (action === 'assign' && assignedTo !== undefined) {
          batch.update(ref, {
            assignedTo,
            updatedAt: new Date().toISOString(),
          });
        } else if (action === 'tag' && tagIds && tagIds.length > 0) {
          batch.update(ref, {
            appliedTags: FieldValue.arrayUnion(...tagIds),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      await batch.commit();
      totalProcessed += chunk.length;
    }

    return { success: true, updatedCount: totalProcessed };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[FORMS:RESPONSE] Bulk update error:', msg);
    return { success: false, updatedCount: 0, error: msg };
  }
}

/**
 * Appends an internal staff collaboration note to a submission.
 */
export async function addSubmissionNoteAction(
  submissionId: string,
  workspaceId: string,
  authorId: string,
  authorName: string,
  text: string
): Promise<{ success: boolean; note?: SubmissionNote; error?: string }> {
  try {
    if (!submissionId || !text.trim()) {
      return { success: false, error: 'Note text cannot be empty' };
    }

    const notesCol = adminDb.collection(COLLECTIONS.FORM_SUBMISSIONS).doc(submissionId).collection('notes');
    const now = new Date().toISOString();

    const noteDoc = await notesCol.add({
      submissionId,
      workspaceId,
      authorId,
      authorName,
      text: text.trim(),
      createdAt: now,
    });

    // Increment notes counter on submission
    await adminDb.collection(COLLECTIONS.FORM_SUBMISSIONS).doc(submissionId).update({
      notesCount: FieldValue.increment(1),
      updatedAt: now,
    });

    return {
      success: true,
      note: {
        id: noteDoc.id,
        submissionId,
        workspaceId,
        authorId,
        authorName,
        text: text.trim(),
        createdAt: now,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Fetches the internal staff notes thread for a submission.
 */
export async function getSubmissionNotesAction(
  submissionId: string
): Promise<{ success: boolean; notes: SubmissionNote[]; error?: string }> {
  try {
    if (!submissionId) return { success: true, notes: [] };

    const snap = await adminDb.collection(COLLECTIONS.FORM_SUBMISSIONS)
      .doc(submissionId)
      .collection('notes')
      .orderBy('createdAt', 'desc')
      .get();

    const notes: SubmissionNote[] = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as SubmissionNote));

    return { success: true, notes };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, notes: [], error: msg };
  }
}

/**
 * Saves or updates a custom saved view preset for a form.
 */
export async function saveFormSavedViewAction(
  view: Omit<FormSavedView, 'id' | 'createdAt'> & { id?: string }
): Promise<{ success: boolean; viewId?: string; error?: string }> {
  try {
    const now = new Date().toISOString();
    if (view.id) {
      await adminDb.collection('form_saved_views').doc(view.id).set({
        ...view,
        updatedAt: now,
      }, { merge: true });
      return { success: true, viewId: view.id };
    } else {
      const docRef = await adminDb.collection('form_saved_views').add({
        ...view,
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, viewId: docRef.id };
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Fetches saved views for a form.
 */
export async function getFormSavedViewsAction(
  formId: string
): Promise<FormSavedView[]> {
  try {
    if (!formId) return [];
    const snap = await adminDb.collection('form_saved_views')
      .where('formId', '==', formId)
      .get();

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as FormSavedView));
  } catch {
    return [];
  }
}

/**
 * Deletes a saved view.
 */
export async function deleteFormSavedViewAction(
  viewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!viewId) return { success: false, error: 'viewId is required' };
    await adminDb.collection('form_saved_views').doc(viewId).delete();
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}
