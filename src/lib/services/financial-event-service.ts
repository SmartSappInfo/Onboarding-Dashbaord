/**
 * SmartSapp Finance 2.0 - Financial Event Service
 * Standard event dispatcher connecting monetary transactions to CRM timelines & automations.
 */

import { logActivity } from '../activity-logger';
import { Invoice, Payment, PaymentAllocation, FinancialAccount } from '../types';

export class FinancialEventService {
  /**
   * Emits invoice.issued event to customer timeline and automation bus.
   */
  static async emitInvoiceIssued(invoice: Invoice, userId: string): Promise<void> {
    try {
      await logActivity({
        userId,
        organizationId: invoice.organizationId || 'default',
        workspaceId: invoice.workspaceIds?.[0] || 'default',
        type: 'status_change',
        source: 'finance_engine',
        description: `Invoice ${invoice.invoiceNumber} issued for ${invoice.currency} ${invoice.totalPayable.toLocaleString()}`,
        entityId: invoice.entityId || undefined,
        entityName: invoice.entityName || undefined,
        metadata: {
          event: 'invoice.issued',
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalPayable: invoice.totalPayable,
          currency: invoice.currency,
          periodName: invoice.periodName,
        },
      });
    } catch (err) {
      console.error('[FINANCIAL_EVENT] Failed to emit invoice.issued:', err);
    }
  }

  /**
   * Emits payment.received event and links allocations.
   */
  static async emitPaymentReceived(
    payment: Payment,
    allocations: PaymentAllocation[],
    userId: string
  ): Promise<void> {
    try {
      const invoiceNums = allocations.map((a) => a.invoiceNumber).filter(Boolean).join(', ');
      const desc = invoiceNums
        ? `Payment of ${payment.currency} ${payment.amount.toLocaleString()} received via ${payment.paymentMethod} (Allocated to: ${invoiceNums})`
        : `Payment of ${payment.currency} ${payment.amount.toLocaleString()} received via ${payment.paymentMethod}`;

      await logActivity({
        userId,
        organizationId: payment.organizationId || 'default',
        workspaceId: payment.workspaceId,
        type: 'status_change',
        source: 'finance_engine',
        description: desc,
        entityId: payment.entityId,
        metadata: {
          event: 'payment.received',
          paymentId: payment.id,
          amount: payment.amount,
          allocatedAmount: payment.allocatedAmount,
          unallocatedAmount: payment.unallocatedAmount,
          currency: payment.currency,
          paymentMethod: payment.paymentMethod,
          reference: payment.reference,
          allocations: allocations.map((a) => ({
            invoiceId: a.invoiceId,
            invoiceNumber: a.invoiceNumber,
            amount: a.amount,
          })),
        },
      });
    } catch (err) {
      console.error('[FINANCIAL_EVENT] Failed to emit payment.received:', err);
    }
  }

  /**
   * Emits account.balance_changed event.
   */
  static async emitAccountBalanceChanged(
    account: FinancialAccount,
    previousBalance: number,
    userId: string
  ): Promise<void> {
    try {
      await logActivity({
        userId,
        organizationId: account.organizationId || 'default',
        workspaceId: account.workspaceId,
        type: 'status_change',
        source: 'finance_engine',
        description: `Account ${account.accountNumber} balance updated from ${account.currency} ${previousBalance.toLocaleString()} to ${account.currency} ${account.currentBalance.toLocaleString()}`,
        entityId: account.entityId,
        metadata: {
          event: 'account.balance_changed',
          accountId: account.id,
          accountNumber: account.accountNumber,
          previousBalance,
          newBalance: account.currentBalance,
          currency: account.currency,
        },
      });
    } catch (err) {
      console.error('[FINANCIAL_EVENT] Failed to emit account.balance_changed:', err);
    }
  }
}
