/**
 * SmartSapp Finance 2.0 - Payment Service
 * Handles first-class payments, multi-invoice allocations, and account credit reconciliation.
 * 
 * Invariants:
 * 1. Payments exist independently of single invoices.
 * 2. One payment can be allocated across multiple invoices.
 * 3. Any excess payment amount is held as unallocatedAmount and credited to account availableCredit.
 * 4. All allocations and balance updates run in an atomic Firestore transaction.
 */

import { adminDb } from '../firebase-admin';
import { Payment, PaymentAllocation, PaymentMethod, Invoice } from '../types';
import { LedgerService } from './ledger-service';

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
  payerName?: string;
  notes?: string;
  receivedAt?: string;
  idempotencyKey?: string;
  allocations?: InvoiceAllocationTarget[];
}

export class PaymentService {
  /**
   * Records a payment and applies allocations atomically across targeted invoices and ledger.
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

      // Validate allocations before transaction
      const rawAllocations = input.allocations || [];
      const sanitizedAllocations: InvoiceAllocationTarget[] = rawAllocations
        .filter((a) => a.invoiceId && Number(a.amount) > 0)
        .map((a) => ({
          invoiceId: a.invoiceId,
          amount: Math.round(Number(a.amount) * 100) / 100,
        }));

      const totalAllocated = sanitizedAllocations.reduce((sum, a) => sum + a.amount, 0);
      if (totalAllocated > totalAmount) {
        return { success: false, error: 'Total allocated amount cannot exceed the total payment amount' };
      }

      const unallocatedAmount = Math.round((totalAmount - totalAllocated) * 100) / 100;

      const result = await adminDb.runTransaction(async (tx) => {
        // 1. Check idempotency if key provided
        if (input.idempotencyKey) {
          const existingSnap = await adminDb.collection('payments')
            .where('idempotencyKey', '==', input.idempotencyKey)
            .limit(1)
            .get();

          if (!existingSnap.empty) {
            return { success: true, paymentId: existingSnap.docs[0].id };
          }
        }

        // 2. Fetch and validate all target invoices inside transaction
        const invoiceDocsMap = new Map<string, { ref: FirebaseFirestore.DocumentReference; data: Invoice }>();
        for (const alloc of sanitizedAllocations) {
          const invRef = adminDb.collection('invoices').doc(alloc.invoiceId);
          const invSnap = await tx.get(invRef);
          if (!invSnap.exists) {
            throw new Error(`Invoice ${alloc.invoiceId} not found`);
          }
          invoiceDocsMap.set(alloc.invoiceId, { ref: invRef, data: { id: invSnap.id, ...(invSnap.data() as Omit<Invoice, 'id'>) } });
        }

        // 3. Create Payment Document
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

        // 4. Create Payment Allocations and update Invoices
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

          // Update Invoice
          tx.update(invoiceInfo.ref, {
            amountPaid: newPaid,
            balanceDue: calculatedBalanceDue,
            paymentStatus: newPaymentStatus,
            paidAt: calculatedBalanceDue === 0 ? timestamp : invData.paidAt,
            updatedAt: timestamp,
          });
        }

        // 5. Post Ledger Entry
        await LedgerService.postTransactionInTx(tx, {
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
          source: 'user',
          createdBy: userId,
          effectiveAt: receivedAt,
          description: `Payment of ${input.currency || 'GHS'} ${totalAmount} via ${input.paymentMethod}`,
        });

        // 6. If there's unallocated amount, update account's available credit
        if (unallocatedAmount > 0) {
          const accountRef = adminDb.collection('financial_accounts').doc(input.accountId);
          const accountSnap = await tx.get(accountRef);
          if (accountSnap.exists) {
            const accData = accountSnap.data() || {};
            const curCredit = Number(accData.availableCredit || 0);
            tx.update(accountRef, {
              availableCredit: Math.round((curCredit + unallocatedAmount) * 100) / 100,
              updatedAt: timestamp,
            });
          }
        }

        return { success: true, paymentId: paymentDocRef.id };
      });

      return result;
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to record payment';
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Retrieves payments recorded for an account.
   */
  static async getPaymentsForAccount(accountId: string, limitCount = 50): Promise<Payment[]> {
    const snap = await adminDb.collection('payments')
      .where('accountId', '==', accountId)
      .orderBy('receivedAt', 'desc')
      .limit(limitCount)
      .get();

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Payment, 'id'>),
    }));
  }

  /**
   * Retrieves all allocations linked to an invoice.
   */
  static async getAllocationsForInvoice(invoiceId: string): Promise<PaymentAllocation[]> {
    const snap = await adminDb.collection('payment_allocations')
      .where('invoiceId', '==', invoiceId)
      .orderBy('allocatedAt', 'desc')
      .get();

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<PaymentAllocation, 'id'>),
    }));
  }
}
