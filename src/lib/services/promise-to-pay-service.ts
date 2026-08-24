/**
 * SmartSapp Finance 2.0 - Promise-to-Pay (PTP) Service
 * Tracks formal debtor payment commitments, automated payment fulfillment matching,
 * and broken promise escalation.
 */

import { adminDb } from '../firebase-admin';
import { PromiseToPay, PaymentMethod } from '../types';
import { CollectionActivityService } from './collection-activity-service';
import { CollectionCaseService } from './collection-case-service';

export interface RecordPromiseToPayParams {
  workspaceId: string;
  organizationId?: string;
  caseId?: string;
  accountId: string;
  entityId: string;
  entityName: string;
  promisedAmount: number;
  currency?: string;
  promisedDate: string; // YYYY-MM-DD
  paymentMethod?: PaymentMethod;
  notes?: string;
  userId: string;
  userName: string;
}

export class PromiseToPayService {
  /**
   * Records a formal debtor promise to pay.
   */
  static async recordPromise(params: RecordPromiseToPayParams): Promise<PromiseToPay> {
    const {
      workspaceId,
      organizationId = 'default',
      caseId: explicitCaseId,
      accountId,
      entityId,
      entityName,
      promisedAmount,
      currency = 'GHS',
      promisedDate,
      paymentMethod,
      notes,
      userId,
      userName,
    } = params;

    const timestamp = new Date().toISOString();

    // 1. Resolve or create active collection case if not passed
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

    const promiseData: Omit<PromiseToPay, 'id'> = {
      organizationId,
      workspaceIds: [workspaceId],
      caseId,
      accountId,
      entityId,
      entityName,
      promisedAmount: Math.round(promisedAmount * 100) / 100,
      currency,
      promisedDate,
      paymentMethod,
      notes: notes?.trim() || undefined,
      status: 'pending',
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await adminDb.collection('promises_to_pay').add(promiseData);
    const promise: PromiseToPay = { id: docRef.id, ...promiseData };

    // Update activePromiseId and stage on collection case
    if (caseId) {
      await adminDb.collection('collection_cases').doc(caseId).update({
        activePromiseId: docRef.id,
        stage: 'payment_arrangement',
        nextAction: `Await PTP Remittance (${currency} ${promisedAmount.toLocaleString()})`,
        nextActionDate: promisedDate,
        updatedAt: timestamp,
      });

      await CollectionActivityService.logActivity({
        workspaceId,
        organizationId,
        caseId,
        entityId,
        type: 'promise_to_pay',
        summary: `Promise-to-Pay recorded: ${currency} ${promisedAmount.toLocaleString()} due on ${promisedDate}`,
        details: notes,
        userId,
        userName,
      });
    }

    return promise;
  }

  /**
   * Evaluates incoming payments against pending promises-to-pay.
   * Matches sequentially by earliest promisedDate and deducts payment allocation.
   */
  static async checkAndFulfillPromises(
    entityId: string,
    paymentAmount: number,
    paymentId: string
  ): Promise<number> {
    const snap = await adminDb
      .collection('promises_to_pay')
      .where('entityId', '==', entityId)
      .where('status', '==', 'pending')
      .get();

    if (snap.empty) return 0;

    // Sort in-memory by earliest promise date
    const pendingPromises = snap.docs
      .map(doc => ({ id: doc.id, ref: doc.ref, ...(doc.data() as Omit<PromiseToPay, 'id'>) }))
      .sort((a, b) => (a.promisedDate || '').localeCompare(b.promisedDate || ''));

    let fulfilledCount = 0;
    let availableAmount = paymentAmount;
    const timestamp = new Date().toISOString();

    for (const promise of pendingPromises) {
      if (availableAmount <= 0) break;

      // Fulfill if remaining payment covers at least 90% of the promised commitment
      if (availableAmount >= promise.promisedAmount * 0.9) {
        await promise.ref.update({
          status: 'fulfilled',
          fulfilledPaymentId: paymentId,
          fulfilledAt: timestamp,
          updatedAt: timestamp,
        });

        if (promise.caseId) {
          // Clear activePromiseId on collection case
          await adminDb.collection('collection_cases').doc(promise.caseId).update({
            activePromiseId: null,
            updatedAt: timestamp,
          });

          await CollectionActivityService.logActivity({
            workspaceId: promise.workspaceIds[0],
            organizationId: promise.organizationId,
            caseId: promise.caseId,
            entityId,
            type: 'promise_to_pay',
            summary: `Promise-to-Pay fulfilled via payment (${promise.currency} ${promise.promisedAmount.toLocaleString()})`,
            userId: 'system',
            userName: 'Settlement Engine',
          });
        }

        availableAmount = Math.max(0, Math.round((availableAmount - promise.promisedAmount) * 100) / 100);
        fulfilledCount++;
      }
    }

    return fulfilledCount;
  }

  /**
   * Scans for expired pending promises and marks them broken, auto-escalating the case
   * without overwriting terminal or legal stages.
   */
  static async evaluateBrokenPromises(
    workspaceId: string,
    userId: string = 'system',
    userName: string = 'Automated PTP Monitor'
  ): Promise<number> {
    const todayStr = new Date().toISOString().split('T')[0];

    const snap = await adminDb
      .collection('promises_to_pay')
      .where('workspaceIds', 'array-contains', workspaceId)
      .where('status', '==', 'pending')
      .get();

    let brokenCount = 0;
    const timestamp = new Date().toISOString();

    for (const doc of snap.docs) {
      const promise = { id: doc.id, ...(doc.data() as Omit<PromiseToPay, 'id'>) };
      if (promise.promisedDate < todayStr) {
        await doc.ref.update({
          status: 'broken',
          updatedAt: timestamp,
        });

        if (promise.caseId) {
          const caseRef = adminDb.collection('collection_cases').doc(promise.caseId);
          const caseSnap = await caseRef.get();

          if (caseSnap.exists) {
            const currentStage = caseSnap.data()?.stage;
            const updates: Record<string, unknown> = {
              activePromiseId: null,
              nextAction: 'Escalate broken promise with institutional leadership',
              nextActionDate: todayStr,
              updatedAt: timestamp,
            };

            // Only elevate stage if not already in terminal or legal stage
            if (currentStage !== 'legal_external' && currentStage !== 'resolved' && currentStage !== 'final_notice') {
              updates.stage = 'escalation';
              updates.priority = 'critical';
            }

            await caseRef.update(updates);
          }

          await CollectionActivityService.logActivity({
            workspaceId,
            organizationId: promise.organizationId,
            caseId: promise.caseId,
            entityId: promise.entityId,
            type: 'promise_to_pay',
            summary: `BROKEN PROMISE: ${promise.currency} ${promise.promisedAmount.toLocaleString()} was due on ${promise.promisedDate}`,
            outcome: 'Promise marked broken and case reviewed for escalation',
            userId,
            userName,
          });
        }
        brokenCount++;
      }
    }

    return brokenCount;
  }
}
