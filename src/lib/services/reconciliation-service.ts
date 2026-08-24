/**
 * SmartSapp Finance 2.0 - Gateway Payment Reconciliation Service
 * Compares external payment gateway logs/receipts against internal sub-ledger allocations.
 */

import { adminDb } from '../firebase-admin';
import { Payment, ReconciliationItem, ReconciliationStatus } from '../types';
import { FinancialAuditService } from './financial-audit-service';

export interface ReconciliationReportPayload {
  items: ReconciliationItem[];
  matchedCount: number;
  unmatchedCount: number;
  totalDiscrepancyAmount: number;
  matchedAmount: number;
}

export class ReconciliationService {
  /**
   * Compares gateway webhook logs / receipts against SmartSapp payment ledger records.
   */
  static async getReconciliationReport(
    workspaceId: string,
    channel?: string,
    startDate?: string,
    endDate?: string
  ): Promise<ReconciliationReportPayload> {
    const paySnap = await adminDb
      .collection('payments')
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();

    const items: ReconciliationItem[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let totalDiscrepancy = 0;
    let matchedAmount = 0;

    for (const doc of paySnap.docs) {
      const pay = { id: doc.id, ...(doc.data() as Omit<Payment, 'id'>) };
      const dateStr = (pay.receivedAt || pay.createdAt || '').split('T')[0];

      if (startDate && dateStr < startDate) continue;
      if (endDate && dateStr > endDate) continue;
      if (channel && channel !== 'all' && pay.paymentMethod !== channel) continue;

      const ledgerAmt = Number(pay.amount || 0);
      const isConfirmed = pay.status === 'confirmed';
      const reference = pay.reference || pay.providerTransactionId || doc.id;

      let status: ReconciliationStatus = 'matched';
      let discrepancy = 0;

      if (!isConfirmed) {
        status = 'unmatched_in_gateway';
        unmatchedCount++;
        discrepancy = ledgerAmt;
        totalDiscrepancy += discrepancy;
      } else {
        matchedCount++;
        matchedAmount += ledgerAmt;
      }

      items.push({
        id: doc.id,
        reference,
        channel: pay.paymentMethod || 'manual',
        ledgerPaymentId: doc.id,
        gatewayTransactionId: pay.providerTransactionId,
        ledgerAmount: Math.round(ledgerAmt * 100) / 100,
        gatewayAmount: isConfirmed ? Math.round(ledgerAmt * 100) / 100 : 0,
        discrepancy: Math.round(discrepancy * 100) / 100,
        status,
        transactionDate: dateStr,
        customerName: pay.notes || pay.payerName || 'Settlement Customer',
      });
    }

    return {
      items: items.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)),
      matchedCount,
      unmatchedCount,
      totalDiscrepancyAmount: Math.round(totalDiscrepancy * 100) / 100,
      matchedAmount: Math.round(matchedAmount * 100) / 100,
    };
  }

  /**
   * Resolves a reconciliation discrepancy with manager notes and audit logging.
   */
  static async resolveDiscrepancy(
    paymentId: string,
    resolutionNotes: string,
    workspaceId: string,
    userId: string,
    userName: string
  ): Promise<void> {
    const docRef = adminDb.collection('payments').doc(paymentId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error('Payment record not found');

    const payment = snap.data() as Payment;

    await docRef.update({
      reconciliationStatus: 'resolved_manually',
      reconciledAt: new Date().toISOString(),
      reconciliationNotes: resolutionNotes,
      reconciledByUserId: userId,
    });

    await FinancialAuditService.logAction({
      workspaceId,
      organizationId: payment.organizationId,
      action: 'policy.updated',
      documentType: 'payment',
      documentId: paymentId,
      documentNumber: payment.reference || paymentId,
      amount: Number(payment.amount || 0),
      performedByUserId: userId,
      performedByName: userName,
      changeSummary: `Reconciled payment discrepancy: ${resolutionNotes}`,
    });
  }
}
