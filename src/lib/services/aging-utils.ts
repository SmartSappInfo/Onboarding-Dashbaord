import { Invoice, AgingBucket } from '../types';

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

/**
 * Calculates dynamic aging bucket for a single invoice.
 */
export function calculateInvoiceAging(invoice: Invoice, asOfDate: Date = new Date()): InvoiceAgingResult {
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

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    entityId: invoice.entityId || '',
    entityName: invoice.entityName || '',
    balanceDue: invoice.balanceDue ?? invoice.totalPayable ?? 0,
    dueDate: dueDateStr,
    daysOverdue,
    bucket,
  };
}
