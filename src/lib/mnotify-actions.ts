'use server';

import { adminDb } from './firebase-admin';
import { 
    getSmsBalance, 
    getSenderIdStatus, 
    registerSenderId, 
    getScheduledMessages, 
    updateScheduledSms, 
    deleteScheduledSms, 
    getSmsMetrics,
    getSmsStatus 
} from './mnotify-service';

/**
 * Resolves the mNotify API key for a given organization if custom routing is enabled.
 */
async function resolveMnotifyApiKey(organizationId?: string): Promise<string | undefined> {
  if (!organizationId) return undefined;
  try {
    const orgSnap = await adminDb.collection('organizations').doc(organizationId).get();
    if (orgSnap.exists) {
      const org = orgSnap.data();
      if (org?.smsKeyMode === 'custom' && org?.mnotifyApiKey) {
        return org.mnotifyApiKey as string;
      }
    }
  } catch (error) {
    console.error(">>> [MNOTIFY-ACTIONS] Failed to resolve custom API key:", (error as Error).message);
  }
  return undefined;
}

/**
 * Server Action to fetch current SMS credit balance.
 */
export async function fetchSmsBalanceAction(organizationId?: string) {
  try {
    const apiKey = await resolveMnotifyApiKey(organizationId);
    const balance = await getSmsBalance(apiKey);
    return { success: true, balance: Number(balance) };
  } catch (error: unknown) {
    console.error(">>> [MNOTIFY] Balance Fetch Failed:", (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Server Action to check approval status of a Sender ID.
 */
export async function checkSenderIdStatusAction(name: string, organizationId?: string) {
  try {
    const apiKey = await resolveMnotifyApiKey(organizationId);
    const data = await getSenderIdStatus(name, apiKey);
    return { 
        success: true, 
        status: data.status, 
        message: data.message 
    };
  } catch (error: unknown) {
    console.error(">>> [MNOTIFY] Status Check Failed:", (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Server Action to register a new Sender ID.
 */
export async function registerSenderIdAction(name: string, purpose: string, organizationId?: string) {
  const trimmedName = name.trim();
  if (trimmedName.length > 11 || !/^[a-zA-Z0-9]+$/.test(trimmedName)) {
    return { 
      success: false, 
      error: 'SMS Sender ID must be alphanumeric and at most 11 characters long.' 
    };
  }

  try {
    const apiKey = await resolveMnotifyApiKey(organizationId);
    const data = await registerSenderId(trimmedName, purpose, apiKey);
    return { success: true, message: data.message };
  } catch (error: unknown) {
    console.error(">>> [MNOTIFY] Registration Failed:", (error as Error).message);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Server Action to fetch scheduled messages.
 */
export async function fetchScheduledMessagesAction(organizationId?: string) {
    try {
        const apiKey = await resolveMnotifyApiKey(organizationId);
        const data = await getScheduledMessages(apiKey);
        return { success: true, messages: data.scheduled_messages || [] };
    } catch (error: unknown) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Server Action to update a scheduled message.
 */
export async function updateScheduledMessageAction(
  id: string, 
  message: string, 
  date: Date, 
  sender: string, 
  organizationId?: string
) {
    try {
        const apiKey = await resolveMnotifyApiKey(organizationId);
        await updateScheduledSms(id, message, date, sender, apiKey);
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Server Action to delete a scheduled message.
 */
export async function deleteScheduledMessageAction(id: string, organizationId?: string) {
    try {
        const apiKey = await resolveMnotifyApiKey(organizationId);
        await deleteScheduledSms(id, apiKey);
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Server Action to fetch campaign reports.
 */
export async function fetchSmsReportsAction(from: string, to: string, organizationId?: string) {
    try {
        const apiKey = await resolveMnotifyApiKey(organizationId);
        const data = await getSmsMetrics(from, to, apiKey);
        return { success: true, report: data.report || [] };
    } catch (error: unknown) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Server Action to fetch the live status of an SMS from the gateway.
 */
export async function fetchSmsStatusAction(providerId: string, organizationId?: string) {
    try {
        const apiKey = await resolveMnotifyApiKey(organizationId);
        const data = await getSmsStatus(providerId, apiKey);
        return { success: true, data };
    } catch (error: unknown) {
        return { success: false, error: (error as Error).message };
    }
}
