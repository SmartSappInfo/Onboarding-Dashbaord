/**
 * {{Org_name}} Experience Platform — Monetization, Commerce & Affiliate Service
 *
 * Server-side domain operations for Commercial Offers, Coupon Validation,
 * Order Processing with Automated Entitlement Provisioning, Affiliate Partner Engine,
 * and Pre-Launch Waitlists.
 * Zero `any` or `any[]` typing.
 */

import { adminDb } from '@/lib/firebase-admin';
import { PortalMembershipService } from '@/lib/services/portal-membership-service';
import { EnrollmentService } from '@/lib/services/enrollment-service';
import { EngagementService } from '@/lib/services/engagement-service';
import type {
  PortalOffer,
  PortalCoupon,
  PortalOrder,
  AffiliatePartner,
  AffiliateReferral,
  PortalWaitlist,
  CreateOfferInput,
  UpdateOfferInput,
  CreateCouponInput,
  ValidateCouponInput,
  ProcessCheckoutOrderInput,
  RegisterAffiliateInput,
  JoinWaitlistInput,
} from '@/lib/types/commerce';

export class CommerceService {
  // ── Commercial Offers CRUD ─────────────────────────────────────────────────

  public static async createOffer(input: CreateOfferInput): Promise<PortalOffer> {
    const docRef = adminDb.collection('portal_offers').doc();
    const now = new Date().toISOString();

    const slug = input.slug
      ? input.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      : input.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    const offer: PortalOffer = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      workspaceIds: input.workspaceIds || ['commerce'],
      title: input.title.trim(),
      slug,
      description: input.description?.trim(),
      price: Math.max(0, input.price),
      currency: (input.currency || 'USD').toUpperCase(),
      offerType: input.offerType,
      billingInterval: input.billingInterval,
      installmentCount: input.installmentCount,
      trialDays: input.trialDays,
      grantedPlanId: input.grantedPlanId,
      grantedCourseIds: input.grantedCourseIds || [],
      grantedSpaceIds: input.grantedSpaceIds || [],
      grantedResourceIds: input.grantedResourceIds || [],
      isFeatured: input.isFeatured ?? false,
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(offer);
    return offer;
  }

  public static async updateOffer(offerId: string, updates: UpdateOfferInput): Promise<PortalOffer> {
    const docRef = adminDb.collection('portal_offers').doc(offerId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Offer ${offerId} not found.`);

    const current = snap.data() as PortalOffer;
    const now = new Date().toISOString();

    const updated: PortalOffer = {
      ...current,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : current.title,
      slug: updates.slug !== undefined ? updates.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : current.slug,
      price: updates.price !== undefined ? Math.max(0, updates.price) : current.price,
      updatedAt: now,
    };

    await docRef.set(updated, { merge: true });
    return updated;
  }

  public static async deleteOffer(offerId: string): Promise<void> {
    await adminDb.collection('portal_offers').doc(offerId).delete();
  }

  public static async getOfferById(offerId: string): Promise<PortalOffer | null> {
    const snap = await adminDb.collection('portal_offers').doc(offerId).get();
    if (!snap.exists) return null;
    return snap.data() as PortalOffer;
  }

  public static async getOfferBySlug(portalId: string, slug: string): Promise<PortalOffer | null> {
    const snap = await adminDb
      .collection('portal_offers')
      .where('portalId', '==', portalId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as PortalOffer;
  }

  public static async listPortalOffers(portalId: string): Promise<PortalOffer[]> {
    const snap = await adminDb
      .collection('portal_offers')
      .where('portalId', '==', portalId)
      .where('isActive', '==', true)
      .orderBy('price', 'asc')
      .get();

    return snap.docs.map(d => d.data() as PortalOffer);
  }

  // ── Coupons & Discount Engine ──────────────────────────────────────────────

  public static async createCoupon(input: CreateCouponInput): Promise<PortalCoupon> {
    const docRef = adminDb.collection('portal_coupons').doc();
    const now = new Date().toISOString();

    const coupon: PortalCoupon = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      code: input.code.toUpperCase().trim(),
      discountType: input.discountType,
      discountValue: Math.max(0, input.discountValue),
      maxUses: input.maxUses,
      usedCount: 0,
      validUntil: input.validUntil,
      applicableOfferIds: input.applicableOfferIds || [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(coupon);
    return coupon;
  }

  public static async deleteCoupon(couponId: string): Promise<void> {
    await adminDb.collection('portal_coupons').doc(couponId).delete();
  }

  public static async validateCoupon(
    input: ValidateCouponInput
  ): Promise<{ isValid: boolean; discountAmount: number; coupon?: PortalCoupon; message?: string }> {
    const cleanCode = input.code.toUpperCase().trim();
    const snap = await adminDb
      .collection('portal_coupons')
      .where('portalId', '==', input.portalId)
      .where('code', '==', cleanCode)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snap.empty) {
      return { isValid: false, discountAmount: 0, message: 'Invalid coupon code.' };
    }

    const coupon = snap.docs[0].data() as PortalCoupon;

    // Check expiry
    if (coupon.validUntil && new Date(coupon.validUntil).getTime() < Date.now()) {
      return { isValid: false, discountAmount: 0, message: 'This coupon has expired.' };
    }

    // Check max uses
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return { isValid: false, discountAmount: 0, message: 'Coupon usage limit reached.' };
    }

    // Check applicability
    if (coupon.applicableOfferIds && coupon.applicableOfferIds.length > 0 && !coupon.applicableOfferIds.includes(input.offerId)) {
      return { isValid: false, discountAmount: 0, message: 'Coupon does not apply to this offer.' };
    }

    // Calculate discount
    const offer = await CommerceService.getOfferById(input.offerId);
    if (!offer) return { isValid: false, discountAmount: 0, message: 'Offer not found.' };

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = Math.round((offer.price * coupon.discountValue) / 100);
    } else {
      discount = Math.min(offer.price, coupon.discountValue);
    }

    return { isValid: true, discountAmount: discount, coupon };
  }

  // ── Order Processing & Automated Entitlements ──────────────────────────────

  public static async processCheckoutOrder(input: ProcessCheckoutOrderInput): Promise<PortalOrder> {
    const offer = await CommerceService.getOfferById(input.offerId);
    if (!offer) throw new Error('Commercial offer not found.');

    const now = new Date().toISOString();
    const subtotal = offer.price;
    let discountAmount = 0;
    let validCoupon: PortalCoupon | null = null;

    // 1. Validate & Apply Coupon if provided
    if (input.couponCode) {
      const couponValidation = await CommerceService.validateCoupon({
        portalId: input.portalId,
        offerId: input.offerId,
        code: input.couponCode,
      });

      if (couponValidation.isValid && couponValidation.coupon) {
        discountAmount = couponValidation.discountAmount;
        validCoupon = couponValidation.coupon;
      }
    }

    const totalAmount = Math.max(0, subtotal - discountAmount);

    // 2. Affiliate Attribution
    let partner: AffiliatePartner | null = null;
    let commissionAmount = 0;
    if (input.affiliateCode) {
      partner = await CommerceService.getAffiliatePartnerByCode(input.portalId, input.affiliateCode);
      if (partner && partner.userId !== input.userId && partner.status === 'active') {
        if (partner.commissionType === 'percentage') {
          commissionAmount = Math.round((totalAmount * partner.commissionRate) / 100);
        } else {
          commissionAmount = partner.commissionRate;
        }
      }
    }

    // 3. Create Order Document
    const orderDocRef = adminDb.collection('portal_orders').doc();
    const order: PortalOrder = {
      id: orderDocRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      offerId: input.offerId,
      offerTitle: offer.title,
      userId: input.userId,
      customerName: input.customerName.trim(),
      customerEmail: input.customerEmail.trim(),
      customerPhone: input.customerPhone?.trim(),
      subtotal,
      discountAmount,
      totalAmount,
      currency: offer.currency,
      paymentStatus: 'completed',
      paymentMethod: input.paymentMethod,
      couponCode: validCoupon?.code,
      affiliatePartnerId: partner?.id,
      commissionAmount: commissionAmount > 0 ? commissionAmount : undefined,
      createdAt: now,
      completedAt: now,
    };

    await orderDocRef.set(order);

    // 4. Update Coupon usedCount
    if (validCoupon) {
      await adminDb.collection('portal_coupons').doc(validCoupon.id).update({
        usedCount: (validCoupon.usedCount || 0) + 1,
        updatedAt: now,
      });
    }

    // 5. Update Affiliate Partner metrics & create referral
    if (partner && commissionAmount > 0) {
      const referralDocRef = adminDb.collection('affiliate_referrals').doc();
      const referral: AffiliateReferral = {
        id: referralDocRef.id,
        organizationId: input.organizationId,
        portalId: input.portalId,
        partnerId: partner.id,
        orderId: order.id,
        customerEmail: input.customerEmail.trim(),
        orderAmount: totalAmount,
        commissionAmount,
        currency: offer.currency,
        status: 'approved',
        createdAt: now,
      };
      await referralDocRef.set(referral);

      await adminDb.collection('affiliate_partners').doc(partner.id).update({
        totalConversions: (partner.totalConversions || 0) + 1,
        totalEarnings: (partner.totalEarnings || 0) + commissionAmount,
        pendingBalance: (partner.pendingBalance || 0) + commissionAmount,
        updatedAt: now,
      });
    }

    // 6. Automated Entitlements Provisioning
    // A. Course Enrollments
    if (offer.grantedCourseIds && offer.grantedCourseIds.length > 0) {
      for (const courseId of offer.grantedCourseIds) {
        try {
          await EnrollmentService.enrollUserInCourse(
            courseId,
            input.userId,
            input.portalId,
            'purchase'
          );
        } catch (err) {
          console.warn('[COMMERCE] Non-blocking course enrollment note:', err);
        }
      }
    }

    // B. Membership Plan Grant
    const membershipSnap = await adminDb
      .collection('portal_memberships')
      .where('portalId', '==', input.portalId)
      .where('userId', '==', input.userId)
      .limit(1)
      .get();

    if (!membershipSnap.empty) {
      const membershipDoc = membershipSnap.docs[0];
      if (offer.grantedPlanId) {
        await membershipDoc.ref.update({
          planId: offer.grantedPlanId,
          planName: offer.title,
          updatedAt: now,
        });
      }

      // Award +50 Bonus Points for purchasing offer
      await PortalMembershipService.awardPoints(
        membershipDoc.id,
        50,
        `Purchased: ${offer.title} 🌟`
      );
    }

    // C. Activity Log
    await EngagementService.logMemberActivity({
      organizationId: input.organizationId,
      portalId: input.portalId,
      userId: input.userId,
      eventType: 'order.completed',
      title: `Purchased ${offer.title}`,
      description: `Completed order for ${offer.currency} ${totalAmount}.`,
      metadata: { orderId: order.id, offerId: offer.id, totalAmount },
    });

    return order;
  }

  // ── Affiliate Partner Operations ───────────────────────────────────────────

  public static async registerAffiliatePartner(input: RegisterAffiliateInput): Promise<AffiliatePartner> {
    const existing = await CommerceService.getAffiliatePartner(input.portalId, input.userId);
    if (existing) return existing;

    const docRef = adminDb.collection('affiliate_partners').doc();
    const now = new Date().toISOString();

    const referralCode = (input.referralCode || input.partnerName.split(' ')[0] || 'PARTNER')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    const partner: AffiliatePartner = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      userId: input.userId,
      partnerName: input.partnerName.trim(),
      partnerEmail: input.partnerEmail.trim(),
      referralCode,
      commissionType: 'percentage',
      commissionRate: 20, // 20% default
      status: 'active',
      totalClicks: 0,
      totalConversions: 0,
      totalEarnings: 0,
      pendingBalance: 0,
      paidBalance: 0,
      payoutMethod: input.payoutMethod,
      payoutDetails: input.payoutDetails,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(partner);
    return partner;
  }

  public static async getAffiliatePartner(portalId: string, userId: string): Promise<AffiliatePartner | null> {
    const snap = await adminDb
      .collection('affiliate_partners')
      .where('portalId', '==', portalId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as AffiliatePartner;
  }

  public static async getAffiliatePartnerByCode(portalId: string, code: string): Promise<AffiliatePartner | null> {
    const cleanCode = code.toUpperCase().trim();
    const snap = await adminDb
      .collection('affiliate_partners')
      .where('portalId', '==', portalId)
      .where('referralCode', '==', cleanCode)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data() as AffiliatePartner;
  }

  public static async listPortalAffiliates(portalId: string): Promise<AffiliatePartner[]> {
    const snap = await adminDb
      .collection('affiliate_partners')
      .where('portalId', '==', portalId)
      .get();

    return snap.docs.map(d => d.data() as AffiliatePartner);
  }

  public static async updateAffiliateStatus(
    partnerId: string,
    status: 'pending' | 'active' | 'suspended'
  ): Promise<void> {
    await adminDb.collection('affiliate_partners').doc(partnerId).update({
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  // ── Pre-Launch Waitlist ────────────────────────────────────────────────────

  public static async joinWaitlist(input: JoinWaitlistInput): Promise<PortalWaitlist> {
    const docRef = adminDb.collection('portal_waitlists').doc();
    const now = new Date().toISOString();

    const waitlist: PortalWaitlist = {
      id: docRef.id,
      organizationId: input.organizationId,
      portalId: input.portalId,
      offerId: input.offerId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim(),
      notes: input.notes?.trim(),
      status: 'waiting',
      joinedAt: now,
    };

    await docRef.set(waitlist);
    return waitlist;
  }
}
