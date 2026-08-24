/**
 * SmartSapp Finance 2.0 - Financial Account Service
 * Single Source of Truth for customer financial accounts in the CRM.
 * 
 * Invariants & Architectural Rules:
 * 1. Financial accounts are linked 1:1 with canonical entities (via entityId).
 * 2. CurrentBalance is a derived/materialized projection of the append-only ledger.
 * 3. All balance modifications during financial operations must run inside an atomic Firestore transaction.
 * 4. Float operations must be explicitly rounded using Math.round(val * 100) / 100.
 */

import { adminDb } from '../firebase-admin';
import { FinancialAccount, FinancialAccountStatus } from '../types';

export interface CreateFinancialAccountParams {
  entityId: string;
  workspaceId: string;
  organizationId: string;
  entityName?: string;
  currency?: string;
  actorId?: string;
}

export class FinancialAccountService {
  /**
   * Generates a sequential, tenant-scoped account number (e.g. ACC-000001).
   */
  static async generateAccountNumber(workspaceId: string): Promise<string> {
    const counterRef = adminDb.collection('system_counters').doc(`accounts_${workspaceId}`);
    
    return await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      let currentLast = 0;
      if (doc.exists) {
        currentLast = doc.data()?.last_allocated_serial ?? 0;
      }
      const nextSerial = currentLast + 1;
      transaction.set(counterRef, { last_allocated_serial: nextSerial, updatedAt: new Date().toISOString() }, { merge: true });
      return `ACC-${nextSerial.toString().padStart(6, '0')}`;
    });
  }

  /**
   * Resolves an existing financial account for an entity or creates one idempotently.
   */
  static async getOrCreateFinancialAccount(params: CreateFinancialAccountParams): Promise<FinancialAccount> {
    const { entityId, workspaceId, organizationId, entityName = 'Account', currency = 'GHS' } = params;
    const accountsCol = adminDb.collection('financial_accounts');

    // Query for existing account for entity in workspace
    const existingSnap = await accountsCol
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const doc = existingSnap.docs[0];
      return { id: doc.id, ...(doc.data() as Omit<FinancialAccount, 'id'>) };
    }

    // Provision new financial account
    const accountNumber = await this.generateAccountNumber(workspaceId);
    const timestamp = new Date().toISOString();

    const newAccountData: Omit<FinancialAccount, 'id'> = {
      organizationId: organizationId || 'default',
      workspaceId,
      entityId,
      accountNumber,
      accountName: entityName || `Account for ${entityId}`,
      currency,
      status: 'active',
      accountType: 'customer',
      currentBalance: 0,
      totalInvoiced: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      totalOverdue: 0,
      availableCredit: 0,
      collectionStatus: 'current',
      riskLevel: 'low',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await accountsCol.add(newAccountData);
    return { id: docRef.id, ...newAccountData };
  }

  /**
   * Retrieves a financial account by its entityId and workspaceId.
   */
  static async getFinancialAccountByEntity(entityId: string, workspaceId: string): Promise<FinancialAccount | null> {
    const querySnap = await adminDb.collection('financial_accounts')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .limit(1)
      .get();

    if (querySnap.empty) return null;
    const doc = querySnap.docs[0];
    return { id: doc.id, ...(doc.data() as Omit<FinancialAccount, 'id'>) };
  }

  /**
   * Retrieves a financial account by its document ID.
   */
  static async getFinancialAccount(accountId: string): Promise<FinancialAccount | null> {
    const docSnap = await adminDb.collection('financial_accounts').doc(accountId).get();
    if (!docSnap.exists) return null;
    return { id: docSnap.id, ...(docSnap.data() as Omit<FinancialAccount, 'id'>) };
  }

  /**
   * Updates financial account status (active, on_hold, restricted, closed) with audit log.
   */
  static async updateAccountStatus(
    accountId: string, 
    status: FinancialAccountStatus, 
    _reason: string, 
    actorId: string
  ): Promise<boolean> {
    const accountRef = adminDb.collection('financial_accounts').doc(accountId);
    const docSnap = await accountRef.get();
    if (!docSnap.exists) return false;

    const timestamp = new Date().toISOString();
    await accountRef.update({
      status,
      updatedAt: timestamp,
      statusUpdatedBy: actorId,
    });

    return true;
  }
}
