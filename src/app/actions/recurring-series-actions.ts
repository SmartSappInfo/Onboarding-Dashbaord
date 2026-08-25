'use server';

/**
 * @fileoverview Server Actions for Recurring Meeting Series management.
 * Handles repeating consultation series, horizon expansion, and cancellation.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Windowed materialization prevents runaway database writes.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { RecurringSeries, RecurrenceFrequency } from '@/lib/meetings/types/intelligence';
import { expandRecurringDates } from '@/lib/meetings/recurrence-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Creates a new Recurring Series record.
 */
export async function createRecurringSeriesAction(payload: {
  workspaceId: string;
  organizationId?: string;
  eventTypeId: string;
  frequency: RecurrenceFrequency;
  interval?: number;
  daysOfWeek?: number[];
  startDate: string;
  untilDate?: string;
  count?: number;
}): Promise<{ success: boolean; seriesId?: string; expandedDates?: string[]; error?: string }> {
  try {
    const { workspaceId, organizationId, eventTypeId, frequency, interval = 1, daysOfWeek, startDate, untilDate, count } = payload;
    const now = new Date().toISOString();

    const docRef = adminDb.collection('recurring_series').doc();

    const expandedDates = expandRecurringDates({
      frequency,
      interval,
      daysOfWeek,
      startDate,
      untilDate,
      count,
    }, 60);

    const series: RecurringSeries = {
      id: docRef.id,
      workspaceId,
      organizationId,
      eventTypeId,
      frequency,
      interval,
      daysOfWeek: daysOfWeek || [],
      startDate,
      untilDate,
      count: count || expandedDates.length,
      status: 'active',
      createdBookingsCount: expandedDates.length,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(series);

    return {
      success: true,
      seriesId: docRef.id,
      expandedDates,
    };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Retrieves a recurring series by id.
 */
export async function getRecurringSeriesAction(
  seriesId: string,
  workspaceId: string
): Promise<{ success: boolean; series?: RecurringSeries; error?: string }> {
  try {
    const doc = await adminDb.collection('recurring_series').doc(seriesId).get();
    if (!doc.exists) {
      return { success: false, error: 'Recurring series not found.' };
    }

    const series = doc.data() as RecurringSeries;
    if (series.workspaceId !== workspaceId) {
      throw new Error('Unauthorized workspace access.');
    }

    return { success: true, series };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Cancels a recurring series.
 */
export async function cancelRecurringSeriesAction(
  seriesId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('recurring_series').doc(seriesId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error('Recurring series not found.');
    }

    const series = doc.data() as RecurringSeries;
    if (series.workspaceId !== workspaceId) {
      throw new Error('Unauthorized workspace access.');
    }

    await docRef.update({
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
