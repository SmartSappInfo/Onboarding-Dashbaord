'use server';

/**
 * {{Org_name}} Experience Platform — Monetization, Checkout & Affiliate Server Actions
 *
 * Strongly typed Next.js Server Actions for Offer Management, Coupon Redemption,
 * Checkout Order Processing, Affiliate Referrals, and Waitlists.
 * Zero `any` or `any[]` typing.
 */

import { revalidatePath } from 'next/cache';
import { CommerceService } from '@/lib/services/commerce-service';
import type {
  PortalOffer,
  PortalCoupon,
  PortalOrder,
  AffiliatePartner,
  PortalWaitlist,
  CreateOfferInput,
  UpdateOfferInput,
  CreateCouponInput,
  ValidateCouponInput,
  ProcessCheckoutOrderInput,
  RegisterAffiliateInput,
  JoinWaitlistInput,
} from '@/lib/types/commerce';

export type ActionResponse<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string };

// ── Offer Actions ───────────────────────────────────────────────────────────

export async function createOfferAction(
  input: CreateOfferInput,
  portalSlug?: string
): Promise<ActionResponse<PortalOffer>> {
  try {
    const offer = await CommerceService.createOffer(input);
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}`);
      revalidatePath(`/portal/${portalSlug}/learn`);
    }
    return { success: true, data: offer };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create offer.' };
  }
}

export async function updateOfferAction(
  offerId: string,
  updates: UpdateOfferInput,
  portalId: string,
  portalSlug?: string,
  offerSlug?: string
): Promise<ActionResponse<PortalOffer>> {
  try {
    const offer = await CommerceService.updateOffer(offerId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}`);
      if (offerSlug) revalidatePath(`/portal/${portalSlug}/checkout/${offerSlug}`);
    }
    return { success: true, data: offer };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update offer.' };
  }
}

export async function deleteOfferAction(
  offerId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await CommerceService.deleteOffer(offerId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}`);
    return { success: true, data: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete offer.' };
  }
}

export async function listOffersByPortalAction(
  portalId: string
): Promise<ActionResponse<PortalOffer[]>> {
  try {
    const offers = await CommerceService.listPortalOffers(portalId);
    return { success: true, data: offers };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to list offers.' };
  }
}

// ── Coupon Actions ──────────────────────────────────────────────────────────

export async function createCouponAction(
  input: CreateCouponInput
): Promise<ActionResponse<PortalCoupon>> {
  try {
    const coupon = await CommerceService.createCoupon(input);
    revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: coupon };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create coupon.' };
  }
}

export async function deleteCouponAction(
  couponId: string,
  portalId: string
): Promise<ActionResponse<boolean>> {
  try {
    await CommerceService.deleteCoupon(couponId);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete coupon.' };
  }
}

export async function listCouponsByPortalAction(
  portalId: string
): Promise<ActionResponse<PortalCoupon[]>> {
  try {
    const coupons = await CommerceService.listPortalCoupons(portalId);
    return { success: true, data: coupons };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to list coupons.' };
  }
}

export async function validateCouponAction(
  input: ValidateCouponInput
): Promise<ActionResponse<{ isValid: boolean; discountAmount: number; coupon?: PortalCoupon; message?: string }>> {
  try {
    const result = await CommerceService.validateCoupon(input);
    return { success: true, data: result };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to validate coupon.' };
  }
}

// ── Checkout & Order Actions ────────────────────────────────────────────────

export async function processCheckoutOrderAction(
  input: ProcessCheckoutOrderInput,
  portalSlug?: string,
  offerSlug?: string
): Promise<ActionResponse<PortalOrder>> {
  try {
    const order = await CommerceService.processCheckoutOrder(input);
    if (portalSlug) {
      if (offerSlug) revalidatePath(`/portal/${portalSlug}/checkout/${offerSlug}`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
      revalidatePath(`/portal/${portalSlug}/learn`);
      revalidatePath(`/portal/${portalSlug}/affiliates`);
    }
    return { success: true, data: order };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to process checkout order.' };
  }
}

export async function listOrdersByPortalAction(
  portalId: string
): Promise<ActionResponse<PortalOrder[]>> {
  try {
    const orders = await CommerceService.listPortalOrders(portalId);
    return { success: true, data: orders };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to list orders.' };
  }
}

// ── Affiliate Partner Actions ───────────────────────────────────────────────

export async function registerAffiliatePartnerAction(
  input: RegisterAffiliateInput,
  portalSlug?: string
): Promise<ActionResponse<AffiliatePartner>> {
  try {
    const partner = await CommerceService.registerAffiliatePartner(input);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/affiliates`);
    return { success: true, data: partner };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to register as affiliate partner.' };
  }
}

export async function listAffiliatesByPortalAction(
  portalId: string
): Promise<ActionResponse<AffiliatePartner[]>> {
  try {
    const affiliates = await CommerceService.listPortalAffiliates(portalId);
    return { success: true, data: affiliates };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to list affiliates.' };
  }
}

export async function updateAffiliatePartnerStatusAction(
  partnerId: string,
  status: 'pending' | 'active' | 'suspended',
  portalId: string
): Promise<ActionResponse<boolean>> {
  try {
    await CommerceService.updateAffiliateStatus(partnerId, status);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update affiliate partner status.' };
  }
}

// ── Waitlist Action ─────────────────────────────────────────────────────────

export async function joinPortalWaitlistAction(
  input: JoinWaitlistInput
): Promise<ActionResponse<PortalWaitlist>> {
  try {
    const waitlist = await CommerceService.joinWaitlist(input);
    return { success: true, data: waitlist };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to join waitlist.' };
  }
}
