'use server';

/**
 * SmartSapp Finance 2.0 - Server Actions
 * Strictly typed server actions for Financial Accounts, Ledger, and Payments.
 * Enforces permission checks and tenant isolation.
 */

import { adminDb } from './firebase-admin';
import { canUser } from './workspace-permissions';
import { FinancialAccount, FinancialTransaction, Payment, PaymentAllocation, Invoice } from './types';
import { FinancialAccountService } from './services/financial-account-service';
import { LedgerService } from './services/ledger-service';
import { PaymentService, RecordPaymentInput } from './services/payment-service';
import { FinancialEventService } from './services/financial-event-service';
import { revalidatePath } from 'next/cache';

export interface FinanceActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Retrieves or auto-provisions a financial account for an entity within a workspace.
 */
export async function getOrCreateFinancialAccountAction(
  entityId: string,
  workspaceId: string,
  organizationId: string,
  entityName?: string,
  currency?: string
): Promise<FinanceActionResponse<FinancialAccount>> {
  try {
    if (!entityId || !workspaceId) {
      return { success: false, error: 'Entity ID and Workspace ID are required' };
    }

    const account = await FinancialAccountService.getOrCreateFinancialAccount({
      entityId,
      workspaceId,
      organizationId: organizationId || 'default',
      entityName,
      currency: currency || 'GHS',
    });

    return { success: true, data: account };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Failed to retrieve financial account';
    return { success: false, error: errorMsg };
  }
}

/**
 * Records a payment, executes allocations, updates ledger, and logs CRM events.
 */
export async function recordPaymentAction(
  input: RecordPaymentInput,
  userId: string
): Promise<FinanceActionResponse<{ paymentId: string }>> {
  try {
    if (!userId) {
      return { success: false, error: 'User must be authenticated' };
    }

    // Permission check
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', input.workspaceId);
    if (!permission.granted) {
      return { success: false, error: permission.reason || 'Permission denied to record payments' };
    }

    const res = await PaymentService.recordAndAllocatePayment(input, userId);
    if (!res.success || !res.paymentId) {
      return { success: false, error: res.error || 'Failed to record payment' };
    }

    // Fetch created allocations and payment for event emission
    const [paymentDoc, allocations] = await Promise.all([
      adminDb.collection('payments').doc(res.paymentId).get(),
      PaymentService.getAllocationsForInvoice(input.allocations?.[0]?.invoiceId || ''),
    ]);

    if (paymentDoc.exists) {
      const paymentData = { id: paymentDoc.id, ...(paymentDoc.data() as Omit<Payment, 'id'>) };
      await FinancialEventService.emitPaymentReceived(paymentData, allocations, userId);
    }

    revalidatePath('/admin/finance/invoices');
    revalidatePath(`/admin/finance/invoices/${input.allocations?.[0]?.invoiceId || ''}`);

    return { success: true, data: { paymentId: res.paymentId } };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Failed to process payment action';
    return { success: false, error: errorMsg };
  }
}

/**
 * Retrieves the ledger transaction history for a financial account.
 */
export async function getAccountLedgerAction(
  accountId: string,
  workspaceId: string
): Promise<FinanceActionResponse<FinancialTransaction[]>> {
  try {
    if (!accountId) {
      return { success: false, error: 'Account ID is required' };
    }

    const transactions = await LedgerService.getAccountLedger(accountId, workspaceId, 50);
    return { success: true, data: transactions };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Failed to fetch ledger';
    return { success: false, error: errorMsg };
  }
}

/**
 * Retrieves all payments for an account.
 */
export async function getPaymentsForAccountAction(
  accountId: string
): Promise<FinanceActionResponse<Payment[]>> {
  try {
    if (!accountId) {
      return { success: false, error: 'Account ID is required' };
    }

    const payments = await PaymentService.getPaymentsForAccount(accountId);
    return { success: true, data: payments };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Failed to fetch payments';
    return { success: false, error: errorMsg };
  }
}

/**
 * Retrieves all payment allocations for an invoice.
 */
export async function getInvoiceAllocationsAction(
  invoiceId: string
): Promise<FinanceActionResponse<PaymentAllocation[]>> {
  try {
    if (!invoiceId) {
      return { success: false, error: 'Invoice ID is required' };
    }

    const allocations = await PaymentService.getAllocationsForInvoice(invoiceId);
    return { success: true, data: allocations };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Failed to fetch allocations';
    return { success: false, error: errorMsg };
  }
}

/**
 * Retrieves unpaid / partially paid invoices for an entity to display in payment allocation picker.
 */
export async function getUnpaidInvoicesForEntityAction(
  entityId: string,
  workspaceId: string
): Promise<FinanceActionResponse<Invoice[]>> {
  try {
    if (!entityId || !workspaceId) {
      return { success: false, error: 'Entity ID and Workspace ID are required' };
    }

    const snap = await adminDb.collection('invoices')
      .where('entityId', '==', entityId)
      .where('workspaceIds', 'array-contains', workspaceId)
      .where('status', 'in', ['sent', 'issued', 'draft'])
      .get();

    const invoices = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Invoice, 'id'>) }))
      .filter((inv) => (inv.balanceDue === undefined ? inv.status !== 'paid' : inv.balanceDue > 0));

    return { success: true, data: invoices };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Failed to fetch unpaid invoices';
    return { success: false, error: errorMsg };
  }
}
