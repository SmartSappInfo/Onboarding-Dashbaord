/**
 * {{Org_name}} Experience Platform — Monetization, Commerce & Affiliate Types
 *
 * Strict TypeScript definitions for Commercial Offers, Pricing Models,
 * Coupons, Orders, Affiliate Partners, Referrals, and Waitlists.
 * Zero `any` or `any[]` typing.
 */

// ── Status & Enum Types ──────────────────────────────────────────────────────

export type OfferType =
  | 'one_time'
  | 'subscription'
  | 'installment'
  | 'trial'
  | 'bundle';

export type BillingInterval = 'monthly' | 'quarterly' | 'yearly';

export type CouponDiscountType = 'percentage' | 'fixed';

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export type PaymentMethodType = 'card' | 'mobile_money' | 'bank_transfer' | 'free';

export type PartnerStatus = 'pending' | 'active' | 'suspended';

export type ReferralStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export type WaitlistStatus = 'waiting' | 'invited' | 'converted';

// ── Core Aggregates ──────────────────────────────────────────────────────────

/**
 * Commercial Offer Aggregate
 * Defines pricing, payment models, and automatic entitlement provisions.
 */
export interface PortalOffer {
  id: string;
  organizationId: string;
  portalId: string;
  workspaceIds: string[];

  title: string;
  slug: string;
  description?: string;

  price: number; // e.g. 199 (USD/GHS)
  currency: string; // e.g. "USD", "GHS", "NGN", "GBP", "EUR"
  offerType: OfferType;
  billingInterval?: BillingInterval;
  installmentCount?: number;
  trialDays?: number;

  // Automated Entitlements Provisioning
  grantedPlanId?: string;
  grantedCourseIds?: string[];
  grantedSpaceIds?: string[];
  grantedResourceIds?: string[];

  isFeatured: boolean;
  isActive: boolean;

  createdAt: string;
  updatedAt: string;
}

/**
 * Coupon & Discount Entity
 */
export interface PortalCoupon {
  id: string;
  organizationId: string;
  portalId: string;

  code: string; // uppercase, e.g. "LAUNCH20"
  discountType: CouponDiscountType;
  discountValue: number; // e.g. 20 (percent) or 50 (fixed)

  maxUses?: number;
  usedCount: number;

  validFrom?: string;
  validUntil?: string;
  applicableOfferIds?: string[]; // empty = all offers

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Portal Order Entity
 * Transaction receipt record.
 */
export interface PortalOrder {
  id: string;
  organizationId: string;
  portalId: string;
  offerId: string;
  offerTitle: string;
  userId: string;

  customerName: string;
  customerEmail: string;
  customerPhone?: string;

  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;

  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethodType;

  couponCode?: string;
  affiliatePartnerId?: string;
  affiliateReferralId?: string;
  commissionAmount?: number;

  createdAt: string;
  completedAt?: string;
}

/**
 * Affiliate Partner Aggregate
 */
export interface AffiliatePartner {
  id: string;
  organizationId: string;
  portalId: string;
  userId: string;

  partnerName: string;
  partnerEmail: string;
  referralCode: string; // e.g. "KWAME"

  commissionType: 'percentage' | 'fixed';
  commissionRate: number; // e.g. 20 (20%) or 50 ($50)

  status: PartnerStatus;
  totalClicks: number;
  totalConversions: number;
  totalEarnings: number;
  pendingBalance: number;
  paidBalance: number;

  payoutMethod?: string;
  payoutDetails?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * Affiliate Referral Entity
 */
export interface AffiliateReferral {
  id: string;
  organizationId: string;
  portalId: string;
  partnerId: string;
  orderId: string;

  customerEmail: string;
  orderAmount: number;
  commissionAmount: number;
  currency: string;

  status: ReferralStatus;
  createdAt: string;
  paidAt?: string;
}

/**
 * Pre-Launch Waitlist Entity
 */
export interface PortalWaitlist {
  id: string;
  organizationId: string;
  portalId: string;
  offerId?: string;

  name: string;
  email: string;
  phone?: string;
  notes?: string;

  status: WaitlistStatus;
  joinedAt: string;
  invitedAt?: string;
}

// ── Input DTOs ───────────────────────────────────────────────────────────────

export interface CreateOfferInput {
  organizationId: string;
  portalId: string;
  workspaceIds?: string[];
  title: string;
  slug?: string;
  description?: string;
  price: number;
  currency?: string;
  offerType: OfferType;
  billingInterval?: BillingInterval;
  installmentCount?: number;
  trialDays?: number;
  grantedPlanId?: string;
  grantedCourseIds?: string[];
  grantedSpaceIds?: string[];
  grantedResourceIds?: string[];
  isFeatured?: boolean;
  isActive?: boolean;
}

export interface UpdateOfferInput {
  title?: string;
  slug?: string;
  description?: string;
  price?: number;
  currency?: string;
  offerType?: OfferType;
  billingInterval?: BillingInterval;
  installmentCount?: number;
  trialDays?: number;
  grantedPlanId?: string;
  grantedCourseIds?: string[];
  grantedSpaceIds?: string[];
  grantedResourceIds?: string[];
  isFeatured?: boolean;
  isActive?: boolean;
}

export interface CreateCouponInput {
  organizationId: string;
  portalId: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxUses?: number;
  validUntil?: string;
  applicableOfferIds?: string[];
}

export interface ValidateCouponInput {
  portalId: string;
  offerId: string;
  code: string;
}

export interface ProcessCheckoutOrderInput {
  organizationId: string;
  portalId: string;
  offerId: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  paymentMethod: PaymentMethodType;
  couponCode?: string;
  affiliateCode?: string;
}

export interface RegisterAffiliateInput {
  organizationId: string;
  portalId: string;
  userId: string;
  partnerName: string;
  partnerEmail: string;
  referralCode?: string;
  payoutMethod?: string;
  payoutDetails?: string;
}

export interface JoinWaitlistInput {
  organizationId: string;
  portalId: string;
  offerId?: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}
