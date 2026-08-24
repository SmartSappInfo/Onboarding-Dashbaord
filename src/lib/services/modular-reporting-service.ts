/**
 * SmartSapp Finance 2.0 - Modular Financial Reporting Service
 * Universal reporting engine powering Revenue, AR Aging, Collections, and Tax/VAT Audits.
 */

import { adminDb } from '../firebase-admin';
import { 
  Invoice, 
  FinancialAccount, 
  DateRangePreset, 
  ReportMetricItem 
} from '../types';
import { AgingService } from './aging-service';

export interface ReportPayload<TRow> {
  metrics: ReportMetricItem[];
  rows: TRow[];
  dateRangeLabel: string;
}

export interface RevenueReportRow {
  invoiceId: string;
  invoiceNumber: string;
  entityName: string;
  issuedDate: string;
  subtotal: number;
  discount: number;
  taxAmount: number;
  totalPayable: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  currency: string;
}

export interface AgingReportRow {
  accountId: string;
  accountNumber: string;
  entityName: string;
  currentAmount: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90_plus: number;
  totalBalance: number;
  riskLevel: string;
  currency: string;
}

export interface TaxAuditReportRow {
  invoiceId: string;
  invoiceNumber: string;
  entityName: string;
  issuedDate: string;
  grossAmount: number;
  vatRate: string;
  vatAmount: number;
  levyAmount: number;
  totalTax: number;
  currency: string;
}

export class ModularReportingService {
  /**
   * Resolves standard date presets into concrete ISO YYYY-MM-DD boundaries.
   */
  static resolveDateRange(
    preset: DateRangePreset,
    customStart?: string,
    customEnd?: string
  ): { startDate: string; endDate: string; label: string } {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    switch (preset) {
      case 'today':
        return { startDate: todayStr, endDate: todayStr, label: 'Today' };

      case 'this_week': {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: todayStr,
          label: 'This Week',
        };
      }

      case 'this_month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: todayStr,
          label: 'This Month',
        };
      }

      case 'last_month': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          label: 'Last Month',
        };
      }

      case 'this_quarter': {
        const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
        const start = new Date(now.getFullYear(), qStartMonth, 1);
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: todayStr,
          label: 'This Quarter',
        };
      }

      case 'this_year': {
        const start = new Date(now.getFullYear(), 0, 1);
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: todayStr,
          label: 'This Year',
        };
      }

      case 'custom':
      default:
        return {
          startDate: customStart || todayStr,
          endDate: customEnd || todayStr,
          label: `${customStart || todayStr} to ${customEnd || todayStr}`,
        };
    }
  }

  /**
   * Generates Revenue & Invoicing Report Data.
   */
  static async getRevenueReport(
    workspaceId: string,
    preset: DateRangePreset,
    customStart?: string,
    customEnd?: string
  ): Promise<ReportPayload<RevenueReportRow>> {
    const { startDate, endDate, label } = this.resolveDateRange(preset, customStart, customEnd);

    const invSnap = await adminDb
      .collection('invoices')
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();

    let totalBilled = 0;
    let totalCollected = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    const rows: RevenueReportRow[] = [];

    for (const doc of invSnap.docs) {
      const inv = doc.data() as Invoice;
      if (inv.status === 'void' || inv.status === 'draft') continue;

      const dateStr = (inv.issuedAt || inv.createdAt).split('T')[0];
      if (dateStr < startDate || dateStr > endDate) continue;

      const subtotal = Number(inv.subtotal || 0);
      const discount = Number(inv.discount || 0);
      const tax = Number((inv.vatAmount || 0) + (inv.levyAmount || 0));
      const total = Number(inv.totalPayable || 0);
      const paid = Number(inv.amountPaid || 0);
      const bal = Number(inv.balanceDue ?? (total - paid));

      totalBilled += total;
      totalCollected += paid;
      totalDiscount += discount;
      totalTax += tax;

      rows.push({
        invoiceId: doc.id,
        invoiceNumber: inv.invoiceNumber,
        entityName: inv.entityName || 'Customer',
        issuedDate: dateStr,
        subtotal: Math.round(subtotal * 100) / 100,
        discount: Math.round(discount * 100) / 100,
        taxAmount: Math.round(tax * 100) / 100,
        totalPayable: Math.round(total * 100) / 100,
        amountPaid: Math.round(paid * 100) / 100,
        balanceDue: Math.round(bal * 100) / 100,
        status: inv.status,
        currency: inv.currency || 'GHS',
      });
    }

    const metrics: ReportMetricItem[] = [
      {
        id: 'total_billed',
        label: 'Total Billed Revenue',
        value: `GHS ${Math.round(totalBilled * 100 / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        subtext: `${rows.length} invoices issued in period`,
        variant: 'default',
      },
      {
        id: 'total_collected',
        label: 'Realized Collections',
        value: `GHS ${Math.round(totalCollected * 100 / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        subtext: 'Cash settled against invoices',
        variant: 'success',
      },
      {
        id: 'total_tax',
        label: 'Tax & Levies Billed',
        value: `GHS ${Math.round(totalTax * 100 / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        subtext: 'VAT and statutory levies',
        variant: 'warning',
      },
      {
        id: 'total_discounts',
        label: 'Discounts Granted',
        value: `GHS ${Math.round(totalDiscount * 100 / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        subtext: 'Contractual & promotional allowances',
        variant: 'default',
      },
    ];

    return { metrics, rows: rows.sort((a, b) => b.issuedDate.localeCompare(a.issuedDate)), dateRangeLabel: label };
  }

  /**
   * Generates AR Aging Report Data.
   */
  static async getAgingReport(
    workspaceId: string,
    preset: DateRangePreset,
    customStart?: string,
    customEnd?: string
  ): Promise<ReportPayload<AgingReportRow>> {
    const { label } = this.resolveDateRange(preset, customStart, customEnd);

    const [accSnap, invSnap] = await Promise.all([
      adminDb.collection('financial_accounts').where('workspaceId', '==', workspaceId).get(),
      adminDb.collection('invoices').where('workspaceIds', 'array-contains', workspaceId).get(),
    ]);

    const now = new Date();
    const rows: AgingReportRow[] = [];
    let grandTotalAR = 0;
    let totalOverdue = 0;
    let total90Plus = 0;

    // Index active invoices by accountId for O(N + M) complexity
    const invoicesByAccount = new Map<string, Invoice[]>();
    for (const invDoc of invSnap.docs) {
      const inv = invDoc.data() as Invoice;
      if (inv.status === 'paid' || inv.status === 'void') continue;
      const bal = Number(inv.balanceDue ?? inv.totalPayable ?? 0);
      if (bal <= 0) continue;

      const accId = inv.accountId || '';
      const list = invoicesByAccount.get(accId) || [];
      list.push(inv);
      invoicesByAccount.set(accId, list);
    }

    for (const accDoc of accSnap.docs) {
      const acc = accDoc.data() as FinancialAccount;
      const balance = Number(acc.currentBalance || 0);
      if (balance <= 0) continue;

      grandTotalAR += balance;

      let currentAmt = 0;
      let d1_30 = 0;
      let d31_60 = 0;
      let d61_90 = 0;
      let d90_plus = 0;

      const accountInvoices = invoicesByAccount.get(accDoc.id) || [];
      for (const inv of accountInvoices) {
        const bal = Number(inv.balanceDue ?? inv.totalPayable ?? 0);
        const aging = AgingService.calculateInvoiceAging(inv, now);
        if (aging.bucket === 'current') currentAmt += bal;
        else if (aging.bucket === '1_30') d1_30 += bal;
        else if (aging.bucket === '31_60') d31_60 += bal;
        else if (aging.bucket === '61_90') d61_90 += bal;
        else if (aging.bucket === '90_plus') d90_plus += bal;
      }

      const accOverdue = d1_30 + d31_60 + d61_90 + d90_plus;
      totalOverdue += accOverdue;
      total90Plus += d90_plus;

      rows.push({
        accountId: accDoc.id,
        accountNumber: acc.accountNumber,
        entityName: acc.accountName,
        currentAmount: Math.round(currentAmt * 100) / 100,
        days1_30: Math.round(d1_30 * 100) / 100,
        days31_60: Math.round(d31_60 * 100) / 100,
        days61_90: Math.round(d61_90 * 100) / 100,
        days90_plus: Math.round(d90_plus * 100) / 100,
        totalBalance: Math.round(balance * 100) / 100,
        riskLevel: acc.riskLevel || 'low',
        currency: acc.currency || 'GHS',
      });
    }

    const metrics: ReportMetricItem[] = [
      {
        id: 'total_ar',
        label: 'Total Receivables',
        value: `GHS ${Math.round(grandTotalAR * 100 / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        subtext: `${rows.length} debtor accounts`,
        variant: 'default',
      },
      {
        id: 'total_overdue',
        label: 'Total Overdue',
        value: `GHS ${Math.round(totalOverdue * 100 / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        subtext: `${grandTotalAR > 0 ? Math.round((totalOverdue / grandTotalAR) * 100) : 0}% of total receivables`,
        variant: 'warning',
      },
      {
        id: 'at_risk_90',
        label: 'Critical Debt (90+ Days)',
        value: `GHS ${Math.round(total90Plus * 100 / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        subtext: 'High-risk delinquent exposure',
        variant: 'danger',
      },
    ];

    return { metrics, rows: rows.sort((a, b) => b.totalBalance - a.totalBalance), dateRangeLabel: label };
  }

  /**
   * Generates Tax & VAT Audit Report Data.
   */
  static async getTaxAuditReport(
    workspaceId: string,
    preset: DateRangePreset,
    customStart?: string,
    customEnd?: string
  ): Promise<ReportPayload<TaxAuditReportRow>> {
    const { startDate, endDate, label } = this.resolveDateRange(preset, customStart, customEnd);

    const invSnap = await adminDb
      .collection('invoices')
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();

    let totalGross = 0;
    let totalVat = 0;
    let totalLevy = 0;
    const rows: TaxAuditReportRow[] = [];

    for (const doc of invSnap.docs) {
      const inv = doc.data() as Invoice;
      if (inv.status === 'void' || inv.status === 'draft') continue;

      const dateStr = (inv.issuedAt || inv.createdAt).split('T')[0];
      if (dateStr < startDate || dateStr > endDate) continue;

      const gross = Number(inv.totalPayable || 0);
      const vat = Number(inv.vatAmount || 0);
      const levy = Number(inv.levyAmount || 0);
      const tax = vat + levy;

      totalGross += gross;
      totalVat += vat;
      totalLevy += levy;

      rows.push({
        invoiceId: doc.id,
        invoiceNumber: inv.invoiceNumber,
        entityName: inv.entityName || 'Customer',
        issuedDate: dateStr,
        grossAmount: Math.round(gross * 100) / 100,
        vatRate: 'Standard VAT',
        vatAmount: Math.round(vat * 100) / 100,
        levyAmount: Math.round(levy * 100) / 100,
        totalTax: Math.round(tax * 100) / 100,
        currency: inv.currency || 'GHS',
      });
    }

    const metrics: ReportMetricItem[] = [
      {
        id: 'gross_sales',
        label: 'Gross Taxable Billing',
        value: `GHS ${Math.round(totalGross * 100 / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        subtext: 'Invoice volume before tax deductions',
        variant: 'default',
      },
      {
        id: 'vat_collected',
        label: 'Total VAT Liability',
        value: `GHS ${Math.round(totalVat * 100 / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        subtext: 'Standard VAT output',
        variant: 'warning',
      },
      {
        id: 'levy_collected',
        label: 'Statutory Levies',
        value: `GHS ${Math.round(totalLevy * 100 / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        subtext: 'NHIL, GETFund & COVID levies',
        variant: 'warning',
      },
      {
        id: 'total_tax_liability',
        label: 'Total Tax Obligation',
        value: `GHS ${Math.round((totalVat + totalLevy) * 100 / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        subtext: 'Combined statutory remittance amount',
        variant: 'danger',
      },
    ];

    return { metrics, rows: rows.sort((a, b) => b.issuedDate.localeCompare(a.issuedDate)), dateRangeLabel: label };
  }
}
