'use server';

import { adminDb } from './firebase-admin';

/**
 * Update user AI preferences for persistence across sessions
 */
export async function updateUserAiPreferencesAction(
  userId: string,
  preferences: {
    preferredAiModel: string;
    preferredAiProvider: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId) return { success: false, error: 'User ID is required' };

    await adminDb.collection('users').doc(userId).update({
      ...preferences,
      updatedAt: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error updating user AI preferences:', error);
    return { success: false, error: error.message || 'Failed to update preferences' };
  }
}
