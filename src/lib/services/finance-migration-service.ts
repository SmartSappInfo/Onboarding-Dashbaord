/**
 * SmartSapp Finance 2.0 - Data Migration & Parity Service
 * Backward-compatibility migration engine transitioning legacy invoices and entities into the financial sub-ledger.
 */

import { adminDb } from '../firebase-admin';
import { 
  Invoice, 
  FinancialAccount, 
  FinancialTransaction, 
  MigrationParityResult, 
  MigrationProgressPayload 
} from '../types';
import { FinancialAccountService } from './financial-account-service';
import { MaterializedSummaryService } from './materialized-summary-service';
import { FinancialAuditService } from './financial-audit-service';

export class FinanceMigrationService {
  /**
   * Diagnoses legacy data health and computes the parity score.
   */
  static async runParityCheck(workspaceId: string): Promise<MigrationParityResult> {
    const [entSnap, accSnap, invSnap, txSnap] = await Promise.all([
      adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).get(),
      adminDb.collection('financial_accounts').where('workspaceId', '==', workspaceId).get(),
      adminDb.collection('invoices').where('workspaceIds', 'array-contains', workspaceId).get(),
      adminDb.collection('financial_transactions').where('workspaceIds', 'array-contains', workspaceId).get(),
    ]);

    const totalLegacyEntities = entSnap.size;
    const entitiesWithAccounts = accSnap.size;
    const unprovisionedEntitiesCount = Math.max(0, totalLegacyEntities - entitiesWithAccounts);

    const totalLegacyInvoices = invSnap.size;
    let invoicesWithLedgerDebit = 0;
    let balanceDiscrepanciesCount = 0;

    const txInvoiceIds = new Set<string>();
    for (const doc of txSnap.docs) {
      const tx = doc.data() as FinancialTransaction;
      if (tx.referenceType === 'invoice' && tx.referenceId) {
        txInvoiceIds.add(tx.referenceId);
      }
    }

    for (const doc of invSnap.docs) {
      const inv = doc.data() as Invoice;
      if (txInvoiceIds.has(doc.id) || inv.status === 'draft') {
        invoicesWithLedgerDebit++;
      }
    }

    const unmigratedInvoicesCount = Math.max(0, totalLegacyInvoices - invoicesWithLedgerDebit);

    // Calculate Parity Score (0-100%)
    const totalItems = totalLegacyEntities + totalLegacyInvoices;
    const migratedItems = entitiesWithAccounts + invoicesWithLedgerDebit;
    const parityScore = totalItems > 0 ? Math.round((migratedItems / totalItems) * 100) : 100;

    return {
      workspaceId,
      totalLegacyEntities,
      entitiesWithAccounts,
      unprovisionedEntitiesCount,
      totalLegacyInvoices,
      invoicesWithLedgerDebit,
      unmigratedInvoicesCount,
      parityScore,
      balanceDiscrepanciesCount,
    };
  }

  /**
   * Executes chunked sequential migration of legacy entities and invoices into the financial sub-ledger.
   */
  static async executeMigration(
    workspaceId: string,
    userId: string,
    userName: string
  ): Promise<MigrationProgressPayload> {
    const errors: string[] = [];
    let migratedEntities = 0;
    let migratedInvoices = 0;
    let reconciledBalanceCount = 0;

    // 1. Fetch entities without financial accounts
    const [entSnap, accSnap, invSnap] = await Promise.all([
      adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).get(),
      adminDb.collection('financial_accounts').where('workspaceId', '==', workspaceId).get(),
      adminDb.collection('invoices').where('workspaceIds', 'array-contains', workspaceId).get(),
    ]);

    const existingAccountEntityIds = new Set<string>();
    for (const doc of accSnap.docs) {
      const acc = doc.data() as FinancialAccount;
      if (acc.entityId) existingAccountEntityIds.add(acc.entityId);
    }

    // Step 1: Provision Financial Accounts for legacy entities
    for (const entDoc of entSnap.docs) {
      if (existingAccountEntityIds.has(entDoc.id)) continue;
      const data = entDoc.data();
      const entityName = data.name || data.companyName || 'Organization';

      try {
        await FinancialAccountService.getOrCreateFinancialAccount({
          entityId: entDoc.id,
          workspaceId,
          organizationId: data.organizationId || 'default',
          entityName,
          currency: 'GHS',
          actorId: userId,
        });
        migratedEntities++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown entity migration error';
        errors.push(`Entity ${entityName} (${entDoc.id}): ${msg}`);
      }
    }

    // Refresh accounts map
    const refreshedAccSnap = await adminDb.collection('financial_accounts').where('workspaceId', '==', workspaceId).get();
    const accountByEntityId = new Map<string, { id: string; account: FinancialAccount }>();
    for (const doc of refreshedAccSnap.docs) {
      const acc = doc.data() as FinancialAccount;
      if (acc.entityId) accountByEntityId.set(acc.entityId, { id: doc.id, account: acc });
    }

    // Step 2: Backfill Ledger Debit Transactions for Issued Invoices
    for (const invDoc of invSnap.docs) {
      const inv = { id: invDoc.id, ...(invDoc.data() as Omit<Invoice, 'id'>) };
      if (inv.status === 'draft' || inv.status === 'void') continue;

      const entityAcc = inv.entityId ? accountByEntityId.get(inv.entityId) : null;
      const targetAccountId = inv.accountId || entityAcc?.id;

      if (!targetAccountId) continue;

      const txId = `tx_migrated_inv_${inv.id}`;
      const txRef = adminDb.collection('financial_transactions').doc(txId);
      const existingTx = await txRef.get();

      if (!existingTx.exists) {
        const total = Number(inv.totalPayable || 0);
        const timestamp = inv.issuedAt || inv.createdAt || new Date().toISOString();

        const txData: Omit<FinancialTransaction, 'id'> = {
          accountId: targetAccountId,
          organizationId: inv.organizationId || 'default',
          workspaceId,
          entityId: inv.entityId || '',
          transactionType: 'invoice_issued',
          referenceType: 'invoice',
          referenceId: inv.id,
          referenceNumber: inv.invoiceNumber,
          debit: Math.round(total * 100) / 100,
          credit: 0,
          currency: inv.currency || 'GHS',
          balanceAfter: Math.round(total * 100) / 100,
          description: `Migrated debit for legacy invoice ${inv.invoiceNumber}`,
          source: 'migration',
          createdBy: userId,
          effectiveAt: timestamp,
          createdAt: timestamp,
        };

        await txRef.set(txData);
        migratedInvoices++;
      }
    }

    // Step 3: Recalibrate Account Balances
    for (const accEntry of Array.from(accountByEntityId.values())) {
      const accId = accEntry.id;
      let totalInv = 0;
      let totalPd = 0;

      for (const invDoc of invSnap.docs) {
        const inv = invDoc.data() as Invoice;
        if (inv.accountId === accId || (inv.entityId && inv.entityId === accEntry.account.entityId)) {
          if (inv.status !== 'void') {
            totalInv += Number(inv.totalPayable || 0);
            totalPd += Number(inv.amountPaid || 0);
          }
        }
      }

      const bal = Math.max(0, Math.round((totalInv - totalPd) * 100) / 100);
      await adminDb.collection('financial_accounts').doc(accId).update({
        currentBalance: bal,
        totalInvoiced: Math.round(totalInv * 100) / 100,
        totalPaid: Math.round(totalPd * 100) / 100,
      });
      reconciledBalanceCount++;
    }

    // Step 4: Recalibrate Materialized Workspace Summary
    await MaterializedSummaryService.recalibrateWorkspaceSummary(workspaceId);

    // Step 5: Audit Log
    await FinancialAuditService.logAction({
      workspaceId,
      action: 'policy.updated',
      documentType: 'policy',
      documentId: `migration_${workspaceId}`,
      performedByUserId: userId,
      performedByName: userName,
      changeSummary: `Executed full financial migration: ${migratedEntities} accounts provisioned, ${migratedInvoices} transactions backfilled, ${reconciledBalanceCount} balances reconciled.`,
    });

    return {
      totalEntities: entSnap.size,
      migratedEntities,
      totalInvoices: invSnap.size,
      migratedInvoices,
      reconciledBalanceCount,
      errors,
      isComplete: errors.length === 0,
    };
  }
}
