'use server';

/**
 * @fileoverview Server Actions for Availability Profiles in SmartSapp Meetings 2.0.
 * Handles weekly rule matrices, date override management, default schedule bootstrapping, and CRUD.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { AvailabilityProfile, AvailabilityRule } from '@/lib/meetings/types';
import { DEFAULT_WEEKLY_RULES } from '@/lib/meetings/types';

/**
 * Helper to safely extract error message without using any.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Creates or retrieves the default availability schedule for a workspace.
 */
export async function getDefaultAvailabilityProfileAction(
  workspaceId: string,
  organizationId: string = 'default'
): Promise<{ success: boolean; profile?: AvailabilityProfile; error?: string }> {
  try {
    const snap = await adminDb
      .collection('availability_profiles')
      .where('workspaceId', '==', workspaceId)
      .where('isDefault', '==', true)
      .limit(1)
      .get();

    if (!snap.empty) {
      const doc = snap.docs[0];
      return {
        success: true,
        profile: { id: doc.id, ...doc.data() } as AvailabilityProfile,
      };
    }

    // Auto-bootstrap a standard default profile if none exists
    const now = new Date().toISOString();
    const docRef = adminDb.collection('availability_profiles').doc();

    const defaultProfile: AvailabilityProfile = {
      id: docRef.id,
      workspaceId,
      organizationId,
      name: 'Working Hours',
      description: 'Standard Monday to Friday 9am - 5pm availability.',
      timezone: 'UTC',
      isDefault: true,
      weeklyRules: DEFAULT_WEEKLY_RULES,
      overrides: [],
      minimumNoticeMinutes: 120, // 2 hours
      maximumBookingHorizonDays: 30, // 30 days ahead
      defaultBufferBeforeMinutes: 0,
      defaultBufferAfterMinutes: 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(defaultProfile);

    return {
      success: true,
      profile: defaultProfile,
    };
  } catch (error) {
    console.error('[getDefaultAvailabilityProfileAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Creates a new Availability Profile.
 */
export async function createAvailabilityProfileAction(
  workspaceId: string,
  organizationId: string,
  data: Partial<AvailabilityProfile>
): Promise<{ success: boolean; profileId?: string; error?: string }> {
  try {
    const now = new Date().toISOString();
    const docRef = adminDb.collection('availability_profiles').doc();

    const newProfile: AvailabilityProfile = {
      id: docRef.id,
      workspaceId,
      organizationId,
      name: data.name?.trim() || 'Custom Schedule',
      description: data.description || '',
      timezone: data.timezone || 'UTC',
      isDefault: data.isDefault ?? false,
      weeklyRules: data.weeklyRules || DEFAULT_WEEKLY_RULES,
      overrides: data.overrides || [],
      minimumNoticeMinutes: data.minimumNoticeMinutes ?? 120,
      maximumBookingHorizonDays: data.maximumBookingHorizonDays ?? 30,
      defaultBufferBeforeMinutes: data.defaultBufferBeforeMinutes ?? 0,
      defaultBufferAfterMinutes: data.defaultBufferAfterMinutes ?? 0,
      status: data.status || 'active',
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(newProfile);
    return { success: true, profileId: docRef.id };
  } catch (error) {
    console.error('[createAvailabilityProfileAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Updates an Availability Profile (weekly rules, date overrides, buffers).
 */
export async function updateAvailabilityProfileAction(
  profileId: string,
  data: Partial<AvailabilityProfile>
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('availability_profiles').doc(profileId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Availability profile not found.' };
    }

    const updates: Partial<AvailabilityProfile> = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await docRef.update(updates);
    return { success: true };
  } catch (error) {
    console.error('[updateAvailabilityProfileAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Deletes an Availability Profile (unless it is the workspace default).
 */
export async function deleteAvailabilityProfileAction(
  profileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('availability_profiles').doc(profileId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return { success: false, error: 'Profile not found.' };
    }

    const profile = snap.data() as AvailabilityProfile;
    if (profile.isDefault) {
      return { success: false, error: 'Cannot delete the workspace default availability schedule.' };
    }

    await docRef.delete();
    return { success: true };
  } catch (error) {
    console.error('[deleteAvailabilityProfileAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}
