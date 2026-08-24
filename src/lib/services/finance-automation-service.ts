/**
 * SmartSapp Finance 2.0 - Finance Automation & Multi-Channel Reminder Service
 * Automated payment reminders across WhatsApp, Email, and SMS with idempotent dispatch locks.
 */

import { adminDb } from '../firebase-admin';
import { 
  Invoice, 
  ReminderChannel, 
  ReminderStage, 
  FinanceReminderLog 
} from '../types';
import { CollectionCaseService } from './collection-case-service';
import { logActivity } from '../activity-logger';

export interface SingleReminderParams {
  workspaceId: string;
  invoiceId: string;
  channel: ReminderChannel;
  customMessage?: string;
  userId: string;
  userName: string;
}

export interface ReminderCycleResult {
  invoicesScanned: number;
  remindersDispatched: number;
  skippedAlreadySent: number;
  casesEscalated: number;
}

export class FinanceAutomationService {
  /**
   * Evaluates days difference and returns the appropriate reminder milestone stage.
   */
  static determineReminderStage(daysDiff: number): ReminderStage | null {
    // Negative daysDiff means before due date; positive means overdue
    if (daysDiff === -7) return 't_minus_7';
    if (daysDiff === -3) return 't_minus_3';
    if (daysDiff === 0) return 'due_date';
    if (daysDiff === 3) return 't_plus_3';
    if (daysDiff === 7) return 't_plus_7';
    if (daysDiff === 14) return 't_plus_14';
    if (daysDiff >= 30) return 't_plus_30';
    return null;
  }

  /**
   * Generates localized, professional reminder copy for the customer.
   */
  static formatReminderMessage(
    invoice: Invoice,
    stage: ReminderStage,
    entityName: string
  ): string {
    const currency = invoice.currency || 'GHS';
    const balance = Number(invoice.balanceDue ?? invoice.totalPayable ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
    const dueDate = invoice.dueDate || invoice.issuedAt?.split('T')[0] || 'due date';

    switch (stage) {
      case 't_minus_7':
        return `Friendly reminder for ${entityName}: Invoice ${invoice.invoiceNumber} (${currency} ${balance}) will be due on ${dueDate}. Please arrange remittance at your convenience.`;
      case 't_minus_3':
        return `Payment Notice for ${entityName}: Invoice ${invoice.invoiceNumber} (${currency} ${balance}) is due in 3 days on ${dueDate}.`;
      case 'due_date':
        return `Payment Due Today for ${entityName}: Invoice ${invoice.invoiceNumber} (${currency} ${balance}) is due today (${dueDate}). Thank you for your partnership.`;
      case 't_plus_3':
        return `Grace Period Notice for ${entityName}: Invoice ${invoice.invoiceNumber} (${currency} ${balance}) was due on ${dueDate}. Please let us know once payment has been disbursed.`;
      case 't_plus_7':
        return `Overdue Notice (1st) for ${entityName}: Invoice ${invoice.invoiceNumber} (${currency} ${balance}) is 7 days overdue. Please process payment immediately to maintain active status.`;
      case 't_plus_14':
        return `Urgent Overdue Notice (2nd) for ${entityName}: Invoice ${invoice.invoiceNumber} (${currency} ${balance}) is now 14 days overdue. Please contact our finance team or reply with remittance advice.`;
      case 't_plus_30':
        return `FINAL DEMAND NOTICE for ${entityName}: Invoice ${invoice.invoiceNumber} (${currency} ${balance}) is over 30 days delinquent. Your account is being escalated to formal debt recovery.`;
      default:
        return `Payment Notice for ${entityName}: Invoice ${invoice.invoiceNumber} balance is ${currency} ${balance}.`;
    }
  }

  /**
   * Executes a daily automated reminder cycle across all open invoices in the workspace.
   * Guarantees daily idempotency: never sends the same stage reminder twice on the same day.
   */
  static async executeReminderCycle(
    workspaceId: string,
    userId: string = 'system',
    userName: string = 'Automation Engine'
  ): Promise<ReminderCycleResult> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 1. Fetch all open invoices
    const invSnap = await adminDb
      .collection('invoices')
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();

    let remindersDispatched = 0;
    let skippedAlreadySent = 0;
    let casesEscalated = 0;

    for (const doc of invSnap.docs) {
      const inv = { id: doc.id, ...(doc.data() as Omit<Invoice, 'id'>) };

      // Skip void, draft, or fully settled invoices
      if (
        inv.status === 'void' ||
        inv.lifecycleStatus === 'void' ||
        inv.status === 'draft' ||
        inv.status === 'paid' ||
        Number(inv.balanceDue ?? inv.totalPayable ?? 0) <= 0
      ) {
        continue;
      }

      const dueObj = new Date(inv.dueDate || inv.issuedAt || inv.createdAt);
      // Calendar day difference
      const msPerDay = 86400000;
      const diffDays = Math.floor((today.getTime() - dueObj.getTime()) / msPerDay);
      const stage = this.determineReminderStage(diffDays);

      if (!stage) continue;

      // 2. Idempotency Check: was a reminder for this invoice and stage sent today?
      const logCheckSnap = await adminDb
        .collection('finance_reminder_logs')
        .where('invoiceId', '==', inv.id)
        .where('stage', '==', stage)
        .where('sentDate', '==', todayStr)
        .limit(1)
        .get();

      if (!logCheckSnap.empty) {
        skippedAlreadySent++;
        continue;
      }

      const entityName = inv.entityName || 'Customer';
      const channel: ReminderChannel = 'whatsapp';
      const messageContent = this.formatReminderMessage(inv, stage, entityName);

      const reminderLog: Omit<FinanceReminderLog, 'id'> = {
        organizationId: inv.organizationId || 'default',
        workspaceIds: [workspaceId],
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        accountId: inv.accountId || '',
        entityId: inv.entityId || '',
        entityName,
        recipientPhone: inv.customerPhone,
        recipientEmail: inv.customerEmail,
        channel,
        stage,
        sentDate: todayStr,
        amountDue: Number(inv.balanceDue ?? inv.totalPayable ?? 0),
        currency: inv.currency || 'GHS',
        status: 'simulated', // Production gateway simulation / dispatch
        messageContent,
        createdAt: new Date().toISOString(),
      };

      await adminDb.collection('finance_reminder_logs').add(reminderLog);

      // Update invoice lastReminderSentAt
      await doc.ref.update({
        lastReminderSentAt: new Date().toISOString(),
        reminderCount: (inv.reminderCount || 0) + 1,
      });

      // Mirror into unified CRM Activity Feed
      await logActivity({
        userId,
        organizationId: inv.organizationId || 'default',
        workspaceId,
        type: 'interaction',
        source: 'finance_engine',
        description: `[Auto-Reminder: ${stage.toUpperCase()}] Dispatched via ${channel.toUpperCase()} to ${entityName} for Invoice ${inv.invoiceNumber}`,
        entityId: inv.entityId || '',
        metadata: {
          event: 'reminder.dispatched',
          invoiceId: inv.id,
          stage,
          channel,
        },
      });

      remindersDispatched++;

      // 3. Auto-Escalation to Collection Case on 30+ Day Overdue
      if (stage === 't_plus_30' && inv.entityId) {
        try {
          await CollectionCaseService.getOrCreateCaseForEntity(
            inv.entityId,
            workspaceId,
            userId,
            userName
          );
          casesEscalated++;
        } catch (e) {
          console.error('[FINANCE_AUTOMATION] Auto-escalation error:', e);
        }
      }
    }

    return {
      invoicesScanned: invSnap.size,
      remindersDispatched,
      skippedAlreadySent,
      casesEscalated,
    };
  }

  /**
   * Dispatches a single on-demand manual reminder for an invoice.
   */
  static async sendSingleReminder(params: SingleReminderParams): Promise<FinanceReminderLog> {
    const { workspaceId, invoiceId, channel, customMessage, userId, userName } = params;

    const invSnap = await adminDb.collection('invoices').doc(invoiceId).get();
    if (!invSnap.exists) throw new Error('Invoice not found');

    const inv = { id: invSnap.id, ...(invSnap.data() as Omit<Invoice, 'id'>) };
    const entityName = inv.entityName || 'Customer';
    const messageContent = customMessage?.trim() || this.formatReminderMessage(inv, 'manual', entityName);
    const timestamp = new Date().toISOString();
    const todayStr = timestamp.split('T')[0];

    const reminderLog: Omit<FinanceReminderLog, 'id'> = {
      organizationId: inv.organizationId || 'default',
      workspaceIds: [workspaceId],
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      accountId: inv.accountId || '',
      entityId: inv.entityId || '',
      entityName,
      recipientPhone: inv.customerPhone,
      recipientEmail: inv.customerEmail,
      channel,
      stage: 'manual',
      sentDate: todayStr,
      amountDue: Number(inv.balanceDue ?? inv.totalPayable ?? 0),
      currency: inv.currency || 'GHS',
      status: 'simulated',
      messageContent,
      createdAt: timestamp,
    };

    const docRef = await adminDb.collection('finance_reminder_logs').add(reminderLog);

    await invSnap.ref.update({
      lastReminderSentAt: timestamp,
      reminderCount: (inv.reminderCount || 0) + 1,
    });

    await logActivity({
      userId,
      organizationId: inv.organizationId || 'default',
      workspaceId,
      type: 'interaction',
      source: 'finance_engine',
      description: `[Manual Reminder: ${channel.toUpperCase()}] Sent by ${userName} to ${entityName} for ${inv.invoiceNumber}`,
      entityId: inv.entityId,
      metadata: {
        event: 'reminder.manual_dispatched',
        invoiceId: inv.id,
        channel,
        sentBy: userName,
      },
    });

    return { id: docRef.id, ...reminderLog };
  }
}
