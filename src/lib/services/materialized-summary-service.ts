/**
 * SmartSapp Finance 2.0 - Materialized Financial Summary Service
 * High-scale caching engine maintaining O(1) workspace and account summaries.
 */

import { adminDb } from '../firebase-admin';
import { WorkspaceFinancialSummary, Invoice, Payment, FinancialAccount } from '../types';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import { AgingService } from './aging-service';

export class MaterializedSummaryService {
  /**
   * Retrieves the materialized workspace financial summary document in O(1) constant time.
   */
  static async getWorkspaceSummary(workspaceId: string): Promise<WorkspaceFinancialSummary | null> {
    const docRef = adminDb.collection('workspace_financial_summaries').doc(workspaceId);
    const snap = await docRef.get();

    if (snap.exists) {
      return { id: snap.id, ...(snap.data() as Omit<WorkspaceFinancialSummary, 'id'>) };
    }

    return null;
  }

  /**
   * Performs an atomic incremental update on the workspace summary inside a Firestore transaction.
   */
  static async incrementWorkspaceSummaryInTx(
    tx: Transaction,
    workspaceId: string,
    deltas: {
      billedDelta?: number;
      collectedDelta?: number;
      arDelta?: number;
      atRiskDelta?: number;
      invoicesCountDelta?: number;
      paidInvoicesCountDelta?: number;
    }
  ): Promise<void> {
    const docRef = adminDb.collection('workspace_financial_summaries').doc(workspaceId);
    const timestamp = new Date().toISOString();

    const updates: Record<string, unknown> = {
      lastUpdatedAt: timestamp,
    };

    if (deltas.billedDelta) updates.totalBilledRevenue = FieldValue.increment(deltas.billedDelta);
    if (deltas.collectedDelta) updates.totalCollectedRevenue = FieldValue.increment(deltas.collectedDelta);
    if (deltas.arDelta) updates.totalOutstandingAR = FieldValue.increment(deltas.arDelta);
    if (deltas.atRiskDelta) updates.totalAtRiskDebt = FieldValue.increment(deltas.atRiskDelta);
    if (deltas.invoicesCountDelta) updates.invoicesCount = FieldValue.increment(deltas.invoicesCountDelta);
    if (deltas.paidInvoicesCountDelta) updates.paidInvoicesCount = FieldValue.increment(deltas.paidInvoicesCountDelta);

    tx.set(docRef, updates, { merge: true });
  }

  /**
   * Recalibrates and self-heals the entire materialized workspace summary from authoritative live ledger documents.
   */
  static async recalibrateWorkspaceSummary(workspaceId: string): Promise<WorkspaceFinancialSummary> {
    const [invSnap, paySnap, accSnap] = await Promise.all([
      adminDb.collection('invoices').where('workspaceIds', 'array-contains', workspaceId).get(),
      adminDb.collection('payments').where('workspaceIds', 'array-contains', workspaceId).get(),
      adminDb.collection('financial_accounts').where('workspaceId', '==', workspaceId).get(),
    ]);

    const now = new Date();
    let totalBilled = 0;
    let totalCollected = 0;
    let totalAR = 0;
    let totalAtRisk = 0;
    let invoicesCount = 0;
    let paidInvoicesCount = 0;

    for (const doc of invSnap.docs) {
      const inv = doc.data() as Invoice;
      if (inv.status === 'void' || inv.status === 'draft') continue;

      invoicesCount++;
      const payable = Number(inv.totalPayable || 0);
      const paid = Number(inv.amountPaid || 0);
      const bal = Number(inv.balanceDue ?? (payable - paid));

      totalBilled += payable;
      if (inv.status === 'paid' || bal <= 0) {
        paidInvoicesCount++;
      }

      if (bal > 0) {
        totalAR += bal;
        const aging = AgingService.calculateInvoiceAging(inv, now);
        if (aging.bucket === '61_90' || aging.bucket === '90_plus') {
          totalAtRisk += bal;
        }
      }
    }

    for (const doc of paySnap.docs) {
      const pay = doc.data() as Payment;
      if (pay.status && pay.status !== 'confirmed') continue;
      totalCollected += Number(pay.amount || 0);
    }

    let debtorsCount = 0;
    for (const doc of accSnap.docs) {
      const acc = doc.data() as FinancialAccount;
      if (Number(acc.currentBalance || 0) > 0) {
        debtorsCount++;
      }
    }

    const summary: WorkspaceFinancialSummary = {
      workspaceId,
      organizationId: 'default',
      totalBilledRevenue: Math.round(totalBilled * 100) / 100,
      totalCollectedRevenue: Math.round(totalCollected * 100) / 100,
      totalOutstandingAR: Math.round(totalAR * 100) / 100,
      totalAtRiskDebt: Math.round(totalAtRisk * 100) / 100,
      invoicesCount,
      paidInvoicesCount,
      debtorsCount,
      lastUpdatedAt: now.toISOString(),
    };

    await adminDb.collection('workspace_financial_summaries').doc(workspaceId).set(summary, { merge: true });
    return summary;
  }
}
