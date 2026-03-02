'use server';

import { getSmsBalance, getSenderIdStatus, registerSenderId } from './mnotify-service';

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
    // mNotify response for status usually contains the result in the 'message' or 'status' field
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
