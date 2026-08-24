/**
 * SmartSapp Finance 2.0 - Credit & Debit Note Sequence Allocator
 * High-concurrency, fiscal-year-aware sequential number allocator.
 * Formats: CRN-YYYY-XXXXXX (Credit Note), DBN-YYYY-XXXXXX (Debit Note)
 * 
 * Invariants:
 * 1. Sequential numbering is strictly atomic using Firestore transactions.
 * 2. Scoped by workspace and fiscal year.
 * 3. Never reuse sequence numbers.
 */

import { adminDb } from '../firebase-admin';

export class CreditNoteSequenceService {
  /**
   * Generates next sequential credit/debit note number.
   */
  static async getNextNumber(
    workspaceId: string,
    prefix: 'CRN' | 'DBN' = 'CRN',
    fiscalYear?: number
  ): Promise<string> {
    const year = fiscalYear || new Date().getFullYear();
    const counterDocId = `${prefix.toLowerCase()}_seq_${workspaceId}_${year}`;
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
   * Allocates the next sequential number inside an existing Firestore transaction.
   */
  static async getNextNumberInTx(
    tx: FirebaseFirestore.Transaction,
    workspaceId: string,
    prefix: 'CRN' | 'DBN' = 'CRN',
    fiscalYear?: number
  ): Promise<string> {
    const year = fiscalYear || new Date().getFullYear();
    const counterDocId = `${prefix.toLowerCase()}_seq_${workspaceId}_${year}`;
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
