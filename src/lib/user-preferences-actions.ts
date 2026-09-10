'use server';

import { adminDb } from './firebase-admin';
import { requireAuth } from './auth/require-auth';

/**
 * Update user AI preferences for persistence across sessions
 */
export async function updateUserAiPreferencesAction(
  preferences: {
    preferredAiModel: string;
    preferredAiProvider: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // SECURITY (audit F2): this took the target userId from the caller and spread the
    // whole `preferences` object into an update on that user document. Server Actions
    // receive unvalidated JSON, so a caller could write arbitrary fields — including
    // `isAuthorized: true` and `permissions: ['system_admin']` — onto ANY account.
    // That is privilege escalation, not a preferences bug.
    //
    // Two fixes, both required: the target is now the verified caller, and only the two
    // known preference fields are written.
    const { uid: userId } = await requireAuth();

    await adminDb.collection('users').doc(userId).update({
      preferredAiModel: preferences.preferredAiModel,
      preferredAiProvider: preferences.preferredAiProvider,
      updatedAt: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating user AI preferences:', error);
    return { success: false, error: error.message || 'Failed to update preferences' };
  }
}
