/**
 * SmartSapp Finance 2.0 - Invoice Lifecycle Service
 * Manages multi-state lifecycle transitions: Issuance, Voiding, Disputes, and Reversals.
 * 
 * Invariants:
 * 1. Invoices are NEVER hard-deleted once issued; they are voided with compensating ledger entries.
 * 2. Voiding an invoice with allocations automatically releases those payments back to the customer's availableCredit.
 * 3. Strict Firestore transaction lifecycle: All reads execute before writes.
 */

import { adminDb } from '../firebase-admin';
import { Invoice, FinancialTransaction, PaymentAllocation } from '../types';
import { InvoiceSequenceService } from './invoice-sequence-service';
import { InvoiceSnapshotService } from './invoice-snapshot-service';
import { LedgerService } from './ledger-service';
import { logActivity } from '../activity-logger';

export interface VoidInvoiceParams {
  invoiceId: string;
  voidReason: string;
  userId: string;
}

export class InvoiceLifecycleService {
  /**
   * Issues a draft invoice atomically:
   * - Assigns sequential invoice number (e.g. INV-2026-000001)
   * - Creates immutable snapshot
   * - Posts debit transaction to sub-ledger
   * - Updates invoice status to 'issued'
   */
  static async issueInvoiceInTx(
    tx: FirebaseFirestore.Transaction,
    invoiceRef: FirebaseFirestore.DocumentReference,
    invoiceData: Invoice,
    userId: string,
    workspaceId: string,
    accountId: string
  ): Promise<{ invoiceNumber: string; totalDebit: number }> {
    const timestamp = new Date().toISOString();

    // 1. Sequence number allocation
    let invoiceNumber = invoiceData.invoiceNumber;
    if (!invoiceNumber || invoiceNumber.startsWith('DRAFT-')) {
      invoiceNumber = await InvoiceSequenceService.getNextInvoiceNumberInTx(tx, workspaceId, 'INV');
    }

    // 2. Snapshot creation
    const snapshot = await InvoiceSnapshotService.createSnapshot({
      ...invoiceData,
      invoiceNumber,
    });

    const totalDebit = Math.round((Number(invoiceData.totalPayable) || 0) * 100) / 100;

    // 3. Post sub-ledger transaction
    await LedgerService.postTransactionInTx(tx, {
      organizationId: invoiceData.organizationId || 'default',
      workspaceId,
      accountId,
      entityId: invoiceData.entityId || '',
      transactionType: 'invoice_issued',
      referenceType: 'invoice',
      referenceId: invoiceRef.id,
      referenceNumber: invoiceNumber,
      debit: totalDebit,
      credit: 0,
      currency: invoiceData.currency || 'GHS',
      source: 'user',
      createdBy: userId,
      description: `Invoice ${invoiceNumber} issued for ${invoiceData.currency || 'GHS'} ${totalDebit}`,
    });

    // 4. Update invoice document
    tx.update(invoiceRef, {
      invoiceNumber,
      status: 'issued',
      lifecycleStatus: 'issued',
      paymentStatus: invoiceData.amountPaid && invoiceData.amountPaid > 0 ? (totalDebit <= (invoiceData.amountPaid || 0) ? 'paid' : 'partially_paid') : 'unpaid',
      collectionStatus: 'none',
      balanceDue: Math.max(0, Math.round((totalDebit - (invoiceData.amountPaid || 0)) * 100) / 100),
      snapshot,
      issuedAt: timestamp,
      sentAt: timestamp,
      updatedAt: timestamp,
    });

    return { invoiceNumber, totalDebit };
  }

  /**
   * Voids an issued invoice atomically:
   * - Releases allocated payments back to customer availableCredit
   * - Posts compensating reversal transaction to sub-ledger
   * - Updates invoice status to 'void' and stores voidAudit
   */
  static async voidInvoice(
    params: VoidInvoiceParams
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { invoiceId, voidReason, userId } = params;
      if (!invoiceId || !voidReason?.trim()) {
        return { success: false, error: 'Invoice ID and void reason are required' };
      }

      const timestamp = new Date().toISOString();

      // Read allocations outside/before transaction
      const allocSnap = await adminDb
        .collection('payment_allocations')
        .where('invoiceId', '==', invoiceId)
        .get();

      const allocations: Array<{ id: string; amount: number; paymentId: string }> = allocSnap.docs.map((d) => {
        const data = d.data() as PaymentAllocation;
        return { id: d.id, amount: Number(data.amount) || 0, paymentId: data.paymentId };
      });

      const totalAllocatedToRelease = Math.round(
        allocations.reduce((sum, a) => sum + a.amount, 0) * 100
      ) / 100;

      await adminDb.runTransaction(async (tx) => {
        // ─────────────────────────────────────────────────────────────────────
        // ALL READS FIRST
        // ─────────────────────────────────────────────────────────────────────
        const invRef = adminDb.collection('invoices').doc(invoiceId);
        const invSnap = await tx.get(invRef);
        if (!invSnap.exists) {
          throw new Error('Invoice not found');
        }

        const invoice = { id: invSnap.id, ...(invSnap.data() as Omit<Invoice, 'id'>) };
        if (invoice.status === 'void' || invoice.lifecycleStatus === 'void') {
          throw new Error('Invoice is already voided');
        }

        const accountId = invoice.accountId;
        if (!accountId) {
          throw new Error('Invoice is not linked to a financial account');
        }

        const accountRef = adminDb.collection('financial_accounts').doc(accountId);
        const accountSnap = await tx.get(accountRef);
        if (!accountSnap.exists) {
          throw new Error('Financial account not found');
        }

        const accountData = accountSnap.data() || {};
        const totalDebitToReverse = Math.round((Number(invoice.totalPayable) || 0) * 100) / 100;

        // ─────────────────────────────────────────────────────────────────────
        // ALL WRITES AFTER READS
        // ─────────────────────────────────────────────────────────────────────

        // 1. Post Compensating Sub-Ledger Reversal
        const currentBalance = Number(accountData.currentBalance || 0);
        const curCredit = Number(accountData.availableCredit || 0);

        // Account balance decreases by invoice total debit amount
        const newBalance = Math.round((currentBalance - totalDebitToReverse) * 100) / 100;
        // Available credit increases by any payments that were allocated to this invoice
        const newAvailableCredit = Math.round((curCredit + totalAllocatedToRelease) * 100) / 100;

        const transactionDocRef = adminDb.collection('financial_transactions').doc();
        const transactionData: Omit<FinancialTransaction, 'id'> = {
          organizationId: invoice.organizationId || 'default',
          workspaceId: invoice.workspaceIds?.[0] || 'default',
          accountId,
          entityId: invoice.entityId || '',
          transactionType: 'reversal',
          referenceType: 'invoice',
          referenceId: invoice.id,
          referenceNumber: invoice.invoiceNumber,
          debit: 0,
          credit: totalDebitToReverse, // Credit reverses the original debit
          currency: invoice.currency || 'GHS',
          balanceAfter: newBalance,
          effectiveAt: timestamp,
          source: 'user',
          createdBy: userId,
          description: `Compensating reversal for voided invoice ${invoice.invoiceNumber}. Reason: ${voidReason.trim()}`,
          metadata: {
            voidReason: voidReason.trim(),
            releasedAllocations: totalAllocatedToRelease,
          },
          createdAt: timestamp,
        };
        tx.set(transactionDocRef, transactionData);

        // 2. Delete / Release Payment Allocations
        for (const alloc of allocations) {
          const allocRef = adminDb.collection('payment_allocations').doc(alloc.id);
          tx.delete(allocRef);
        }

        // 3. Update Financial Account Balances
        tx.update(accountRef, {
          currentBalance: newBalance,
          totalOutstanding: Math.max(0, newBalance),
          availableCredit: newAvailableCredit,
          updatedAt: timestamp,
        });

        // 4. Mark Invoice as Void
        tx.update(invRef, {
          status: 'void',
          lifecycleStatus: 'void',
          paymentStatus: 'unpaid',
          collectionStatus: 'none',
          balanceDue: 0,
          amountPaid: 0,
          voidedAt: timestamp,
          voidAudit: {
            voidedAt: timestamp,
            voidedBy: userId,
            voidReason: voidReason.trim(),
            ledgerReversalTransactionId: transactionDocRef.id,
            releasedAllocationsAmount: totalAllocatedToRelease,
          },
          updatedAt: timestamp,
        });
      });

      // 5. Emit CRM Activity (Non-blocking)
      await logActivity({
        userId,
        organizationId: 'default',
        workspaceId: 'default',
        type: 'status_change',
        source: 'finance_engine',
        description: `Invoice ${invoiceId} voided. Reason: ${voidReason.trim()}`,
        metadata: {
          event: 'invoice.voided',
          invoiceId,
          voidReason: voidReason.trim(),
          releasedAllocations: totalAllocatedToRelease,
        },
      });

      return { success: true };
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to void invoice';
      console.error('[INVOICE_LIFECYCLE] Error voiding invoice:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Disputes an issued invoice:
   * - Marks status as 'disputed'
   * - Stores dispute reason and audit trail
   */
  static async disputeInvoice(
    invoiceId: string,
    disputeReason: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!invoiceId || !disputeReason?.trim()) {
        return { success: false, error: 'Invoice ID and dispute reason are required' };
      }

      const timestamp = new Date().toISOString();
      const invRef = adminDb.collection('invoices').doc(invoiceId);

      const invSnap = await invRef.get();
      if (!invSnap.exists) {
        return { success: false, error: 'Invoice not found' };
      }

      const invoice = invSnap.data() as Invoice;
      if (invoice.status === 'void') {
        return { success: false, error: 'Cannot dispute a voided invoice' };
      }

      await invRef.update({
        collectionStatus: 'disputed',
        disputeReason: disputeReason.trim(),
        disputedAt: timestamp,
        updatedAt: timestamp,
      });

      await logActivity({
        userId,
        organizationId: invoice.organizationId || 'default',
        workspaceId: invoice.workspaceIds?.[0] || 'default',
        type: 'status_change',
        source: 'finance_engine',
        description: `Invoice ${invoice.invoiceNumber} marked in dispute: ${disputeReason.trim()}`,
        entityId: invoice.entityId || undefined,
        metadata: {
          event: 'invoice.disputed',
          invoiceId,
          disputeReason: disputeReason.trim(),
        },
      });

      return { success: true };
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to dispute invoice';
      console.error('[INVOICE_LIFECYCLE] Error disputing invoice:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }
}
