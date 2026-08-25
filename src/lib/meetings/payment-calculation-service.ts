/**
 * @fileoverview Pure Payment, Deposit & Refund Calculation Engine.
 * Calculates upfront charges and determines cancellation refunds according to policy.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - Handles currency math deterministically with integer values.
 */

import type {
  EventTypePricingConfig,
  RefundCalculationResult,
} from './types/payments';

/**
 * Computes upfront required payment amount (full fee or deposit).
 */
export function calculateUpfrontCharge(config: EventTypePricingConfig): {
  requiredAmount: number;
  balanceDueLater: number;
  currency: string;
} {
  if (config.type === 'free') {
    return { requiredAmount: 0, balanceDueLater: 0, currency: config.currency };
  }

  if (config.type === 'deposit') {
    const deposit = config.depositAmount || Math.round(config.amount * 0.5);
    const balance = Math.max(0, config.amount - deposit);
    return { requiredAmount: deposit, balanceDueLater: balance, currency: config.currency };
  }

  return { requiredAmount: config.amount, balanceDueLater: 0, currency: config.currency };
}

/**
 * Calculates refund eligibility and amount upon booking cancellation.
 */
export function calculateCancellationRefund(
  amountPaid: number,
  scheduledStart: Date,
  cancelledAt: Date,
  policy: EventTypePricingConfig['refundPolicy']
): RefundCalculationResult {
  if (amountPaid <= 0 || policy === 'non_refundable') {
    return {
      isEligible: false,
      refundPercentage: 0,
      refundAmount: 0,
      reason: 'Event type policy is non-refundable.',
    };
  }

  const hoursNotice = (scheduledStart.getTime() - cancelledAt.getTime()) / (1000 * 60 * 60);

  if (policy === 'full_flexible') {
    // 100% refund if cancelled before start
    if (hoursNotice >= 1) {
      return {
        isEligible: true,
        refundPercentage: 100,
        refundAmount: amountPaid,
        reason: 'Full refund under flexible cancellation policy.',
      };
    }
  }

  if (policy === 'moderate_24h') {
    if (hoursNotice >= 24) {
      return {
        isEligible: true,
        refundPercentage: 100,
        refundAmount: amountPaid,
        reason: '100% refund with 24+ hours advance notice.',
      };
    }
    if (hoursNotice >= 4) {
      const half = Math.round(amountPaid * 0.5);
      return {
        isEligible: true,
        refundPercentage: 50,
        refundAmount: half,
        reason: '50% partial refund with 4+ hours advance notice.',
      };
    }
  }

  if (policy === 'strict_48h') {
    if (hoursNotice >= 48) {
      return {
        isEligible: true,
        refundPercentage: 100,
        refundAmount: amountPaid,
        reason: '100% refund with 48+ hours advance notice.',
      };
    }
  }

  return {
    isEligible: false,
    refundPercentage: 0,
    refundAmount: 0,
    reason: `Late cancellation (${Math.max(0, Math.round(hoursNotice))}h notice). No refund available.`,
  };
}
