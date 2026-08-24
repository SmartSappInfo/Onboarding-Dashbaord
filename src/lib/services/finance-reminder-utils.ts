import { Invoice, ReminderStage } from '../types';

/**
 * Evaluates days difference and returns the appropriate reminder milestone stage.
 */
export function determineReminderStage(daysDiff: number): ReminderStage | null {
  // Negative daysDiff means before due date; positive means overdue
  if (daysDiff === -7) return 't_minus_7';
  if (daysDiff === -3) return 't_minus_3';
  if (daysDiff === 0) return 'due_date';
  if (daysDiff === 3) return 't_plus_3';
  if (daysDiff === 7) return 't_plus_7';
  if (daysDiff === 14) return 't_plus_14';
  if (daysDiff === 30) return 't_plus_30';
  return null;
}

/**
 * Generates localized, professional reminder copy for the customer.
 */
export function formatReminderMessage(
  invoice: Invoice,
  stage: ReminderStage,
  entityName: string
): string {
  const currency = invoice.currency || 'GHS';
  const balance = Number(invoice.balanceDue ?? invoice.totalPayable ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
  const dueDate = invoice.dueDate || invoice.issuedAt?.split('T')[0] || 'due date';

  switch (stage) {
    case 't_minus_7':
      return `Friendly reminder for ${entityName}: Invoice ${invoice.invoiceNumber} (${currency} ${balance}) will be due on ${dueDate}. Please arrange remittance at your convenience.`;
    case 't_minus_3':
      return `Payment Notice for ${entityName}: Invoice ${invoice.invoiceNumber} (${currency} ${balance}) is due in 3 days on ${dueDate}.`;
    case 'due_date':
      return `Payment Due Today for ${entityName}: Invoice ${invoice.invoiceNumber} (${currency} ${balance}) is due today (${dueDate}). Thank you for your partnership.`;
    case 't_plus_3':
      return `Grace Period Notice for ${entityName}: Invoice ${invoice.invoiceNumber} (${currency} ${balance}) was due on ${dueDate}. Please let us know once payment has been disbursed.`;
    case 't_plus_7':
      return `Overdue Notice (1st) for ${entityName}: Invoice ${invoice.invoiceNumber} (${currency} ${balance}) is 7 days overdue. Please process payment immediately to maintain active status.`;
    case 't_plus_14':
      return `Urgent Overdue Notice (2nd) for ${entityName}: Invoice ${invoice.invoiceNumber} (${currency} ${balance}) is now 14 days overdue. Please contact our finance team or reply with remittance advice.`;
    case 't_plus_30':
      return `FINAL DEMAND NOTICE for ${entityName}: Invoice ${invoice.invoiceNumber} (${currency} ${balance}) is over 30 days delinquent. Your account is being escalated to formal debt recovery.`;
    default:
      return `Payment Notice for ${entityName}: Invoice ${invoice.invoiceNumber} balance is ${currency} ${balance}.`;
  }
}
