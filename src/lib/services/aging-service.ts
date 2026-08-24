/**
 * SmartSapp Finance 2.0 - Dynamic Aging Engine
 * Computes accounts receivable aging buckets on-the-fly from live invoice due dates.
 * 
 * Invariants:
 * 1. Aging is NEVER persisted as stale tags; it is dynamically calculated from (now - dueDate).
 * 2. Buckets: current (0 days), 1-30, 31-60, 61-90, 90+ days.
 * 3. All monetary calculations round to 2 decimal places with Math.round(val * 100) / 100.
 */

import { adminDb } from '../firebase-admin';
import { Invoice, AgingBucket, AgingSummary, FinancialAccount } from '../types';

export interface InvoiceAgingResult {
  invoiceId: string;
  invoiceNumber: string;
  entityId: string;
  entityName: string;
  balanceDue: number;
  dueDate: string;
  daysOverdue: number;
  bucket: AgingBucket;
}

export interface AccountAgingProfile {
  accountId: string;
  accountNumber: string;
  entityId: string;
  entityName: string;
  totalOutstanding: number;
  currentBalance: number;
  oldestInvoiceDays: number;
  primaryBucket: AgingBucket;
  riskLevel: 'low' | 'medium' | 'high';
  agingBreakdown: {
    current: number;
    days1_30: number;
    days31_60: number;
    days61_90: number;
    days90Plus: number;
  };
  openInvoices: InvoiceAgingResult[];
}

export class AgingService {
  /**
   * Calculates dynamic aging bucket for a single invoice.
   */
  static calculateInvoiceAging(invoice: Invoice, asOfDate: Date = new Date()): InvoiceAgingResult {
    const dueDateStr = invoice.issuedAt || invoice.createdAt; // fallback if no explicit paymentDueDate
    const dueDate = new Date(dueDateStr);
    const diffMs = asOfDate.getTime() - dueDate.getTime();
    const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    let bucket: AgingBucket = 'current';
    if (daysOverdue > 90) {
      bucket = '90_plus';
    } else if (daysOverdue > 60) {
      bucket = '61_90';
    } else if (daysOverdue > 30) {
      bucket = '31_60';
    } else if (daysOverdue > 0) {
      bucket = '1_30';
    }

    const balanceDue = Math.max(0, Math.round((Number(invoice.balanceDue ?? invoice.totalPayable ?? 0)) * 100) / 100);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      entityId: invoice.entityId || '',
      entityName: invoice.entityName || 'Organization',
      balanceDue,
      dueDate: dueDateStr,
      daysOverdue,
      bucket,
    };
  }

  /**
   * Computes workspace-wide aging summary across all unpaid invoices.
   */
  static async calculateWorkspaceAgingSummary(workspaceId: string): Promise<AgingSummary> {
    const snap = await adminDb
      .collection('invoices')
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();

    const summary: AgingSummary = {
      totalReceivables: 0,
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
      accountCount: 0,
      invoiceCount: 0,
    };

    const uniqueAccounts = new Set<string>();
    const now = new Date();

    for (const doc of snap.docs) {
      const inv = { id: doc.id, ...(doc.data() as Omit<Invoice, 'id'>) };

      // Exclude void, draft, and paid invoices
      if (
        inv.status === 'void' ||
        inv.lifecycleStatus === 'void' ||
        inv.status === 'draft' ||
        inv.status === 'paid' ||
        (inv.balanceDue !== undefined && inv.balanceDue <= 0)
      ) {
        continue;
      }

      const aging = this.calculateInvoiceAging(inv, now);
      if (aging.balanceDue <= 0) continue;

      summary.totalReceivables = Math.round((summary.totalReceivables + aging.balanceDue) * 100) / 100;
      summary.invoiceCount++;

      if (inv.accountId) {
        uniqueAccounts.add(inv.accountId);
      } else if (inv.entityId) {
        uniqueAccounts.add(inv.entityId);
      }

      switch (aging.bucket) {
        case 'current':
          summary.current = Math.round((summary.current + aging.balanceDue) * 100) / 100;
          break;
        case '1_30':
          summary.days1_30 = Math.round((summary.days1_30 + aging.balanceDue) * 100) / 100;
          break;
        case '31_60':
          summary.days31_60 = Math.round((summary.days31_60 + aging.balanceDue) * 100) / 100;
          break;
        case '61_90':
          summary.days61_90 = Math.round((summary.days61_90 + aging.balanceDue) * 100) / 100;
          break;
        case '90_plus':
          summary.days90Plus = Math.round((summary.days90Plus + aging.balanceDue) * 100) / 100;
          break;
      }
    }

    summary.accountCount = uniqueAccounts.size;
    return summary;
  }

  /**
   * Retrieves an account's aging receivables profile.
   */
  static async getAccountReceivablesProfile(accountId: string): Promise<AccountAgingProfile | null> {
    const accSnap = await adminDb.collection('financial_accounts').doc(accountId).get();
    if (!accSnap.exists) {
      return null;
    }
    const account = { id: accSnap.id, ...(accSnap.data() as Omit<FinancialAccount, 'id'>) };

    const invSnap = await adminDb
      .collection('invoices')
      .where('accountId', '==', accountId)
      .get();

    const openInvoices: InvoiceAgingResult[] = [];
    let oldestDays = 0;
    const breakdown = {
      current: 0,
      days1_30: 0,
      days31_60: 0,
      days61_90: 0,
      days90Plus: 0,
    };

    const now = new Date();

    for (const doc of invSnap.docs) {
      const inv = { id: doc.id, ...(doc.data() as Omit<Invoice, 'id'>) };
      if (
        inv.status === 'void' ||
        inv.lifecycleStatus === 'void' ||
        inv.status === 'draft' ||
        inv.status === 'paid' ||
        (inv.balanceDue !== undefined && inv.balanceDue <= 0)
      ) {
        continue;
      }

      const aging = this.calculateInvoiceAging(inv, now);
      if (aging.balanceDue <= 0) continue;

      openInvoices.push(aging);
      if (aging.daysOverdue > oldestDays) {
        oldestDays = aging.daysOverdue;
      }

      switch (aging.bucket) {
        case 'current':
          breakdown.current = Math.round((breakdown.current + aging.balanceDue) * 100) / 100;
          break;
        case '1_30':
          breakdown.days1_30 = Math.round((breakdown.days1_30 + aging.balanceDue) * 100) / 100;
          break;
        case '31_60':
          breakdown.days31_60 = Math.round((breakdown.days31_60 + aging.balanceDue) * 100) / 100;
          break;
        case '61_90':
          breakdown.days61_90 = Math.round((breakdown.days61_90 + aging.balanceDue) * 100) / 100;
          break;
        case '90_plus':
          breakdown.days90Plus = Math.round((breakdown.days90Plus + aging.balanceDue) * 100) / 100;
          break;
      }
    }

    let primaryBucket: AgingBucket = 'current';
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    if (breakdown.days90Plus > 0) {
      primaryBucket = '90_plus';
      riskLevel = 'high';
    } else if (breakdown.days61_90 > 0) {
      primaryBucket = '61_90';
      riskLevel = 'high';
    } else if (breakdown.days31_60 > 0) {
      primaryBucket = '31_60';
      riskLevel = 'medium';
    } else if (breakdown.days1_30 > 0) {
      primaryBucket = '1_30';
      riskLevel = 'medium';
    }

    return {
      accountId: account.id,
      accountNumber: account.accountNumber,
      entityId: account.entityId,
      entityName: account.accountName,
      totalOutstanding: Number(account.totalOutstanding || account.currentBalance || 0),
      currentBalance: Number(account.currentBalance || 0),
      oldestInvoiceDays: oldestDays,
      primaryBucket,
      riskLevel,
      agingBreakdown: breakdown,
      openInvoices,
    };
  }
}
