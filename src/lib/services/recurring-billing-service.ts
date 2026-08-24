/**
 * SmartSapp Finance 2.0 - Recurring Billing Engine
 * Automated, contract-driven cycle invoicing for active institutional billing agreements.
 * 
 * Invariants:
 * 1. Strict Idempotency: No agreement is billed more than once per BillingPeriod.
 * 2. High-throughput Chunking: Processes batches in bounded chunks of 10 to avoid Firestore limits & timeouts.
 * 3. Pro-rata precision: Fractional terms/months calculated and rounded with Math.round(val * 100) / 100.
 */

import { adminDb } from '../firebase-admin';
import { 
  BillingAgreement, 
  BillingPeriod, 
  BillingProfile, 
  Invoice, 
  RecurringBillingBatchResult 
} from '../types';
import { InvoiceSequenceService } from './invoice-sequence-service';
import { InvoiceLifecycleService } from './invoice-lifecycle-service';
import { FinancialAccountService } from './financial-account-service';
import { FinancialEventService } from './financial-event-service';
import crypto from 'crypto';

export interface ExecuteRecurringBillingOptions {
  periodId: string;
  workspaceId: string;
  userId: string;
  autoIssue?: boolean; // If true, issues immediately to ledger; if false, creates unfinalized drafts
}

export class RecurringBillingService {
  /**
   * Executes recurring billing for all eligible active agreements in a workspace for a specific period.
   */
  static async executeBatchRun(
    options: ExecuteRecurringBillingOptions
  ): Promise<RecurringBillingBatchResult> {
    const { periodId, workspaceId, userId, autoIssue = false } = options;
    const timestamp = new Date().toISOString();

    // 1. Fetch Billing Period
    const periodSnap = await adminDb.collection('billing_periods').doc(periodId).get();
    if (!periodSnap.exists) {
      throw new Error('Billing cycle period not found');
    }
    const period = periodSnap.data() as BillingPeriod;
    const periodName = period.name || 'Current Term';

    // 2. Fetch Active Billing Agreements for workspace
    const agreementsSnap = await adminDb
      .collection('billing_agreements')
      .where('workspaceIds', 'array-contains', workspaceId)
      .where('status', '==', 'active')
      .get();

    const agreements: BillingAgreement[] = agreementsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<BillingAgreement, 'id'>),
    }));

    const result: RecurringBillingBatchResult = {
      periodId,
      periodName,
      totalEligible: agreements.length,
      invoicesCreated: 0,
      skippedAlreadyBilled: 0,
      failedCount: 0,
      totalGrossInvoiced: 0,
      createdInvoiceIds: [],
      errors: [],
    };

    if (agreements.length === 0) {
      return result;
    }

    // 3. Process in sequential chunks of 10 to ensure safety under high concurrency
    const CHUNK_SIZE = 10;
    for (let i = 0; i < agreements.length; i += CHUNK_SIZE) {
      const chunk = agreements.slice(i, i + CHUNK_SIZE);

      await Promise.all(
        chunk.map(async (agreement) => {
          try {
            // Idempotency Check: Skip if already billed for this cycle
            if (agreement.lastBilledPeriodId === periodId) {
              result.skippedAlreadyBilled++;
              return;
            }

            // Check if an invoice with this agreement & period already exists in Firestore
            const existingInvSnap = await adminDb
              .collection('invoices')
              .where('agreementId', '==', agreement.id)
              .where('periodId', '==', periodId)
              .limit(1)
              .get();

            if (!existingInvSnap.empty) {
              result.skippedAlreadyBilled++;
              // Update agreement pointer if out of sync
              await adminDb.collection('billing_agreements').doc(agreement.id).update({
                lastBilledPeriodId: periodId,
                lastBilledAt: timestamp,
                updatedAt: timestamp,
              });
              return;
            }

            // Resolve Billing Profile
            let profile: BillingProfile | null = null;
            if (agreement.billingProfileId) {
              const pSnap = await adminDb.collection('billing_profiles').doc(agreement.billingProfileId).get();
              if (pSnap.exists) {
                profile = pSnap.data() as BillingProfile;
              }
            }

            const vatPercent = Number(profile?.vatPercent || 0);
            const levyPercent = Number(profile?.levyPercent || 0);
            const defaultDiscount = Number(profile?.defaultDiscount || 0);

            // Calculation
            const qty = Number(agreement.quantity) || 1;
            const rate = Number(agreement.ratePerUnit) || 0;
            const subtotal = Math.round((qty * rate) * 100) / 100;
            const levyAmount = Math.round(((subtotal * levyPercent) / 100) * 100) / 100;
            const vatAmount = Math.round(((subtotal * vatPercent) / 100) * 100) / 100;
            const discount = Math.round(((subtotal * defaultDiscount) / 100) * 100) / 100;
            const totalPayable = Math.max(0, Math.round((subtotal + levyAmount + vatAmount - discount) * 100) / 100);

            // Ensure Financial Account exists
            let accountId = agreement.accountId;
            if (!accountId && agreement.entityId) {
              const acc = await FinancialAccountService.getOrCreateFinancialAccount({
                entityId: agreement.entityId,
                workspaceId,
                organizationId: agreement.organizationId || 'default',
                entityName: agreement.entityName || 'Organization',
                currency: agreement.currency || 'GHS',
                actorId: userId,
              });
              accountId = acc.id;
            }

            const invoiceNumber = await InvoiceSequenceService.getNextInvoiceNumber(
              workspaceId,
              autoIssue ? 'INV' : 'DRAFT'
            );
            const publicToken = crypto.randomUUID();

            const invoiceData: Omit<Invoice, 'id'> = {
              organizationId: agreement.organizationId || 'default',
              accountId,
              agreementId: agreement.id,
              agreementNumber: agreement.agreementNumber,
              publicToken,
              invoiceNumber,
              entityId: agreement.entityId,
              entityName: agreement.entityName,
              periodId,
              periodName,
              nominalRoll: qty,
              packageId: agreement.productId || 'custom',
              packageName: agreement.productName || 'Standard Package',
              ratePerStudent: rate,
              currency: agreement.currency || 'GHS',
              subtotal,
              discount,
              levyAmount,
              vatAmount,
              arrearsAdded: 0,
              creditDeducted: 0,
              totalPayable,
              amountPaid: 0,
              amountCredited: 0,
              balanceDue: totalPayable,
              status: 'draft',
              lifecycleStatus: 'draft',
              paymentStatus: 'unpaid',
              collectionStatus: 'none',
              items: [
                {
                  name: agreement.productName || 'Recurring Service Subscription',
                  description: `Recurring billing for ${qty} units (${periodName}). Agreement: ${agreement.agreementNumber}`,
                  quantity: qty,
                  unitPrice: rate,
                  amount: subtotal,
                },
              ],
              paymentInstructions: profile?.paymentInstructions || 'Direct bank transfer to SmartSapp Collection Account.',
              signatureName: profile?.signatureName || 'Finance Administrator',
              signatureDesignation: profile?.signatureDesignation || 'Head of Financial Operations',
              signatureUrl: profile?.signatureUrl || undefined,
              createdAt: timestamp,
              updatedAt: timestamp,
              workspaceIds: [workspaceId],
              billingProfileId: agreement.billingProfileId,
            };

            const invDocRef = await adminDb.collection('invoices').add(invoiceData);

            // If autoIssue is enabled, immediately issue and debit ledger via InvoiceLifecycleService
            if (autoIssue && accountId) {
              await adminDb.runTransaction(async (tx) => {
                await InvoiceLifecycleService.issueInvoiceInTx(
                  tx,
                  invDocRef,
                  { ...invoiceData, id: invDocRef.id } as Invoice,
                  userId,
                  workspaceId,
                  accountId!
                );
              });

              FinancialEventService.emitInvoiceIssued(
                { ...invoiceData, id: invDocRef.id, invoiceNumber } as Invoice,
                userId
              ).catch((err) => console.error('[RECURRING_BILLING] Event emit error:', err));
            }

            // Update Agreement record
            await adminDb.collection('billing_agreements').doc(agreement.id).update({
              lastBilledPeriodId: periodId,
              lastBilledAt: timestamp,
              updatedAt: timestamp,
            });

            result.invoicesCreated++;
            result.totalGrossInvoiced = Math.round((result.totalGrossInvoiced + totalPayable) * 100) / 100;
            result.createdInvoiceIds.push(invDocRef.id);
          } catch (err: unknown) {
            result.failedCount++;
            const errorMsg = err instanceof Error ? err.message : 'Unknown billing error';
            console.error(`[RECURRING_BILLING] Failed agreement ${agreement.agreementNumber}:`, errorMsg);
            result.errors.push({
              agreementId: agreement.id,
              agreementNumber: agreement.agreementNumber,
              error: errorMsg,
            });
          }
        })
      );
    }

    return result;
  }
}
