/**
 * @fileoverview Domain Types for Paid Consultations, Deposits & Payment Transactions.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Currency codes follow ISO 4217 (USD, GHS, NGN, EUR, GBP).
 * - All monetary amounts are integers in the smallest currency unit (e.g. cents).
 * - Zero 'any' policy strictly enforced.
 */

export type PricingType = 'free' | 'fixed_price' | 'deposit';

export type PaymentProvider = 'stripe' | 'paystack' | 'flutterwave' | 'manual';

export type MeetingPaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface EventTypePricingConfig {
  type: PricingType;
  currency: string; // e.g. 'USD', 'GHS'
  amount: number;   // In cents/pesewas/kobo
  depositAmount?: number;
  refundPolicy: 'full_flexible' | 'moderate_24h' | 'strict_48h' | 'non_refundable';
  allowPayLater?: boolean;
}

export interface PaymentTransaction {
  id: string;
  workspaceId: string;
  bookingId: string;
  eventTypeId: string;
  provider: PaymentProvider;
  providerPaymentId: string;
  amount: number;
  currency: string;
  status: MeetingPaymentStatus;
  customerEmail: string;
  customerName?: string;
  refundedAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RefundCalculationResult {
  isEligible: boolean;
  refundPercentage: number; // 0 to 100
  refundAmount: number;
  reason: string;
}
