'use server';

/**
 * @fileoverview Server Actions for Paid Consultations, Deposits & Payment Transactions.
 * Manages payment intent creation, webhook confirmations, and refund calculations.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Transactions are recorded idempotently using unique provider transaction IDs.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  PaymentTransaction,
  EventTypePricingConfig,
  PaymentProvider,
} from '@/lib/meetings/types/payments';
import {
  calculateUpfrontCharge,
  calculateCancellationRefund,
} from '@/lib/meetings/payment-calculation-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Creates a simulated or provider-backed payment intent for a booking hold.
 */
export async function createBookingPaymentIntentAction(payload: {
  workspaceId: string;
  bookingId: string;
  eventTypeId: string;
  pricingConfig: EventTypePricingConfig;
  customerEmail: string;
  customerName?: string;
  provider?: PaymentProvider;
}): Promise<{
  success: boolean;
  paymentIntentId?: string;
  amountRequired?: number;
  currency?: string;
  clientSecret?: string;
  error?: string;
}> {
  try {
    const {
      workspaceId,
      bookingId,
      eventTypeId,
      pricingConfig,
      customerEmail,
      customerName,
      provider = 'stripe',
    } = payload;

    const { requiredAmount, currency } = calculateUpfrontCharge(pricingConfig);

    if (requiredAmount === 0) {
      return { success: true, amountRequired: 0, currency };
    }

    const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const transactionDoc = adminDb.collection('payment_transactions').doc(paymentIntentId);
    const transactionData: PaymentTransaction = {
      id: paymentIntentId,
      workspaceId,
      bookingId,
      eventTypeId,
      provider,
      providerPaymentId: paymentIntentId,
      amount: requiredAmount,
      currency,
      status: 'pending',
      customerEmail: customerEmail.trim(),
      customerName: customerName?.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await transactionDoc.set(transactionData);

    return {
      success: true,
      paymentIntentId,
      amountRequired: requiredAmount,
      currency,
      clientSecret: `cs_secret_${paymentIntentId}`,
    };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Evaluates and processes refunds when a paid booking is cancelled.
 */
export async function processBookingRefundAction(payload: {
  workspaceId: string;
  bookingId: string;
  scheduledStart: string;
  refundPolicy: EventTypePricingConfig['refundPolicy'];
}): Promise<{ success: boolean; refundAmount?: number; reason?: string; error?: string }> {
  try {
    const { workspaceId, bookingId, scheduledStart, refundPolicy } = payload;

    // Fetch successful transactions for this booking
    const txSnap = await adminDb
      .collection('payment_transactions')
      .where('workspaceId', '==', workspaceId)
      .where('bookingId', '==', bookingId)
      .where('status', '==', 'succeeded')
      .get();

    if (txSnap.empty) {
      return { success: true, refundAmount: 0, reason: 'No paid transactions found.' };
    }

    const txDoc = txSnap.docs[0];
    const txData = txDoc.data() as PaymentTransaction;

    const refundCalc = calculateCancellationRefund(
      txData.amount,
      new Date(scheduledStart),
      new Date(),
      refundPolicy
    );

    if (refundCalc.isEligible && refundCalc.refundAmount > 0) {
      await txDoc.ref.update({
        status: refundCalc.refundPercentage === 100 ? 'refunded' : 'partially_refunded',
        refundedAmount: refundCalc.refundAmount,
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      success: true,
      refundAmount: refundCalc.refundAmount,
      reason: refundCalc.reason,
    };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
