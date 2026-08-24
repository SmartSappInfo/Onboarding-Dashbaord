/**
 * SmartSapp Finance 2.0 - Financial Ledger Service
 * Immutable, Append-Only Sub-Ledger for all monetary debits and credits.
 * 
 * Invariants:
 * 1. Transactions are NEVER deleted or mutated once written.
 * 2. Errors are corrected via compensating reversal transactions.
 * 3. Every transaction updates the associated FinancialAccount materialized balance atomically.
 * 4. Float operations are strictly rounded using Math.round(val * 100) / 100.
 */

import { adminDb } from '../firebase-admin';
import { FinancialTransaction, FinancialTransactionType, FinancialTransactionSource } from '../types';

export interface PostTransactionParams {
  organizationId: string;
  workspaceId: string;
  accountId: string;
  entityId: string;
  transactionType: FinancialTransactionType;
  referenceType: 'invoice' | 'payment' | 'credit_note' | 'debit_note' | 'adjustment' | 'manual';
  referenceId: string;
  referenceNumber?: string;
  debit: number;
  credit: number;
  currency: string;
  source: FinancialTransactionSource;
  createdBy?: string;
  description?: string;
  effectiveAt?: string;
  metadata?: Record<string, unknown>;
}

export class LedgerService {
  /**
   * Posts an append-only ledger transaction inside an active Firestore transaction,
   * updating the account's materialized balances atomically.
   */
  static async postTransactionInTx(
    tx: FirebaseFirestore.Transaction,
    params: PostTransactionParams
  ): Promise<FinancialTransaction> {
    const accountRef = adminDb.collection('financial_accounts').doc(params.accountId);
    const accountSnap = await tx.get(accountRef);

    if (!accountSnap.exists) {
      throw new Error(`Financial account ${params.accountId} does not exist`);
    }

    const accountData = accountSnap.data() || {};
    const currentBalance = Number(accountData.currentBalance || 0);
    const totalInvoiced = Number(accountData.totalInvoiced || 0);
    const totalPaid = Number(accountData.totalPaid || 0);
    const availableCredit = Number(accountData.availableCredit || 0);

    const debit = Math.round((Number(params.debit) || 0) * 100) / 100;
    const credit = Math.round((Number(params.credit) || 0) * 100) / 100;

    // Calculate new balance: Balance increases with Debits, decreases with Credits
    const netDelta = debit - credit;
    const newBalance = Math.round((currentBalance + netDelta) * 100) / 100;

    const newTotalInvoiced = params.transactionType === 'invoice_issued'
      ? Math.round((totalInvoiced + debit) * 100) / 100
      : totalInvoiced;

    const newTotalPaid = params.transactionType === 'payment_received' || params.transactionType === 'payment_allocated'
      ? Math.round((totalPaid + credit) * 100) / 100
      : totalPaid;

    const timestamp = new Date().toISOString();
    const effectiveAt = params.effectiveAt || timestamp;

    const transactionDocRef = adminDb.collection('financial_transactions').doc();
    const transactionData: Omit<FinancialTransaction, 'id'> = {
      organizationId: params.organizationId,
      workspaceId: params.workspaceId,
      accountId: params.accountId,
      entityId: params.entityId,
      transactionType: params.transactionType,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      referenceNumber: params.referenceNumber,
      debit,
      credit,
      currency: params.currency || 'GHS',
      balanceAfter: newBalance,
      effectiveAt,
      source: params.source,
      createdBy: params.createdBy,
      description: params.description,
      metadata: params.metadata || {},
      createdAt: timestamp,
    };

    // 1. Write the immutable transaction record
    tx.set(transactionDocRef, transactionData);

    // 2. Update the materialized account state
    tx.update(accountRef, {
      currentBalance: newBalance,
      totalOutstanding: Math.max(0, newBalance),
      totalInvoiced: newTotalInvoiced,
      totalPaid: newTotalPaid,
      availableCredit: availableCredit,
      updatedAt: timestamp,
    });

    return { id: transactionDocRef.id, ...transactionData };
  }

  /**
   * Posts an append-only ledger transaction within its own atomic transaction.
   */
  static async postTransaction(params: PostTransactionParams): Promise<FinancialTransaction> {
    return await adminDb.runTransaction(async (tx) => {
      return await this.postTransactionInTx(tx, params);
    });
  }

  /**
   * Retrieves the chronological ledger transaction history for an account.
   */
  static async getAccountLedger(
    accountId: string, 
    _workspaceId: string, 
    limitCount = 50
  ): Promise<FinancialTransaction[]> {
    const snap = await adminDb.collection('financial_transactions')
      .where('accountId', '==', accountId)
      .orderBy('effectiveAt', 'desc')
      .limit(limitCount)
      .get();

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<FinancialTransaction, 'id'>),
    }));
  }

  /**
   * Creates a compensating reversal transaction for an erroneous entry.
   * NEVER deletes the original entry.
   */
  static async reverseTransaction(
    transactionId: string, 
    reason: string, 
    actorId: string
  ): Promise<FinancialTransaction> {
    return await adminDb.runTransaction(async (tx) => {
      const origRef = adminDb.collection('financial_transactions').doc(transactionId);
      const origSnap = await tx.get(origRef);

      if (!origSnap.exists) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      const origData = origSnap.data() as FinancialTransaction;

      // Compensating inversion: Swaps debit and credit
      const reversalDebit = origData.credit;
      const reversalCredit = origData.debit;

      return await this.postTransactionInTx(tx, {
        organizationId: origData.organizationId,
        workspaceId: origData.workspaceId,
        accountId: origData.accountId,
        entityId: origData.entityId,
        transactionType: 'reversal',
        referenceType: origData.referenceType,
        referenceId: origData.referenceId,
        referenceNumber: origData.referenceNumber,
        debit: reversalDebit,
        credit: reversalCredit,
        currency: origData.currency,
        source: 'user',
        createdBy: actorId,
        description: `Reversal of txn ${transactionId}: ${reason}`,
        metadata: { originalTransactionId: transactionId, reason },
      });
    });
  }
}
