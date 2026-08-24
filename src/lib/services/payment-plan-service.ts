/**
 * SmartSapp Finance 2.0 - Structured Installment Payment Plan Service
 * Restructures delinquent debt into manageable periodic installments with exact rounding.
 */

import { adminDb } from '../firebase-admin';
import { PaymentPlan, PaymentPlanInstallment } from '../types';
import { CollectionCaseSequenceService } from './collection-case-sequence-service';
import { CollectionActivityService } from './collection-activity-service';
import { CollectionCaseService } from './collection-case-service';

export interface CreatePaymentPlanParams {
  workspaceId: string;
  organizationId?: string;
  caseId?: string;
  accountId: string;
  entityId: string;
  entityName: string;
  totalDebt: number;
  downPayment: number;
  installmentsCount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  startDate: string; // YYYY-MM-DD
  currency?: string;
  userId: string;
  userName: string;
}

export class PaymentPlanService {
  /**
   * Creates a formal structured installment payment plan.
   */
  static async createPlan(params: CreatePaymentPlanParams): Promise<PaymentPlan> {
    const {
      workspaceId,
      organizationId = 'default',
      caseId: explicitCaseId,
      accountId,
      entityId,
      entityName,
      totalDebt,
      downPayment,
      installmentsCount,
      frequency,
      startDate,
      currency = 'GHS',
      userId,
      userName,
    } = params;

    const timestamp = new Date().toISOString();

    // 1. Resolve or create active collection case if not provided
    let caseId = explicitCaseId;
    if (!caseId) {
      const activeCase = await CollectionCaseService.getOrCreateCaseForEntity(
        entityId,
        workspaceId,
        userId,
        userName
      );
      caseId = activeCase.id;
    }

    const safeDebt = Math.max(0, Math.round(totalDebt * 100) / 100);
    const safeDown = Math.max(0, Math.round(downPayment * 100) / 100);
    const remainingBalance = Math.max(0, Math.round((safeDebt - safeDown) * 100) / 100);

    // 2. Generate Installments with penny-precision balancing
    const installments: PaymentPlanInstallment[] = [];
    const count = Math.max(1, installmentsCount);
    const baseAmount = Math.floor((remainingBalance / count) * 100) / 100;
    let accumulated = 0;

    const intervalDays = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 30;
    const startObj = new Date(startDate);

    for (let i = 1; i <= count; i++) {
      const dueDateObj = new Date(startObj.getTime() + (i - 1) * intervalDays * 86400000);
      const dueDateStr = dueDateObj.toISOString().split('T')[0];

      let installmentAmount = baseAmount;
      if (i === count) {
        // Final installment absorbs any fractional cents
        installmentAmount = Math.round((remainingBalance - accumulated) * 100) / 100;
      } else {
        accumulated = Math.round((accumulated + installmentAmount) * 100) / 100;
      }

      installments.push({
        installmentNumber: i,
        dueDate: dueDateStr,
        amount: installmentAmount,
        status: 'pending',
      });
    }

    const planNumber = await CollectionCaseSequenceService.getNextNumber(workspaceId, 'PLN');

    const planData: Omit<PaymentPlan, 'id'> = {
      organizationId,
      workspaceIds: [workspaceId],
      planNumber,
      caseId,
      accountId,
      entityId,
      entityName,
      totalDebt: safeDebt,
      downPayment: safeDown,
      remainingBalance,
      currency,
      installmentsCount: count,
      frequency,
      installments,
      status: 'active',
      startDate,
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await adminDb.collection('payment_plans').add(planData);
    const plan: PaymentPlan = { id: docRef.id, ...planData };

    // Update case with active payment plan
    if (caseId) {
      await adminDb.collection('collection_cases').doc(caseId).update({
        activePaymentPlanId: docRef.id,
        stage: 'payment_arrangement',
        nextAction: `Payment Plan Active (${count} installments of ~${currency} ${baseAmount.toLocaleString()})`,
        nextActionDate: installments[0]?.dueDate,
        updatedAt: timestamp,
      });

      await CollectionActivityService.logActivity({
        workspaceId,
        organizationId,
        caseId,
        entityId,
        type: 'note',
        summary: `Payment Plan ${planNumber} created: Down Payment ${currency} ${safeDown.toLocaleString()} + ${count} ${frequency} installments`,
        userId,
        userName,
      });
    }

    return plan;
  }
}
