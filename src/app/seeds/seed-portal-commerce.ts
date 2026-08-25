/**
 * {{Org_name}} Experience Platform — Monetization & Commerce Seeder
 *
 * Seeds commercial pricing offers, promotional discount coupons,
 * and affiliate partner records for the flagship Academy portal.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { PortalOffer, PortalCoupon, AffiliatePartner } from '@/lib/types/commerce';

export async function seedPortalCommerce(portalId: string, organizationId: string): Promise<void> {
  const now = new Date().toISOString();

  // 1. Seed Flagship Commercial Offer
  const offerRef = adminDb.collection('portal_offers').doc(`offer_${portalId}_annual_pass`);
  const offer: PortalOffer = {
    id: offerRef.id,
    organizationId,
    portalId,
    workspaceIds: ['commerce'],
    title: 'Annual School Bursar All-Access Certification Pass',
    slug: 'annual-bursar-certification-pass',
    description: 'Complete 12-month all-access pass covering all 6 Masterclasses, private cohort sessions, verified graduation credential, and community discussion access.',
    price: 199,
    currency: 'USD',
    offerType: 'one_time',
    isFeatured: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  await offerRef.set(offer, { merge: true });

  // 2. Seed Promotional Coupon
  const couponRef = adminDb.collection('portal_coupons').doc(`coupon_${portalId}_launch20`);
  const coupon: PortalCoupon = {
    id: couponRef.id,
    organizationId,
    portalId,
    code: 'LAUNCH20',
    discountType: 'percentage',
    discountValue: 20,
    maxUses: 100,
    usedCount: 3,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  await couponRef.set(coupon, { merge: true });

  // 3. Seed Affiliate Partner Record
  const affiliateRef = adminDb.collection('affiliate_partners').doc(`aff_${portalId}_lead_partner`);
  const affiliate: AffiliatePartner = {
    id: affiliateRef.id,
    organizationId,
    portalId,
    userId: 'user_seed_partner_1',
    partnerName: 'Bursar Association Ghana',
    partnerEmail: 'partners@bursars.org',
    referralCode: 'BURSAR20',
    commissionType: 'percentage',
    commissionRate: 20,
    status: 'active',
    totalClicks: 142,
    totalConversions: 12,
    totalEarnings: 478,
    pendingBalance: 120,
    paidBalance: 358,
    payoutMethod: 'Mobile Money',
    payoutDetails: 'MTN Mobile Money: 0244000111',
    createdAt: now,
    updatedAt: now,
  };
  await affiliateRef.set(affiliate, { merge: true });

  console.log(`[SEED] Successfully seeded Commerce & Affiliate data for portal: ${portalId}`);
}
