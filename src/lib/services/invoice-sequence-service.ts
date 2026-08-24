/**
 * SmartSapp Finance 2.0 - Invoice Sequence Allocator
 * High-concurrency, fiscal-year-aware sequential invoice numbering.
 * Format: INV-YYYY-XXXXXX (e.g. INV-2026-000001)
 * 
 * Invariants:
 * 1. Sequential numbering is strictly atomic using Firestore transactions.
 * 2. Numbers are workspace-scoped and fiscal-year-scoped.
 * 3. Never reuse sequence numbers.
 */

import { adminDb } from '../firebase-admin';

export class InvoiceSequenceService {
  /**
   * Generates next sequential official invoice number within an active Firestore transaction
   * or a newly created transaction.
   */
  static async getNextInvoiceNumber(
    workspaceId: string,
    prefix: string = 'INV',
    fiscalYear?: number
  ): Promise<string> {
    const year = fiscalYear || new Date().getFullYear();
    const counterDocId = `invoice_seq_${workspaceId}_${year}`;
    const counterRef = adminDb.collection('system_counters').doc(counterDocId);

    const nextSeq = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      let current = 0;
      if (snap.exists) {
        current = snap.data()?.lastNumber || 0;
      }
      const next = current + 1;
      tx.set(
        counterRef,
        {
          workspaceId,
          year,
          prefix,
          lastNumber: next,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return next;
    });

    const paddedNumber = String(nextSeq).padStart(6, '0');
    return `${prefix}-${year}-${paddedNumber}`;
  }

  /**
   * Allocates the next invoice number inside an existing Firestore transaction.
   */
  static async getNextInvoiceNumberInTx(
    tx: FirebaseFirestore.Transaction,
    workspaceId: string,
    prefix: string = 'INV',
    fiscalYear?: number
  ): Promise<string> {
    const year = fiscalYear || new Date().getFullYear();
    const counterDocId = `invoice_seq_${workspaceId}_${year}`;
    const counterRef = adminDb.collection('system_counters').doc(counterDocId);

    const snap = await tx.get(counterRef);
    let current = 0;
    if (snap.exists) {
      current = snap.data()?.lastNumber || 0;
    }
    const next = current + 1;
    tx.set(
      counterRef,
      {
        workspaceId,
        year,
        prefix,
        lastNumber: next,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const paddedNumber = String(next).padStart(6, '0');
    return `${prefix}-${year}-${paddedNumber}`;
  }
}
