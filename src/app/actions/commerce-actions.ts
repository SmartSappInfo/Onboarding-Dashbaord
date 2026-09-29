'use server';

/**
 * {{Org_name}} Experience Platform — Monetization, Checkout & Affiliate Server Actions
 *
 * Strongly typed Next.js Server Actions for Offer Management, Coupon Redemption,
 * Checkout Order Processing, Affiliate Referrals, and Waitlists.
 * Zero `any` or `any[]` typing.
 *
 * SECURITY (auth hotfix, agents_mcp Phase 1 §1.1a / audit F2): public endpoints.
 * - Offers, coupons, order/affiliate lists and affiliate status: staff (`requirePortalAdmin`), and the
 *   record must belong to that portal. The organization is always the portal's, never the caller's.
 * - Checkout: the buyer is the verified ID-token uid (or a server-minted guest id). Paid orders stay
 *   `pending` and provision nothing until payment is verified (see CommerceService).
 * - Affiliate registration: an active portal member, registered as themselves.
 * - Coupon validation and the waitlist are intentionally public.
 */

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { CommerceService } from '@/lib/services/commerce-service';
import { PortalService } from '@/lib/services/portal-service';
// SECURITY (audit F9): report detail server-side; return an opaque message + ref.
import { toClientErrorMessage } from '@/lib/errors/report-error';
import {
  assertRecordInPortal,
  portalAuthErrorMessage,
  requirePortalAdmin,
  requirePortalMember,
  requirePortalUser,
} from '@/lib/auth/require-portal-access';
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

function failure(err: unknown, fallback: string): { success: false; error: string } {
  return { success: false, error: portalAuthErrorMessage(err) ?? toClientErrorMessage('actions.commerce-actions', err, undefined, fallback) };
}

// ── Offer Actions ───────────────────────────────────────────────────────────

export async function createOfferAction(
  input: CreateOfferInput,
  portalSlug?: string
): Promise<ActionResponse<PortalOffer>> {
  try {
    const { portal } = await requirePortalAdmin(input.portalId);
    const offer = await CommerceService.createOffer({ ...input, organizationId: portal.organizationId });
    revalidatePath(`/admin/portals/${input.portalId}`);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}`);
      revalidatePath(`/portal/${portalSlug}/learn`);
    }
    return { success: true, data: offer };
  } catch (err: unknown) {
    return failure(err, 'Failed to create offer.');
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
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('portal_offers', offerId, portalId);
    const offer = await CommerceService.updateOffer(offerId, updates);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) {
      revalidatePath(`/portal/${portalSlug}`);
      if (offerSlug) revalidatePath(`/portal/${portalSlug}/checkout/${offerSlug}`);
    }
    return { success: true, data: offer };
  } catch (err: unknown) {
    return failure(err, 'Failed to update offer.');
  }
}

export async function deleteOfferAction(
  offerId: string,
  portalId: string,
  portalSlug?: string
): Promise<ActionResponse<boolean>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('portal_offers', offerId, portalId);
    await CommerceService.deleteOffer(offerId);
    revalidatePath(`/admin/portals/${portalId}`);
    if (portalSlug) revalidatePath(`/portal/${portalSlug}`);
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to delete offer.');
  }
}

export async function listOffersByPortalAction(
  portalId: string
): Promise<ActionResponse<PortalOffer[]>> {
  try {
    // Staff view: includes inactive/draft offers. Public checkout reads a single offer by slug.
    await requirePortalAdmin(portalId);
    const offers = await CommerceService.listPortalOffers(portalId);
    return { success: true, data: offers };
  } catch (err: unknown) {
    return failure(err, 'Failed to list offers.');
  }
}

// ── Coupon Actions ──────────────────────────────────────────────────────────

export async function createCouponAction(
  input: CreateCouponInput
): Promise<ActionResponse<PortalCoupon>> {
  try {
    const { portal } = await requirePortalAdmin(input.portalId);
    const coupon = await CommerceService.createCoupon({ ...input, organizationId: portal.organizationId });
    revalidatePath(`/admin/portals/${input.portalId}`);
    return { success: true, data: coupon };
  } catch (err: unknown) {
    return failure(err, 'Failed to create coupon.');
  }
}

export async function deleteCouponAction(
  couponId: string,
  portalId: string
): Promise<ActionResponse<boolean>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('portal_coupons', couponId, portalId);
    await CommerceService.deleteCoupon(couponId);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to delete coupon.');
  }
}

export async function listCouponsByPortalAction(
  portalId: string
): Promise<ActionResponse<PortalCoupon[]>> {
  try {
    await requirePortalAdmin(portalId);
    const coupons = await CommerceService.listPortalCoupons(portalId);
    return { success: true, data: coupons };
  } catch (err: unknown) {
    return failure(err, 'Failed to list coupons.');
  }
}

export async function validateCouponAction(
  input: ValidateCouponInput
): Promise<ActionResponse<{ isValid: boolean; discountAmount: number; coupon?: PortalCoupon; message?: string }>> {
  try {
    const result = await CommerceService.validateCoupon(input);
    return { success: true, data: result };
  } catch (err: unknown) {
    return failure(err, 'Failed to validate coupon.');
  }
}

// ── Checkout & Order Actions ────────────────────────────────────────────────

/**
 * @param idToken Firebase ID token of the signed-in buyer, or null for guest checkout.
 */
export async function processCheckoutOrderAction(
  idToken: string | null,
  input: Omit<ProcessCheckoutOrderInput, 'userId' | 'organizationId'>,
  portalSlug?: string,
  offerSlug?: string
): Promise<ActionResponse<PortalOrder>> {
  try {
    // Buyer identity is never caller-supplied: verified uid, or a guest id minted here.
    const userId = idToken ? (await requirePortalUser(idToken)).uid : `guest_${randomUUID()}`;
    const portal = await PortalService.getPortalById(input.portalId);
    if (!portal) return { success: false, error: 'Portal not found.' };
    const order = await CommerceService.processCheckoutOrder({ ...input, userId, organizationId: portal.organizationId });
    if (portalSlug) {
      if (offerSlug) revalidatePath(`/portal/${portalSlug}/checkout/${offerSlug}`);
      revalidatePath(`/portal/${portalSlug}/dashboard`);
      revalidatePath(`/portal/${portalSlug}/learn`);
      revalidatePath(`/portal/${portalSlug}/affiliates`);
    }
    return { success: true, data: order };
  } catch (err: unknown) {
    return failure(err, 'Failed to process checkout order.');
  }
}

export async function listOrdersByPortalAction(
  portalId: string
): Promise<ActionResponse<PortalOrder[]>> {
  try {
    await requirePortalAdmin(portalId);
    const orders = await CommerceService.listPortalOrders(portalId);
    return { success: true, data: orders };
  } catch (err: unknown) {
    return failure(err, 'Failed to list orders.');
  }
}

// ── Affiliate Partner Actions ───────────────────────────────────────────────

export async function registerAffiliatePartnerAction(
  idToken: string,
  input: Omit<RegisterAffiliateInput, 'userId' | 'organizationId'>,
  portalSlug?: string
): Promise<ActionResponse<AffiliatePartner>> {
  try {
    const member = await requirePortalMember(idToken, input.portalId);
    const portal = await PortalService.getPortalById(input.portalId);
    if (!portal) return { success: false, error: 'Portal not found.' };
    const partner = await CommerceService.registerAffiliatePartner({ ...input, userId: member.uid, organizationId: portal.organizationId });
    if (portalSlug) revalidatePath(`/portal/${portalSlug}/affiliates`);
    return { success: true, data: partner };
  } catch (err: unknown) {
    return failure(err, 'Failed to register as affiliate partner.');
  }
}

export async function listAffiliatesByPortalAction(
  portalId: string
): Promise<ActionResponse<AffiliatePartner[]>> {
  try {
    await requirePortalAdmin(portalId);
    const affiliates = await CommerceService.listPortalAffiliates(portalId);
    return { success: true, data: affiliates };
  } catch (err: unknown) {
    return failure(err, 'Failed to list affiliates.');
  }
}

export async function updateAffiliatePartnerStatusAction(
  partnerId: string,
  status: 'pending' | 'active' | 'suspended',
  portalId: string
): Promise<ActionResponse<boolean>> {
  try {
    await requirePortalAdmin(portalId);
    await assertRecordInPortal('affiliate_partners', partnerId, portalId);
    await CommerceService.updateAffiliateStatus(partnerId, status);
    revalidatePath(`/admin/portals/${portalId}`);
    return { success: true, data: true };
  } catch (err: unknown) {
    return failure(err, 'Failed to update affiliate partner status.');
  }
}

// ── Waitlist Action ─────────────────────────────────────────────────────────

export async function joinPortalWaitlistAction(
  input: JoinWaitlistInput
): Promise<ActionResponse<PortalWaitlist>> {
  try {
    // Public by design; the organization is taken from the portal, not the caller.
    const portal = await PortalService.getPortalById(input.portalId);
    if (!portal) return { success: false, error: 'Portal not found.' };
    const waitlist = await CommerceService.joinWaitlist({ ...input, organizationId: portal.organizationId });
    return { success: true, data: waitlist };
  } catch (err: unknown) {
    return failure(err, 'Failed to join waitlist.');
  }
}
