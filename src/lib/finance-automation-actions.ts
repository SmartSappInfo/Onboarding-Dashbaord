'use server';

/**
 * SmartSapp Finance 2.0 - Finance Automation Server Actions
 * Handles automated reminder cycles and log queries with canUser RBAC.
 */

import { canUser } from './workspace-permissions';
import { 
  ActionResponse, 
  FinanceReminderLog, 
  ReminderChannel 
} from './types';
import { 
  FinanceAutomationService, 
  ReminderCycleResult 
} from './services/finance-automation-service';
import { adminDb } from './firebase-admin';

export async function runReminderCycleAction(
  workspaceId: string,
  userId: string,
  userName: string
): Promise<ActionResponse & { result?: ReminderCycleResult }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance management permissions.' };
    }

    const result = await FinanceAutomationService.executeReminderCycle(
      workspaceId,
      userId,
      userName
    );
    return { success: true, result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to execute reminder cycle';
    return { success: false, error: msg };
  }
}

export interface SendSingleReminderInput {
  invoiceId: string;
  channel: ReminderChannel;
  customMessage?: string;
}

export async function sendInvoiceReminderAction(
  input: SendSingleReminderInput,
  workspaceId: string,
  userId: string,
  userName: string
): Promise<ActionResponse & { log?: FinanceReminderLog }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance permissions.' };
    }

    const log = await FinanceAutomationService.sendSingleReminder({
      ...input,
      workspaceId,
      userId,
      userName,
    });
    return { success: true, log };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to send reminder';
    return { success: false, error: msg };
  }
}

export async function getReminderLogsAction(
  workspaceId: string,
  userId: string,
  limitCount: number = 50
): Promise<ActionResponse & { logs?: FinanceReminderLog[] }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'view', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient viewing permissions.' };
    }

    const snap = await adminDb
      .collection('finance_reminder_logs')
      .where('workspaceIds', 'array-contains', workspaceId)
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();

    const logs: FinanceReminderLog[] = snap.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<FinanceReminderLog, 'id'>),
    }));

    return { success: true, logs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to load reminder logs';
    return { success: false, error: msg };
  }
}
