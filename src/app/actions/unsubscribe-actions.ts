'use server';

import { processUnsubscribe } from '@/lib/services/unsubscribe-service';
import { getErrorMessage } from '@/lib/errors/report-error';

interface PreferenceInput {
  emailStatus: 'valid' | 'bounced' | 'unsubscribed' | 'complained' | 'snoozed' | 'opt-down';
  unsubscribedCategories?: string[];
  snoozedUntil?: string;
  optDownFrequency?: 'weekly' | 'monthly' | 'default';
  entityId?: string;
  workspaceId?: string;
}

/**
 * Server action to process contact subscription preferences.
 */
export async function updatePreferencesAction(
  recipient: string,
  preferences: PreferenceInput
) {
  try {
    if (!recipient) {
      return { success: false, error: 'Recipient is required.' };
    }

    await processUnsubscribe(recipient, preferences);
    return { success: true };
  } catch (err: unknown) {
    console.error('[UNSUBSCRIBE-ACTION] Failed to save preferences:', getErrorMessage(err));
    return { success: false, error: getErrorMessage(err) };
  }
}
