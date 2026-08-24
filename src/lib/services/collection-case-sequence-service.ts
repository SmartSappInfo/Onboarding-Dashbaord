/**
 * SmartSapp Finance 2.0 - Collection Case & Payment Plan Sequence Allocator
 * High-concurrency sequential number allocator using system_counters.
 * Formats: CAS-YYYY-XXXXXX (Collection Case), PLN-YYYY-XXXXXX (Payment Plan)
 * 
 * Invariants:
 * 1. Strict atomic incrementation via Firestore transactions.
 * 2. Scoped by workspace and fiscal year.
 * 3. Never reuse sequence numbers.
 */

import { adminDb } from '../firebase-admin';

export class CollectionCaseSequenceService {
  /**
   * Generates next sequential case or payment plan number.
   */
  static async getNextNumber(
    workspaceId: string,
    prefix: 'CAS' | 'PLN' = 'CAS',
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
}
