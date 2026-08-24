'use server';

/**
 * SmartSapp Finance 2.0 - Billing Agreement Server Actions
 * Handles agreement creation, updates, and recurring cycle billing runs.
 */

import { adminDb } from './firebase-admin';
import { canUser } from './workspace-permissions';
import { BillingAgreement, ActionResponse, RecurringBillingBatchResult } from './types';
import { AgreementSequenceService } from './services/agreement-sequence-service';
import { FinancialAccountService } from './services/financial-account-service';
import { RecurringBillingService } from './services/recurring-billing-service';
import { logActivity } from './activity-logger';

export interface CreateAgreementInput {
  organizationId?: string;
  workspaceId: string;
  userId: string;
  entityId: string;
  entityName: string;
  productId: string;
  productName: string;
  pricingPlanId?: string;
  quantity: number;
  ratePerUnit: number;
  currency: string;
  billingFrequency: BillingAgreement['billingFrequency'];
  billingProfileId: string;
  startDate: string;
  endDate?: string;
  paymentTermsDays?: number;
  autoRenew?: boolean;
}

export async function createAgreementAction(
  input: CreateAgreementInput
): Promise<ActionResponse & { agreement?: BillingAgreement }> {
  try {
    const { workspaceId, userId, entityId, entityName, productId, productName, quantity, ratePerUnit, currency, billingFrequency, billingProfileId, startDate } = input;

    if (!workspaceId || !userId || !entityId || !productId || !billingProfileId || !startDate) {
      return { success: false, error: 'Missing required agreement configuration fields.' };
    }

    const permission = await canUser(userId, 'finance', 'invoices', 'create', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance management permissions.' };
    }

    const timestamp = new Date().toISOString();

    // 1. Ensure Financial Account exists for target entity
    const account = await FinancialAccountService.getOrCreateFinancialAccount({
      entityId,
      workspaceId,
      organizationId: input.organizationId || 'default',
      entityName,
      currency: currency || 'GHS',
      actorId: userId,
    });

    // 2. Generate Sequential Agreement Number (AGR-YYYY-XXXXXX)
    const agreementNumber = await AgreementSequenceService.getNextAgreementNumber(workspaceId, 'AGR');

    const qty = Number(quantity) || 1;
    const rate = Number(ratePerUnit) || 0;
    const totalAmountPerCycle = Math.round((qty * rate) * 100) / 100;

    const agreementData: Omit<BillingAgreement, 'id'> = {
      organizationId: input.organizationId || 'default',
      workspaceIds: [workspaceId],
      agreementNumber,
      entityId,
      entityName,
      accountId: account.id,
      productId,
      productName,
      pricingPlanId: input.pricingPlanId || undefined,
      quantity: qty,
      ratePerUnit: rate,
      totalAmountPerCycle,
      currency: currency || 'GHS',
      billingFrequency: billingFrequency || 'termly',
      billingProfileId,
      startDate,
      endDate: input.endDate || undefined,
      paymentTermsDays: Number(input.paymentTermsDays) || 30,
      autoRenew: input.autoRenew !== undefined ? input.autoRenew : true,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await adminDb.collection('billing_agreements').add(agreementData);
    const agreement: BillingAgreement = { id: docRef.id, ...agreementData };

    await logActivity({
      userId,
      organizationId: input.organizationId || 'default',
      workspaceId,
      type: 'status_change',
      source: 'finance_engine',
      description: `Created billing agreement ${agreementNumber} for ${entityName} (${currency} ${totalAmountPerCycle} / ${billingFrequency})`,
      entityId,
      metadata: {
        event: 'agreement.created',
        agreementId: docRef.id,
        agreementNumber,
        totalAmountPerCycle,
      },
    });

    return { success: true, agreement };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create billing agreement';
    console.error('[AGREEMENT_ACTIONS] Error creating agreement:', message);
    return { success: false, error: message };
  }
}

export async function updateAgreementAction(
  agreementId: string,
  workspaceId: string,
  userId: string,
  updates: Partial<BillingAgreement>
): Promise<ActionResponse> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'edit', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance management permissions.' };
    }

    const docRef = adminDb.collection('billing_agreements').doc(agreementId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return { success: false, error: 'Agreement not found.' };
    }

    const existing = docSnap.data() as BillingAgreement;
    const timestamp = new Date().toISOString();

    const cleanUpdates: Partial<BillingAgreement> = {
      ...updates,
      updatedAt: timestamp,
    };

    // Recalculate total if quantity or rate updated
    if (updates.quantity !== undefined || updates.ratePerUnit !== undefined) {
      const q = updates.quantity !== undefined ? Number(updates.quantity) : existing.quantity;
      const r = updates.ratePerUnit !== undefined ? Number(updates.ratePerUnit) : existing.ratePerUnit;
      cleanUpdates.totalAmountPerCycle = Math.round((q * r) * 100) / 100;
    }

    await docRef.update(cleanUpdates);

    await logActivity({
      userId,
      organizationId: existing.organizationId || 'default',
      workspaceId,
      type: 'status_change',
      source: 'finance_engine',
      description: `Updated billing agreement ${existing.agreementNumber}`,
      entityId: existing.entityId,
      metadata: {
        event: 'agreement.updated',
        agreementId,
        updates: cleanUpdates,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update billing agreement';
    return { success: false, error: message };
  }
}

export async function executeRecurringBillingAction(
  periodId: string,
  workspaceId: string,
  userId: string,
  autoIssue: boolean = false
): Promise<ActionResponse & { batchResult?: RecurringBillingBatchResult }> {
  try {
    const permission = await canUser(userId, 'finance', 'invoices', 'create', workspaceId);
    if (!permission.granted) {
      return { success: false, error: 'Unauthorized: insufficient finance management permissions.' };
    }

    const batchResult = await RecurringBillingService.executeBatchRun({
      periodId,
      workspaceId,
      userId,
      autoIssue,
    });

    await logActivity({
      userId,
      organizationId: 'default',
      workspaceId,
      type: 'status_change',
      source: 'finance_engine',
      description: `Executed recurring billing run for period ${batchResult.periodName}. Generated ${batchResult.invoicesCreated} invoices totaling GHS ${batchResult.totalGrossInvoiced}`,
      metadata: {
        event: 'recurring_billing.executed',
        periodId,
        invoicesCreated: batchResult.invoicesCreated,
        totalGrossInvoiced: batchResult.totalGrossInvoiced,
        skippedAlreadyBilled: batchResult.skippedAlreadyBilled,
      },
    });

    return { success: true, batchResult };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to execute recurring billing run';
    console.error('[AGREEMENT_ACTIONS] Batch billing run error:', message);
    return { success: false, error: message };
  }
}

export async function getAgreementsByEntityAction(
  entityId: string,
  workspaceId: string
): Promise<ActionResponse & { agreements?: BillingAgreement[] }> {
  try {
    const snap = await adminDb
      .collection('billing_agreements')
      .where('entityId', '==', entityId)
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();

    const agreements: BillingAgreement[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<BillingAgreement, 'id'>),
    }));

    return { success: true, agreements };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve agreements for entity';
    return { success: false, error: message };
  }
}
