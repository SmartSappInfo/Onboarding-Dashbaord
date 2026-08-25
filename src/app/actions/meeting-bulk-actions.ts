'use server';

/**
 * @fileoverview Server Actions for Bulk Meeting Operations & Recurring Series Exceptions.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Chunk size strictly capped at 100 operations per Firestore commit batch.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  BulkReschedulePayload,
  BulkCancelPayload,
  SeriesInstanceOverride,
  BulkOperationResult,
} from '@/lib/meetings/types/bulk-operations';
import {
  calculateBulkRescheduleTimes,
} from '@/lib/meetings/bulk-session-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Reschedules a batch of meetings by shifting timestamps by a minute delta.
 */
export async function bulkRescheduleMeetingsAction(
  workspaceId: string,
  payload: BulkReschedulePayload
): Promise<BulkOperationResult> {
  const { meetingIds, minuteOffsetDelta } = payload;
  const result: BulkOperationResult = {
    totalRequested: meetingIds.length,
    successCount: 0,
    failureCount: 0,
    failedMeetingIds: [],
    errors: [],
  };

  if (meetingIds.length === 0) return result;

  try {
    // Process in chunks of 100 to prevent batch limit overloads
    const chunkSize = 100;
    for (let i = 0; i < meetingIds.length; i += chunkSize) {
      const chunk = meetingIds.slice(i, i + chunkSize);
      const batch = adminDb.batch();

      const fetchPromises = chunk.map(id => adminDb.collection('meetings').doc(id).get());
      const snapshots = await Promise.all(fetchPromises);

      const toShift: Array<{ id: string; meetingTime: string; endAt?: string }> = [];

      for (const snap of snapshots) {
        if (snap.exists && snap.data()?.workspaceIds?.includes(workspaceId)) {
          toShift.push({
            id: snap.id,
            meetingTime: snap.data()?.meetingTime || '',
            endAt: snap.data()?.endAt,
          });
        } else {
          result.failureCount++;
          result.failedMeetingIds.push(snap.id);
        }
      }

      const calculated = calculateBulkRescheduleTimes(toShift, minuteOffsetDelta);

      for (const item of calculated) {
        const ref = adminDb.collection('meetings').doc(item.id);
        batch.update(ref, {
          meetingTime: item.newMeetingTime,
          ...(item.newEndAt ? { endAt: item.newEndAt } : {}),
          updatedAt: new Date().toISOString(),
        });
        result.successCount++;
      }

      await batch.commit();
    }

    return result;
  } catch (err) {
    result.errors.push(getErrorMessage(err));
    return result;
  }
}

/**
 * Cancels a batch of meetings in bulk with a recorded cancellation reason.
 */
export async function bulkCancelMeetingsAction(
  workspaceId: string,
  payload: BulkCancelPayload
): Promise<BulkOperationResult> {
  const { meetingIds, reason } = payload;
  const result: BulkOperationResult = {
    totalRequested: meetingIds.length,
    successCount: 0,
    failureCount: 0,
    failedMeetingIds: [],
    errors: [],
  };

  if (meetingIds.length === 0) return result;

  try {
    const chunkSize = 100;
    for (let i = 0; i < meetingIds.length; i += chunkSize) {
      const chunk = meetingIds.slice(i, i + chunkSize);
      const batch = adminDb.batch();

      for (const id of chunk) {
        const ref = adminDb.collection('meetings').doc(id);
        batch.update(ref, {
          status: 'cancelled',
          cancellationReason: reason,
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        result.successCount++;
      }

      await batch.commit();
    }

    return result;
  } catch (err) {
    result.errors.push(getErrorMessage(err));
    return result;
  }
}

/**
 * Saves a recurring series instance override exception.
 */
export async function overrideSeriesInstanceAction(
  workspaceId: string,
  override: SeriesInstanceOverride
): Promise<{ success: boolean; error?: string }> {
  try {
    const overrideId = `override_${override.seriesId}_${override.originalStart.replace(/[:.]/g, '-')}`;
    const docRef = adminDb.collection('series_instance_overrides').doc(overrideId);

    await docRef.set({
      id: overrideId,
      workspaceId,
      ...override,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
