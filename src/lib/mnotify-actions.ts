
'use server';

import { getSmsBalance, getSenderIdStatus, registerSenderId, getScheduledMessages, updateScheduledSms, deleteScheduledSms, getSmsMetrics } from './mnotify-service';

/**
 * Server Action to fetch current SMS credit balance.
 */
export async function fetchSmsBalanceAction() {
  try {
    const balance = await getSmsBalance();
    return { success: true, balance: Number(balance) };
  } catch (error: any) {
    console.error(">>> [MNOTIFY] Balance Fetch Failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Server Action to check approval status of a Sender ID.
 */
export async function checkSenderIdStatusAction(name: string) {
  try {
    const data = await getSenderIdStatus(name);
    return { 
        success: true, 
        status: data.status, 
        message: data.message 
    };
  } catch (error: any) {
    console.error(">>> [MNOTIFY] Status Check Failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Server Action to register a new Sender ID.
 */
export async function registerSenderIdAction(name: string, purpose: string) {
  try {
    const data = await registerSenderId(name, purpose);
    return { success: true, message: data.message };
  } catch (error: any) {
    console.error(">>> [MNOTIFY] Registration Failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Server Action to fetch scheduled messages.
 */
export async function fetchScheduledMessagesAction() {
    try {
        const data = await getScheduledMessages();
        return { success: true, messages: data.scheduled_messages || [] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Server Action to update a scheduled message.
 */
export async function updateScheduledMessageAction(id: string, message: string, date: Date, sender: string) {
    try {
        await updateScheduledSms(id, message, date, sender);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Server Action to delete a scheduled message.
 */
export async function deleteScheduledMessageAction(id: string) {
    try {
        await deleteScheduledSms(id);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Server Action to fetch campaign reports.
 */
export async function fetchSmsReportsAction(from: string, to: string) {
    try {
        const data = await getSmsMetrics(from, to);
        return { success: true, report: data.report || [] };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
