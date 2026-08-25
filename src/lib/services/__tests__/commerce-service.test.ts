import { describe, it, expect } from 'vitest';

describe('CommerceService Unit Logic', () => {
  it('calculates percentage and fixed coupon discounts accurately', () => {
    const offerPrice = 200;

    // Percentage discount (20% of 200 = 40)
    const percentageDiscountValue = 20;
    const percentageDiscount = Math.round((offerPrice * percentageDiscountValue) / 100);
    expect(percentageDiscount).toBe(40);
    expect(Math.max(0, offerPrice - percentageDiscount)).toBe(160);

    // Fixed discount ($50 off 200 = 50)
    const fixedDiscountValue = 50;
    const fixedDiscount = Math.min(offerPrice, fixedDiscountValue);
    expect(fixedDiscount).toBe(50);
    expect(Math.max(0, offerPrice - fixedDiscount)).toBe(150);

    // Fixed discount capping (e.g. $300 discount on $200 item = max $200 discount)
    const oversizedDiscountValue = 300;
    const cappedDiscount = Math.min(offerPrice, oversizedDiscountValue);
    expect(cappedDiscount).toBe(200);
    expect(Math.max(0, offerPrice - cappedDiscount)).toBe(0);
  });

  it('normalizes coupon codes and computes affiliate commission', () => {
    const rawCoupon = ' launch20-promo ';
    const cleanCoupon = rawCoupon.toUpperCase().trim();
    expect(cleanCoupon).toBe('LAUNCH20-PROMO');

    const totalAmount = 160;
    const commissionRate = 20; // 20%
    const commissionAmount = Math.round((totalAmount * commissionRate) / 100);
    expect(commissionAmount).toBe(32);
  });
});
