'use server';

/**
 * @fileoverview Server Actions for Event Types CRUD in SmartSapp Meetings 2.0.
 * Handles Event Type creation, editing, slug deduplication, duplication, and status toggles.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { EventType } from '@/lib/meetings/types';

/**
 * Helper to safely extract error message without using any.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Generates a clean URL slug from a title string.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Ensures unique public slug across the workspace.
 */
export async function getUniqueEventTypeSlug(
  workspaceId: string,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  const normalized = slugify(baseSlug) || 'meeting';
  let candidate = normalized;
  let attempt = 1;

  while (true) {
    const snap = await adminDb
      .collection('event_types')
      .where('slug', '==', candidate)
      .limit(2)
      .get();

    const conflicts = snap.docs.filter(d => !excludeId || d.id !== excludeId);
    if (conflicts.length === 0) {
      return candidate;
    }

    attempt++;
    candidate = `${normalized}-${attempt}`;
  }
}

/**
 * Creates a new Event Type document in `event_types`.
 */
export async function createEventTypeAction(
  workspaceId: string,
  organizationId: string,
  data: Partial<EventType>
): Promise<{ success: boolean; eventTypeId?: string; slug?: string; error?: string }> {
  try {
    const now = new Date().toISOString();
    const name = data.name?.trim() || 'New Meeting';
    const desiredSlug = data.slug || slugify(name);
    const uniqueSlug = await getUniqueEventTypeSlug(workspaceId, desiredSlug);

    const docRef = adminDb.collection('event_types').doc();

    const newEventType: EventType = {
      id: docRef.id,
      workspaceId,
      organizationId,
      name,
      slug: uniqueSlug,
      description: data.description || '',
      purpose: data.purpose || 'consultation',
      format: data.format || 'one_to_one',
      durationMinutes: data.durationMinutes || 30,
      bufferBeforeMinutes: data.bufferBeforeMinutes || 0,
      bufferAfterMinutes: data.bufferAfterMinutes || 0,
      minimumNoticeMinutes: data.minimumNoticeMinutes || 120,
      maximumBookingHorizonDays: data.maximumBookingHorizonDays || 30,
      slotIntervalMinutes: data.slotIntervalMinutes || data.durationMinutes || 30,
      schedulingProfileId: data.schedulingProfileId || '',
      availabilityProfileId: data.availabilityProfileId || '',
      hostUserId: data.hostUserId || '',
      color: data.color || '#3b82f6',
      locationType: data.locationType || 'google_meet',
      locationDetails: data.locationDetails || '',
      customQuestions: data.customQuestions || [],
      crmPrefillEnabled: data.crmPrefillEnabled ?? true,
      autoTags: data.autoTags || [],
      autoAutomations: data.autoAutomations || [],
      confirmationMessage: data.confirmationMessage || 'Your booking is confirmed! See you then.',
      status: data.status || 'active',
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(newEventType);

    return {
      success: true,
      eventTypeId: docRef.id,
      slug: uniqueSlug,
    };
  } catch (error) {
    console.error('[createEventTypeAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Updates an existing Event Type document.
 */
export async function updateEventTypeAction(
  eventTypeId: string,
  data: Partial<EventType>
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('event_types').doc(eventTypeId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Event type not found.' };
    }

    const current = snap.data() as EventType;
    let uniqueSlug = current.slug;

    if (data.slug && data.slug !== current.slug) {
      uniqueSlug = await getUniqueEventTypeSlug(current.workspaceId, data.slug, eventTypeId);
    } else if (data.name && data.name !== current.name && !data.slug) {
      uniqueSlug = await getUniqueEventTypeSlug(current.workspaceId, slugify(data.name), eventTypeId);
    }

    const updates: Partial<EventType> = {
      ...data,
      slug: uniqueSlug,
      updatedAt: new Date().toISOString(),
    };

    await docRef.update(updates);
    return { success: true };
  } catch (error) {
    console.error('[updateEventTypeAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Deletes an Event Type.
 */
export async function deleteEventTypeAction(
  eventTypeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await adminDb.collection('event_types').doc(eventTypeId).delete();
    return { success: true };
  } catch (error) {
    console.error('[deleteEventTypeAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Duplicates an existing Event Type with a clean title copy and unique slug.
 */
export async function duplicateEventTypeAction(
  eventTypeId: string
): Promise<{ success: boolean; newId?: string; error?: string }> {
  try {
    const snap = await adminDb.collection('event_types').doc(eventTypeId).get();
    if (!snap.exists) {
      return { success: false, error: 'Event type not found.' };
    }

    const original = snap.data() as EventType;
    const newName = `${original.name} (Copy)`;
    const newSlug = await getUniqueEventTypeSlug(original.workspaceId, `${original.slug}-copy`);

    const newDocRef = adminDb.collection('event_types').doc();
    const now = new Date().toISOString();

    const duplicate: EventType = {
      ...original,
      id: newDocRef.id,
      name: newName,
      slug: newSlug,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    await newDocRef.set(duplicate);
    return { success: true, newId: newDocRef.id };
  } catch (error) {
    console.error('[duplicateEventTypeAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function toggleEventTypeStatusAction(
  eventTypeId: string,
  newStatus: 'active' | 'draft' | 'archived'
): Promise<{ success: boolean; error?: string }> {
  try {
    await adminDb.collection('event_types').doc(eventTypeId).update({
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error('[toggleEventTypeStatusAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Lists all Event Types in a workspace.
 */
export async function getEventTypesAction(
  workspaceId: string
): Promise<{ success: boolean; eventTypes?: EventType[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('event_types')
      .where('workspaceId', '==', workspaceId)
      .get();

    const eventTypes: EventType[] = snap.docs.map(doc => ({
      ...(doc.data() as EventType),
      id: doc.id,
    }));

    return { success: true, eventTypes };
  } catch (error) {
    console.error('[getEventTypesAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
