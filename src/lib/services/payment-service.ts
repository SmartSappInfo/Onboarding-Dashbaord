/**
 * SmartSapp Finance 2.0 - Payment & Allocation Service
 * Multi-invoice atomic payment recording, allocation engine, and unallocated customer credit handling.
 * 
 * Invariants:
 * 1. Strict Firestore transaction lifecycle: ALL reads execute before ANY writes.
 * 2. Total allocated across invoices cannot exceed payment amount.
 * 3. Excess payment is credited directly to account availableCredit.
 * 4. All currency operations strictly rounded via Math.round(val * 100) / 100.
 */

import { adminDb } from '../firebase-admin';
import { Payment, PaymentAllocation, PaymentMethod, Invoice, FinancialTransaction } from '../types';
import { FinancialEventService } from './financial-event-service';

export interface InvoiceAllocationTarget {
  invoiceId: string;
  amount: number;
}

export interface RecordPaymentInput {
  organizationId: string;
  workspaceId: string;
  accountId: string;
  entityId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  provider?: string;
  providerTransactionId?: string;
  reference?: string;
  receivedAt?: string;
  payerName?: string;
  notes?: string;
  idempotencyKey?: string;
  allocations?: InvoiceAllocationTarget[];
}

export class PaymentService {
  /**
   * Records a payment and atomically allocates it across multiple invoices.
   * Enforces all reads before writes inside the Firestore transaction.
   */
  static async recordAndAllocatePayment(
    input: RecordPaymentInput,
    userId: string
  ): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    try {
      const totalAmount = Math.round((Number(input.amount) || 0) * 100) / 100;
      if (totalAmount <= 0) {
        return { success: false, error: 'Payment amount must be greater than zero' };
      }

      const timestamp = new Date().toISOString();
      const receivedAt = input.receivedAt || timestamp;

      // Filter valid allocations
      const rawAllocations = input.allocations || [];
      const sanitizedAllocations: InvoiceAllocationTarget[] = rawAllocations
        .filter((a) => a.invoiceId && Number(a.amount) > 0)
        .map((a) => ({
          invoiceId: a.invoiceId,
          amount: Math.round(Number(a.amount) * 100) / 100,
        }));

      const totalAllocated = sanitizedAllocations.reduce((sum, a) => sum + a.amount, 0);
      if (totalAllocated > totalAmount) {
        return {
          success: false,
          error: `Total allocated amount (${totalAllocated}) cannot exceed total payment amount (${totalAmount})`,
        };
      }

      const unallocatedAmount = Math.round((totalAmount - totalAllocated) * 100) / 100;

      // Execute Transaction
      const result = await adminDb.runTransaction(async (tx) => {
        // ─────────────────────────────────────────────────────────────────────
        // PHASE 1: ALL READS FIRST (Strict Firestore Transaction Invariant)
        // ─────────────────────────────────────────────────────────────────────

        // 1. Check idempotency if key provided
        if (input.idempotencyKey) {
          const existingSnap = await adminDb
            .collection('payments')
            .where('idempotencyKey', '==', input.idempotencyKey)
            .limit(1)
            .get();

          if (!existingSnap.empty) {
            return { success: true, paymentId: existingSnap.docs[0].id, allocatedList: [] };
          }
        }

        // 2. Read Financial Account
        const accountRef = adminDb.collection('financial_accounts').doc(input.accountId);
        const accountSnap = await tx.get(accountRef);
        if (!accountSnap.exists) {
          throw new Error(`Financial account ${input.accountId} does not exist`);
        }
        const accountData = accountSnap.data() || {};

        // 3. Read All Target Invoices
        const invoiceDocsMap = new Map<string, { ref: FirebaseFirestore.DocumentReference; data: Invoice }>();
        for (const alloc of sanitizedAllocations) {
          const invRef = adminDb.collection('invoices').doc(alloc.invoiceId);
          const invSnap = await tx.get(invRef);
          if (!invSnap.exists) {
            throw new Error(`Invoice ${alloc.invoiceId} not found`);
          }
          invoiceDocsMap.set(alloc.invoiceId, {
            ref: invRef,
            data: { id: invSnap.id, ...(invSnap.data() as Omit<Invoice, 'id'>) },
          });
        }

        // ─────────────────────────────────────────────────────────────────────
        // PHASE 2: ALL WRITES AFTER ALL READS
        // ─────────────────────────────────────────────────────────────────────

        // 4. Create Payment Document
        const paymentDocRef = adminDb.collection('payments').doc();
        const paymentData: Omit<Payment, 'id'> = {
          organizationId: input.organizationId,
          workspaceId: input.workspaceId,
          accountId: input.accountId,
          entityId: input.entityId,
          amount: totalAmount,
          allocatedAmount: totalAllocated,
          unallocatedAmount: unallocatedAmount,
          currency: input.currency || 'GHS',
          paymentMethod: input.paymentMethod,
          provider: input.provider,
          providerTransactionId: input.providerTransactionId,
          status: 'confirmed',
          reference: input.reference,
          receivedAt,
          settledAt: timestamp,
          payerName: input.payerName,
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
          createdBy: userId,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        tx.set(paymentDocRef, paymentData);

        // 5. Create Payment Allocations and update Invoices
        const createdAllocations: PaymentAllocation[] = [];
        for (const alloc of sanitizedAllocations) {
          const invoiceInfo = invoiceDocsMap.get(alloc.invoiceId);
          if (!invoiceInfo) continue;

          const invData = invoiceInfo.data;
          const currentPaid = Number(invData.amountPaid || 0);
          const currentCredited = Number(invData.amountCredited || 0);
          const totalPayable = Number(invData.totalPayable || 0);

          const newPaid = Math.round((currentPaid + alloc.amount) * 100) / 100;
          const calculatedBalanceDue = Math.max(0, Math.round((totalPayable - newPaid - currentCredited) * 100) / 100);
          const newPaymentStatus = calculatedBalanceDue === 0 ? 'paid' : 'partially_paid';

          // Create Allocation Doc
          const allocDocRef = adminDb.collection('payment_allocations').doc();
          const allocData: Omit<PaymentAllocation, 'id'> = {
            paymentId: paymentDocRef.id,
            accountId: input.accountId,
            invoiceId: alloc.invoiceId,
            invoiceNumber: invData.invoiceNumber,
            amount: alloc.amount,
            currency: input.currency || 'GHS',
            allocatedAt: timestamp,
            allocatedBy: userId,
            workspaceId: input.workspaceId,
            organizationId: input.organizationId,
          };
          tx.set(allocDocRef, allocData);
          createdAllocations.push({ id: allocDocRef.id, ...allocData });

          // Update Invoice
          tx.update(invoiceInfo.ref, {
            amountPaid: newPaid,
            balanceDue: calculatedBalanceDue,
            paymentStatus: newPaymentStatus,
            paidAt: calculatedBalanceDue === 0 ? timestamp : invData.paidAt,
            updatedAt: timestamp,
          });
        }

        // 6. Compute Account Balance & Post Ledger Transaction
        const currentBalance = Number(accountData.currentBalance || 0);
        const totalPaid = Number(accountData.totalPaid || 0);
        const curCredit = Number(accountData.availableCredit || 0);
        const newBalance = Math.round((currentBalance - totalAmount) * 100) / 100;
        const newTotalPaid = Math.round((totalPaid + totalAmount) * 100) / 100;
        const newAvailableCredit = Math.round((curCredit + unallocatedAmount) * 100) / 100;

        const transactionDocRef = adminDb.collection('financial_transactions').doc();
        const transactionData: Omit<FinancialTransaction, 'id'> = {
          organizationId: input.organizationId,
          workspaceId: input.workspaceId,
          accountId: input.accountId,
          entityId: input.entityId,
          transactionType: 'payment_received',
          referenceType: 'payment',
          referenceId: paymentDocRef.id,
          referenceNumber: input.reference,
          debit: 0,
          credit: totalAmount,
          currency: input.currency || 'GHS',
          balanceAfter: newBalance,
          effectiveAt: receivedAt,
          source: 'user',
          createdBy: userId,
          description: `Payment of ${input.currency || 'GHS'} ${totalAmount} via ${input.paymentMethod}`,
          metadata: {},
          createdAt: timestamp,
        };
        tx.set(transactionDocRef, transactionData);

        // 7. Update Account Balances in Single Atomic Write
        tx.update(accountRef, {
          currentBalance: newBalance,
          totalOutstanding: Math.max(0, newBalance),
          totalPaid: newTotalPaid,
          availableCredit: newAvailableCredit,
          updatedAt: timestamp,
        });

        return {
          success: true,
          paymentId: paymentDocRef.id,
          payment: { id: paymentDocRef.id, ...paymentData },
          allocatedList: createdAllocations,
        };
      });

      // Dispatch async financial events (non-blocking)
      if (result.success && result.payment) {
        FinancialEventService.emitPaymentReceived(result.payment, result.allocatedList, userId).catch((err) =>
          console.error('[PAYMENT_SERVICE] Event emit error:', err)
        );
      }

      return { success: true, paymentId: result.paymentId };
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to record payment';
      console.error('[PAYMENT_SERVICE] Error recording payment:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Retrieves all payments for an account.
   */
  static async getPaymentsForAccount(accountId: string): Promise<Payment[]> {
    const snap = await adminDb
      .collection('payments')
      .where('accountId', '==', accountId)
      .orderBy('receivedAt', 'desc')
      .get();

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Payment, 'id'>),
    }));
  }

  /**
   * Retrieves all allocations for an invoice.
   */
  static async getAllocationsForInvoice(invoiceId: string): Promise<PaymentAllocation[]> {
    const snap = await adminDb
      .collection('payment_allocations')
      .where('invoiceId', '==', invoiceId)
      .orderBy('allocatedAt', 'desc')
      .get();

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<PaymentAllocation, 'id'>),
    }));
  }
}
