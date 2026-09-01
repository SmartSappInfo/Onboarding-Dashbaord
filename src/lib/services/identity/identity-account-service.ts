/**
 * @fileOverview Identity Account Service (Identity & Access 2.0)
 *
 * Manages low-level authentication identities, credentials state, and session invalidation
 * for the `accounts` collection in Firestore.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Accounts directly map 1:1 to Firebase Authentication UIDs.
 * - This service handles identity statuses (pending, active, suspended, disabled, locked).
 * - When an account status is set to 'suspended', 'disabled', or 'deleted',
 *   `adminAuth.revokeRefreshTokens(uid)` MUST be invoked to prevent stale JWT access.
 * - Zero `any` or `any[]` typing.
 *
 * @testability Exported pure methods and service functions are tested in `identity-services.test.ts`.
 */

import { adminDb, adminAuth } from '@/lib/firebase-admin';
import type { IdentityAccount, AccountStatus, AuthProviderType } from '@/lib/types';

export class IdentityAccountService {
  private static COLLECTION = 'accounts';

  /**
   * Retrieves an account document by its unique UID.
   */
  static async getAccount(uid: string): Promise<IdentityAccount | null> {
    if (!uid) return null;
    const snap = await adminDb.collection(this.COLLECTION).doc(uid).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() } as IdentityAccount;
  }

  /**
   * Creates or initializes an IdentityAccount document.
   * Supports optional external Firestore transaction/batch for atomicity.
   */
  static async createAccount(
    account: Omit<IdentityAccount, 'createdAt' | 'updatedAt'>,
    batchOrTransaction?: FirebaseFirestore.WriteBatch | FirebaseFirestore.Transaction
  ): Promise<IdentityAccount> {
    const now = new Date().toISOString();
    const completeAccount: IdentityAccount = {
      ...account,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = adminDb.collection(this.COLLECTION).doc(account.id);

    if (batchOrTransaction) {
      if ('set' in batchOrTransaction && typeof batchOrTransaction.set === 'function') {
        // Handle Transaction or WriteBatch
        (batchOrTransaction as FirebaseFirestore.WriteBatch).set(docRef, completeAccount, { merge: true });
      }
    } else {
      await docRef.set(completeAccount, { merge: true });
    }

    return completeAccount;
  }

  /**
   * Updates an account's status (active, suspended, disabled, locked).
   * Automatically triggers session revocation if the status is non-active.
   */
  static async updateAccountStatus(
    uid: string,
    status: AccountStatus,
    batchOrTransaction?: FirebaseFirestore.WriteBatch | FirebaseFirestore.Transaction
  ): Promise<void> {
    const now = new Date().toISOString();
    const docRef = adminDb.collection(this.COLLECTION).doc(uid);

    const updatePayload: Partial<IdentityAccount> = {
      status,
      updatedAt: now,
    };

    if (batchOrTransaction) {
      (batchOrTransaction as FirebaseFirestore.WriteBatch).update(docRef, updatePayload);
    } else {
      await docRef.update(updatePayload);
    }

    // Security revocation: if account is suspended or disabled, immediately revoke active JWT sessions
    if (status === 'suspended' || status === 'disabled' || status === 'locked' || status === 'deleted') {
      try {
        await adminAuth.revokeRefreshTokens(uid);
      } catch (authErr: unknown) {
        const msg = authErr instanceof Error ? authErr.message : 'Unknown auth error';
        console.warn(`[IdentityAccountService] Failed to revoke refresh tokens for ${uid}:`, msg);
      }
    }
  }

  /**
   * Updates the last seen and last login timestamps for an account.
   */
  static async recordActivity(uid: string, isLogin: boolean = false): Promise<void> {
    const now = new Date().toISOString();
    const docRef = adminDb.collection(this.COLLECTION).doc(uid);
    const updateData: Partial<IdentityAccount> = {
      lastSeenAt: now,
      updatedAt: now,
    };
    if (isLogin) {
      updateData.lastLoginAt = now;
    }
    try {
      await docRef.set(updateData, { merge: true });
    } catch (err: unknown) {
      console.warn(`[IdentityAccountService] Failed to record activity for ${uid}:`, err);
    }
  }
}
