'use server';

/**
 * @fileoverview Server Actions for Physical Rooms & Equipment Resources.
 * Manages resource inventory CRUD and interval reservation collision detection.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Queries are scoped strictly to active workspaceId.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  MeetingRoomResource,
  ResourceReservation,
  MeetingResourceType,
} from '@/lib/meetings/types/resources';
import { detectResourceCollision } from '@/lib/meetings/resource-collision-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Fetches all physical rooms and equipment resources in a workspace.
 */
export async function getWorkspaceResourcesAction(
  workspaceId: string
): Promise<{ success: boolean; resources?: MeetingRoomResource[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('meeting_resources')
      .where('workspaceId', '==', workspaceId)
      .get();

    const resources: MeetingRoomResource[] = snap.docs.map(doc => ({
      ...(doc.data() as MeetingRoomResource),
      id: doc.id,
    }));

    resources.sort((a, b) => a.name.localeCompare(b.name));

    return { success: true, resources };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Creates or updates a physical room or hardware resource.
 */
export async function saveWorkspaceResourceAction(payload: {
  id?: string;
  workspaceId: string;
  name: string;
  type: MeetingResourceType;
  capacity?: number;
  locationAddress?: string;
  floorBuilding?: string;
  amenities?: string[];
  isActive?: boolean;
}): Promise<{ success: boolean; resourceId?: string; error?: string }> {
  try {
    const {
      id,
      workspaceId,
      name,
      type,
      capacity,
      locationAddress,
      floorBuilding,
      amenities = [],
      isActive = true,
    } = payload;

    if (!name.trim()) throw new Error('Resource name is required.');

    const isUpdate = Boolean(id);
    const docRef = isUpdate
      ? adminDb.collection('meeting_resources').doc(id!)
      : adminDb.collection('meeting_resources').doc();

    const now = new Date().toISOString();
    const resourceData: MeetingRoomResource = {
      id: docRef.id,
      workspaceId,
      name: name.trim(),
      type,
      capacity,
      locationAddress: locationAddress?.trim(),
      floorBuilding: floorBuilding?.trim(),
      amenities,
      isActive,
      createdAt: isUpdate ? (await docRef.get()).data()?.createdAt || now : now,
      updatedAt: now,
    };

    await docRef.set(resourceData);

    return { success: true, resourceId: docRef.id };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Deletes a physical resource.
 */
export async function deleteWorkspaceResourceAction(
  resourceId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('meeting_resources').doc(resourceId);
    const snap = await docRef.get();

    if (!snap.exists) throw new Error('Resource not found.');
    if (snap.data()?.workspaceId !== workspaceId) throw new Error('Unauthorized workspace.');

    await docRef.delete();
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Reserves a physical resource for a meeting with interval collision verification.
 */
export async function reservePhysicalResourceAction(payload: {
  workspaceId: string;
  resourceId: string;
  meetingId: string;
  startAt: string;
  endAt: string;
  reservedByUserId: string;
  reservedByName?: string;
}): Promise<{ success: boolean; reservationId?: string; error?: string }> {
  try {
    const {
      workspaceId,
      resourceId,
      meetingId,
      startAt,
      endAt,
      reservedByUserId,
      reservedByName,
    } = payload;

    // Fetch existing reservations for this resource
    const resSnap = await adminDb
      .collection('resource_reservations')
      .where('workspaceId', '==', workspaceId)
      .where('resourceId', '==', resourceId)
      .where('status', '==', 'confirmed')
      .get();

    const existing: ResourceReservation[] = resSnap.docs.map(doc => ({
      ...(doc.data() as ResourceReservation),
      id: doc.id,
    }));

    const collision = detectResourceCollision(
      new Date(startAt),
      new Date(endAt),
      existing
    );

    if (collision) {
      throw new Error(`Physical resource is already reserved during this time (${new Date(collision.startAt).toLocaleTimeString()} - ${new Date(collision.endAt).toLocaleTimeString()}).`);
    }

    const docRef = adminDb.collection('resource_reservations').doc();
    const reservationData: ResourceReservation = {
      id: docRef.id,
      resourceId,
      meetingId,
      workspaceId,
      startAt,
      endAt,
      status: 'confirmed',
      reservedByUserId,
      reservedByName,
    };

    await docRef.set(reservationData);

    return { success: true, reservationId: docRef.id };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
