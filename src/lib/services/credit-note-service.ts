/**
 * SmartSapp Finance 2.0 - Credit Note Service
 * Formal adjustment engine for credit & debit notes with atomic sub-ledger integration.
 * 
 * Invariants:
 * 1. Strict sub-ledger posting: Every credit note posts an immutable 'credit_note' transaction entry.
 * 2. Over-credit protection: Credit applied to invoice cannot exceed invoice balanceDue; excess routes to availableCredit.
 * 3. Strict transaction lifecycle: All reads execute before writes.
 */

import { adminDb } from '../firebase-admin';
import { 
  CreditNote, 
  CreditNoteReason, 
  Invoice, 
  FinancialAccount, 
  FinancialTransaction 
} from '../types';
import { logActivity } from '../activity-logger';

export interface IssueCreditNoteParams {
  workspaceId: string;
  userId: string;
  accountId: string;
  amount: number;
  reason: CreditNoteReason;
  reasonDetails?: string;
  invoiceId?: string;
  organizationId?: string;
}

export class CreditNoteService {
  /**
   * Issues a credit note atomically:
   * - Reduces invoice balance due (if linked)
   * - Routes any excess credit to customer availableCredit
   * - Posts credit transaction to sub-ledger
   * - Updates financial account balances
   */
  static async issueCreditNote(
    params: IssueCreditNoteParams
  ): Promise<{ success: boolean; creditNote?: CreditNote; error?: string }> {
    try {
      const { workspaceId, userId, accountId, amount, reason, reasonDetails, invoiceId, organizationId = 'default' } = params;

      if (!workspaceId || !userId || !accountId || amount <= 0) {
        return { success: false, error: 'Valid workspace, user, account, and positive amount are required.' };
      }

      const cleanAmount = Math.round(amount * 100) / 100;
      const timestamp = new Date().toISOString();
      const year = new Date().getFullYear();

      // Allocator counter ref
      const counterDocId = `crn_seq_${workspaceId}_${year}`;
      const counterRef = adminDb.collection('system_counters').doc(counterDocId);

      const accountRef = adminDb.collection('financial_accounts').doc(accountId);
      const invRef = invoiceId ? adminDb.collection('invoices').doc(invoiceId) : null;

      let createdCreditNote: CreditNote | null = null;

      await adminDb.runTransaction(async (tx) => {
        // ─────────────────────────────────────────────────────────────────────
        // PHASE 1: ALL READS FIRST
        // ─────────────────────────────────────────────────────────────────────
        const accountSnap = await tx.get(accountRef);
        if (!accountSnap.exists) {
          throw new Error('Financial account not found');
        }
        const accountData = accountSnap.data() as FinancialAccount;

        let invData: Invoice | null = null;
        if (invRef) {
          const invSnap = await tx.get(invRef);
          if (!invSnap.exists) {
            throw new Error('Linked invoice not found');
          }
          invData = { id: invSnap.id, ...(invSnap.data() as Omit<Invoice, 'id'>) };
          if (invData.status === 'void' || invData.lifecycleStatus === 'void') {
            throw new Error('Cannot apply credit note to a voided invoice');
          }
        }

        const counterSnap = await tx.get(counterRef);
        let currentSeq = 0;
        if (counterSnap.exists) {
          currentSeq = counterSnap.data()?.lastNumber || 0;
        }

        // ─────────────────────────────────────────────────────────────────────
        // PHASE 2: CALCULATIONS
        // ─────────────────────────────────────────────────────────────────────
        const nextSeq = currentSeq + 1;
        const paddedNumber = String(nextSeq).padStart(6, '0');
        const creditNoteNumber = `CRN-${year}-${paddedNumber}`;

        let appliedToInvoiceAmount = 0;
        let creditedToAccountAmount = cleanAmount;

        if (invData) {
          const invoiceDue = Math.max(0, Number(invData.balanceDue ?? invData.totalPayable ?? 0));
          appliedToInvoiceAmount = Math.min(cleanAmount, invoiceDue);
          creditedToAccountAmount = Math.round((cleanAmount - appliedToInvoiceAmount) * 100) / 100;
        }

        const currentBalance = Number(accountData.currentBalance || 0);
        const curCredit = Number(accountData.availableCredit || 0);

        const newBalance = Math.round((currentBalance - cleanAmount) * 100) / 100;
        const newAvailableCredit = Math.round((curCredit + creditedToAccountAmount) * 100) / 100;

        // ─────────────────────────────────────────────────────────────────────
        // PHASE 3: ALL WRITES AFTER READS
        // ─────────────────────────────────────────────────────────────────────

        // 1. Update Sequence Counter
        tx.set(
          counterRef,
          {
            workspaceId,
            year,
            prefix: 'CRN',
            lastNumber: nextSeq,
            updatedAt: timestamp,
          },
          { merge: true }
        );

        // 2. Post Sub-Ledger Transaction
        const transactionDocRef = adminDb.collection('financial_transactions').doc();
        const transactionData: Omit<FinancialTransaction, 'id'> = {
          organizationId: accountData.organizationId || organizationId,
          workspaceId,
          accountId,
          entityId: accountData.entityId,
          transactionType: 'credit_note',
          referenceType: 'credit_note',
          referenceId: '', // populated after
          referenceNumber: creditNoteNumber,
          debit: 0,
          credit: cleanAmount,
          currency: accountData.currency || 'GHS',
          balanceAfter: newBalance,
          effectiveAt: timestamp,
          source: 'user',
          createdBy: userId,
          description: `Credit Note ${creditNoteNumber} issued (${reason}). ${invData ? `Applied to ${invData.invoiceNumber}` : ''}`,
          metadata: {
            reason,
            reasonDetails: reasonDetails || '',
            appliedToInvoiceAmount,
            creditedToAccountAmount,
            invoiceId: invData?.id || null,
          },
          createdAt: timestamp,
        };

        // 3. Create Credit Note Document
        const crnDocRef = adminDb.collection('credit_notes').doc();
        transactionData.referenceId = crnDocRef.id;
        tx.set(transactionDocRef, transactionData);

        const creditNoteData: Omit<CreditNote, 'id'> = {
          organizationId: accountData.organizationId || organizationId,
          workspaceIds: [workspaceId],
          creditNoteNumber,
          accountId,
          entityId: accountData.entityId,
          entityName: accountData.accountName,
          invoiceId: invData?.id || undefined,
          invoiceNumber: invData?.invoiceNumber || undefined,
          amount: cleanAmount,
          currency: accountData.currency || 'GHS',
          reason,
          reasonDetails: reasonDetails || undefined,
          status: 'applied',
          appliedToInvoiceAmount,
          creditedToAccountAmount,
          ledgerTransactionId: transactionDocRef.id,
          createdBy: userId,
          issuedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        tx.set(crnDocRef, creditNoteData);

        createdCreditNote = { id: crnDocRef.id, ...creditNoteData };

        // 4. Update Financial Account Balance
        tx.update(accountRef, {
          currentBalance: newBalance,
          totalOutstanding: Math.max(0, newBalance),
          availableCredit: newAvailableCredit,
          updatedAt: timestamp,
        });

        // 5. Update Invoice (if linked)
        if (invRef && invData) {
          const prevBalanceDue = Math.max(0, Number(invData.balanceDue ?? invData.totalPayable ?? 0));
          const newBalanceDue = Math.max(0, Math.round((prevBalanceDue - appliedToInvoiceAmount) * 100) / 100);
          const newAmountCredited = Math.round(((Number(invData.amountCredited) || 0) + appliedToInvoiceAmount) * 100) / 100;
          const totalPaid = Number(invData.amountPaid || 0);
          const totalSettled = totalPaid + newAmountCredited;

          const paymentStatus = newBalanceDue <= 0 ? 'paid' : totalSettled > 0 ? 'partially_paid' : 'unpaid';

          tx.update(invRef, {
            balanceDue: newBalanceDue,
            amountCredited: newAmountCredited,
            paymentStatus,
            updatedAt: timestamp,
          });
        }
      });

      // 6. Log CRM Activity
      if (createdCreditNote) {
        await logActivity({
          userId,
          organizationId,
          workspaceId,
          type: 'status_change',
          source: 'finance_engine',
          description: `Issued credit note ${(createdCreditNote as CreditNote).creditNoteNumber} for ${(createdCreditNote as CreditNote).currency} ${(createdCreditNote as CreditNote).amount}`,
          entityId: (createdCreditNote as CreditNote).entityId,
          metadata: {
            event: 'credit_note.issued',
            creditNoteId: (createdCreditNote as CreditNote).id,
            creditNoteNumber: (createdCreditNote as CreditNote).creditNoteNumber,
            amount: (createdCreditNote as CreditNote).amount,
          },
        });
      }

      return { success: true, creditNote: createdCreditNote || undefined };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to issue credit note';
      console.error('[CREDIT_NOTE_SERVICE] Error:', msg);
      return { success: false, error: msg };
    }
  }
}
