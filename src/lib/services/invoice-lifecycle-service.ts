/**
 * SmartSapp Finance 2.0 - Invoice Lifecycle Service
 * Manages multi-state lifecycle transitions: Issuance, Voiding, Disputes, and Reversals.
 * 
 * Invariants:
 * 1. Invoices are NEVER hard-deleted once issued; they are voided with compensating ledger entries.
 * 2. Voiding an invoice with allocations automatically releases those payments back to the customer's availableCredit
 *    and synchronizes the parent Payment document's allocated/unallocated counters.
 * 3. Strict Firestore transaction lifecycle: All reads execute before writes across all referenced documents.
 */

import { adminDb } from '../firebase-admin';
import { Invoice, FinancialTransaction, PaymentAllocation, Payment } from '../types';
import { InvoiceSnapshotService } from './invoice-snapshot-service';
import { MaterializedSummaryService } from './materialized-summary-service';
import { logActivity } from '../activity-logger';

export interface VoidInvoiceParams {
  invoiceId: string;
  voidReason: string;
  userId: string;
}

export class InvoiceLifecycleService {
  /**
   * Issues a draft invoice atomically:
   * Enforces STRICT Firestore transaction ordering (ALL reads execute before ANY writes).
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
    const year = new Date().getFullYear();

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 1: ALL TRANSACTIONAL READS FIRST
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Read Invoice to ensure it exists and is still an unfinalized draft (Optimistic Lock)
    const invSnap = await tx.get(invoiceRef);
    if (!invSnap.exists) {
      throw new Error('Invoice document does not exist.');
    }
    const currentInvData = invSnap.data() as Invoice;
    if (currentInvData.status !== 'draft') {
      throw new Error(`Cannot issue invoice: current status is already '${currentInvData.status}'.`);
    }

    // 2. Read Sequence Counter
    const counterDocId = `invoice_seq_${workspaceId}_${year}`;
    const counterRef = adminDb.collection('system_counters').doc(counterDocId);
    const counterSnap = await tx.get(counterRef);
    let currentSeq = 0;
    if (counterSnap.exists) {
      currentSeq = counterSnap.data()?.lastNumber || 0;
    }

    // 3. Read Financial Account
    const accountRef = adminDb.collection('financial_accounts').doc(accountId);
    const accountSnap = await tx.get(accountRef);
    if (!accountSnap.exists) {
      throw new Error(`Financial account ${accountId} does not exist.`);
    }
    const accountData = accountSnap.data() || {};

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2: CALCULATIONS & ASYNC DATA RESOLUTION
    // ─────────────────────────────────────────────────────────────────────────
    let invoiceNumber = invoiceData.invoiceNumber;
    let nextSeq = currentSeq;
    if (!invoiceNumber || invoiceNumber.startsWith('DRAFT-')) {
      nextSeq = currentSeq + 1;
      const paddedNumber = String(nextSeq).padStart(6, '0');
      invoiceNumber = `INV-${year}-${paddedNumber}`;
    }

    const snapshot = await InvoiceSnapshotService.createSnapshot({
      ...invoiceData,
      invoiceNumber,
    });

    const totalDebit = Math.round((Number(invoiceData.totalPayable) || 0) * 100) / 100;
    const currentBalance = Number(accountData.currentBalance || 0);
    const totalInvoiced = Number(accountData.totalInvoiced || 0);
    const availableCredit = Number(accountData.availableCredit || 0);

    const newBalance = Math.round((currentBalance + totalDebit) * 100) / 100;
    const newTotalInvoiced = Math.round((totalInvoiced + totalDebit) * 100) / 100;

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 3: ALL TRANSACTIONAL WRITES
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Update Sequence Counter
    if (nextSeq > currentSeq) {
      tx.set(
        counterRef,
        {
          workspaceId,
          year,
          prefix: 'INV',
          lastNumber: nextSeq,
          updatedAt: timestamp,
        },
        { merge: true }
      );
    }

    // 2. Post Sub-Ledger Transaction
    const transactionDocRef = adminDb.collection('financial_transactions').doc();
    const transactionData: Omit<FinancialTransaction, 'id'> = {
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
      balanceAfter: newBalance,
      effectiveAt: timestamp,
      source: 'user',
      createdBy: userId,
      description: `Invoice ${invoiceNumber} issued for ${invoiceData.currency || 'GHS'} ${totalDebit}`,
      metadata: {},
      createdAt: timestamp,
    };
    tx.set(transactionDocRef, transactionData);

    // 3. Update Financial Account Balance
    tx.update(accountRef, {
      currentBalance: newBalance,
      totalOutstanding: Math.max(0, newBalance),
      totalInvoiced: newTotalInvoiced,
      availableCredit,
      updatedAt: timestamp,
    });

    // 4. Update Invoice Document
    const currentPaid = Number(invoiceData.amountPaid || 0);
    const balanceDue = Math.max(0, Math.round((totalDebit - currentPaid) * 100) / 100);
    const paymentStatus = currentPaid > 0 ? (totalDebit <= currentPaid ? 'paid' : 'partially_paid') : 'unpaid';

    tx.update(invoiceRef, {
      invoiceNumber,
      status: 'issued',
      lifecycleStatus: 'issued',
      paymentStatus,
      collectionStatus: 'none',
      balanceDue,
      snapshot,
      issuedAt: timestamp,
      sentAt: timestamp,
      updatedAt: timestamp,
    });

    // 5. Update Materialized Workspace Summary Atomically
    MaterializedSummaryService.incrementWorkspaceSummaryInTx(tx, workspaceId, {
      billedDelta: totalDebit,
      arDelta: balanceDue,
      invoicesCountDelta: 1,
    });

    return { invoiceNumber, totalDebit };
  }

  /**
   * Voids an issued invoice atomically:
   * - Releases allocated payments back to customer availableCredit
   * - Synchronizes parent Payment document allocation counters
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

      // Group released amounts by parent paymentId
      const paymentDeltas = new Map<string, number>();
      for (const a of allocations) {
        if (a.paymentId) {
          paymentDeltas.set(a.paymentId, (paymentDeltas.get(a.paymentId) || 0) + a.amount);
        }
      }

      let targetWorkspaceId = 'default';
      let targetOrgId = 'default';

      await adminDb.runTransaction(async (tx) => {
        // ─────────────────────────────────────────────────────────────────────
        // PHASE 1: ALL READS FIRST
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

        targetWorkspaceId = invoice.workspaceIds?.[0] || 'default';
        targetOrgId = invoice.organizationId || 'default';

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

        // Read all parent Payment docs affected by these released allocations
        const paymentDocsMap = new Map<string, { ref: FirebaseFirestore.DocumentReference; data: Payment }>();
        for (const paymentId of paymentDeltas.keys()) {
          const pRef = adminDb.collection('payments').doc(paymentId);
          const pSnap = await tx.get(pRef);
          if (pSnap.exists) {
            paymentDocsMap.set(paymentId, {
              ref: pRef,
              data: { id: pSnap.id, ...(pSnap.data() as Omit<Payment, 'id'>) },
            });
          }
        }

        // ─────────────────────────────────────────────────────────────────────
        // PHASE 2: ALL WRITES AFTER READS
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

        // 3. Synchronize Parent Payment Document Counters
        for (const [paymentId, releasedAmount] of paymentDeltas.entries()) {
          const paymentInfo = paymentDocsMap.get(paymentId);
          if (paymentInfo) {
            const currentAllocated = Number(paymentInfo.data.allocatedAmount || 0);
            const currentUnallocated = Number(paymentInfo.data.unallocatedAmount || 0);
            const newAllocated = Math.max(0, Math.round((currentAllocated - releasedAmount) * 100) / 100);
            const newUnallocated = Math.round((currentUnallocated + releasedAmount) * 100) / 100;

            tx.update(paymentInfo.ref, {
              allocatedAmount: newAllocated,
              unallocatedAmount: newUnallocated,
              updatedAt: timestamp,
            });
          }
        }

        // 4. Update Financial Account Balances
        tx.update(accountRef, {
          currentBalance: newBalance,
          totalOutstanding: Math.max(0, newBalance),
          availableCredit: newAvailableCredit,
          updatedAt: timestamp,
        });

        // 5. Mark Invoice as Void
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

      // 6. Emit CRM Activity (Non-blocking)
      await logActivity({
        userId,
        organizationId: targetOrgId,
        workspaceId: targetWorkspaceId,
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
