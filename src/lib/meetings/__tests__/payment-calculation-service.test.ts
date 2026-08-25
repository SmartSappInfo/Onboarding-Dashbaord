import { describe, it, expect } from 'vitest';
import {
  calculateUpfrontCharge,
  calculateCancellationRefund,
} from '../payment-calculation-service';
import type { EventTypePricingConfig } from '../types/payments';

describe('Payment & Deposit Calculation Service', () => {
  it('calculates upfront charge and balance due for deposit pricing', () => {
    const config: EventTypePricingConfig = {
      type: 'deposit',
      currency: 'USD',
      amount: 10000, // $100.00
      depositAmount: 3000, // $30.00 deposit
      refundPolicy: 'moderate_24h',
    };

    const charge = calculateUpfrontCharge(config);
    expect(charge.requiredAmount).toBe(3000);
    expect(charge.balanceDueLater).toBe(7000);
    expect(charge.currency).toBe('USD');
  });

  it('calculates full charge for fixed price event types', () => {
    const config: EventTypePricingConfig = {
      type: 'fixed_price',
      currency: 'GHS',
      amount: 50000, // 500.00 GHS
      refundPolicy: 'moderate_24h',
    };

    const charge = calculateUpfrontCharge(config);
    expect(charge.requiredAmount).toBe(50000);
    expect(charge.balanceDueLater).toBe(0);
  });

  it('calculates cancellation refunds according to moderate_24h policy', () => {
    const scheduledStart = new Date('2026-08-25T14:00:00Z');

    // Cancelled 48h prior -> 100% refund
    const cancel48h = new Date('2026-08-23T14:00:00Z');
    const ref100 = calculateCancellationRefund(5000, scheduledStart, cancel48h, 'moderate_24h');
    expect(ref100.isEligible).toBe(true);
    expect(ref100.refundPercentage).toBe(100);
    expect(ref100.refundAmount).toBe(5000);

    // Cancelled 6h prior -> 50% partial refund
    const cancel6h = new Date('2026-08-25T08:00:00Z');
    const ref50 = calculateCancellationRefund(5000, scheduledStart, cancel6h, 'moderate_24h');
    expect(ref50.isEligible).toBe(true);
    expect(ref50.refundPercentage).toBe(50);
    expect(ref50.refundAmount).toBe(2500);

    // Cancelled 1h prior -> 0% (late cancellation)
    const cancel1h = new Date('2026-08-25T13:00:00Z');
    const ref0 = calculateCancellationRefund(5000, scheduledStart, cancel1h, 'moderate_24h');
    expect(ref0.isEligible).toBe(false);
    expect(ref0.refundAmount).toBe(0);
  });
});
